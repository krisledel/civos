"""Run with python -m civos. All actions stay on this computer."""

import argparse
import json
from pathlib import Path
import sqlite3
import sys

from . import __version__
from .ledger import IntegrityError, Ledger, ValidationError
from .report import render_report


def reject_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(path):
    if Path(path).stat().st_size > 10_000_000:
        raise ValueError("Input exceeds the prototype's 10 MB import limit")
    return json.loads(Path(path).read_text(encoding="utf-8-sig"),
                      object_pairs_hook=reject_duplicates,
                      parse_constant=lambda value: (_ for _ in ()).throw(
                          ValueError(f"Invalid JSON number: {value}")))


def write_new(path, content, database):
    target = Path(path)
    if target.resolve() == Path(database).resolve():
        raise ValueError("Output cannot replace the database")
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(content)


def validated_export(document):
    if not isinstance(document, dict) or set(document) != {"format", "events"}:
        raise ValueError("Expected a CivOS export with format and events")
    if document["format"] != "civos-ledger-v1" or not isinstance(document["events"], list):
        raise ValueError("Unsupported export format")
    events = document["events"]
    for event in events:
        if not isinstance(event, dict) or set(event) != {"seq", "prev_hash", "hash", "record"}:
            raise ValueError("Invalid event envelope")
        if type(event["seq"]) is not int:
            raise ValueError("Event sequence must be an integer")
    with Ledger(":memory:") as candidate:
        if events:
            candidate.append([event["record"] for event in events])
        if candidate.events() != events:
            raise IntegrityError("Export hashes or event order do not match its records")
    return [event["record"] for event in events]


def parser():
    result = argparse.ArgumentParser(description="CivOS: inspectable decisions and their evidence.")
    result.add_argument("--version", action="version", version=__version__)
    result.add_argument("--db", default="work/civos.sqlite3", help="local SQLite file")
    commands = result.add_subparsers(dest="command", required=True)
    commands.add_parser("init", help="create or verify a ledger")
    commands.add_parser("demo", help="load the fictional drainage example into an empty ledger")
    add = commands.add_parser("append", help="append an atomic JSON array of records")
    add.add_argument("input")
    restore = commands.add_parser("restore", help="verify an export and restore it into an empty ledger")
    restore.add_argument("input")
    verify = commands.add_parser("verify", help="verify schema, references, sequence and hash chain")
    verify.add_argument("--expected-head", help="compare with a checkpoint held outside this database")
    commands.add_parser("list", help="print all immutable records as JSON")
    export = commands.add_parser("export", help="write portable JSON including the hash chain")
    export.add_argument("--output", required=True)
    report = commands.add_parser("report", help="write an offline HTML review report")
    report.add_argument("--output", required=True)
    report.add_argument("--as-of", help="timezone-aware review clock; defaults to current UTC")
    return result


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    args = parser().parse_args(argv)
    try:
        path = Path(args.db)
        if args.command in {"list", "verify", "export", "report"} and not path.is_file():
            raise ValueError("Ledger does not exist; use init, demo, append, or restore")
        document = None
        if args.command == "demo":
            fixture = Path(__file__).resolve().parent.parent / "examples" / "water-review.json"
            document = read_json(fixture)
        elif args.command == "append":
            document = read_json(args.input)
        elif args.command == "restore":
            document = validated_export(read_json(args.input))
        path.parent.mkdir(parents=True, exist_ok=True)
        with Ledger(path, initialize=args.command not in {"list", "verify", "export", "report"}) as ledger:
            if args.command in {"demo", "restore"} and ledger.verify()["count"]:
                raise ValueError(f"{args.command} requires an empty ledger; choose a new --db path")
            if args.command in {"demo", "append", "restore"}:
                if not isinstance(document, list):
                    raise ValueError("append requires a JSON array of records")
                events = [] if args.command == "restore" and not document else ledger.append(document)
                print(json.dumps({"appended": len(events), **ledger.verify()}, ensure_ascii=False))
            elif args.command in {"init", "verify"}:
                print(json.dumps(ledger.verify(getattr(args, "expected_head", None))))
            elif args.command == "list":
                print(json.dumps(ledger.records(), ensure_ascii=False, indent=2))
            elif args.command == "export":
                write_new(args.output, json.dumps(ledger.export(), ensure_ascii=False, indent=2) + "\n", args.db)
                print(f"Export: {args.output}")
            elif args.command == "report":
                write_new(args.output, render_report(ledger.events(), args.as_of), args.db)
                print(f"Report: {args.output}")
        return 0
    except (ValidationError, IntegrityError, ValueError, OSError, sqlite3.Error, RecursionError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
