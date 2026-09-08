"""SQLite history with deterministic hash chaining and atomic, serialized appends.

The chain detects inconsistent stored history, not authorship or truth. Anyone
able to rewrite the file can recompute the chain. A separately trusted head hash
detects changes to an anchored history, including truncation and full rewrites.
"""

import hashlib
import json
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .model import IntegrityError, ValidationError, validate_record

EMPTY_HEAD = "0" * 64
FORMAT = "civos-ledger-v1"
EVENT_COLUMNS = [("seq", "INTEGER", 0, None, 1), ("record_json", "TEXT", 1, None, 0),
                 ("prev_hash", "TEXT", 1, None, 0), ("hash", "TEXT", 1, None, 0)]


def canonical_json(value):
    """CivOS v1 encoding: sorted keys, UTF-8, no insignificant whitespace."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def event_hash(seq, prev_hash, record):
    body = canonical_json({"seq": seq, "prev_hash": prev_hash, "record": record})
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


class Ledger:
    """One connection per instance; use distinct instances across threads/processes.

    Writes acquire a SQLite reserved lock before reading the existing head. Every
    public read and append verifies one consistent database snapshot. This API
    provides no operation to replace or delete records. With initialize=False,
    opening requires an existing CivOS schema and never creates a file or table.
    """

    def __init__(self, path, initialize=True):
        self.path = str(path) if str(path) == ":memory:" else str(Path(path))
        self._connection = None
        try:
            target = self.path
            if not initialize:
                if self.path == ":memory:" or not Path(self.path).is_file():
                    raise IntegrityError("ledger file does not exist")
                target = Path(self.path).resolve().as_uri() + "?mode=rw"
            self._connection = sqlite3.connect(target, timeout=30, isolation_level=None, uri=not initialize)
            self._connection.execute("PRAGMA busy_timeout = 30000")
            self._connection.execute("PRAGMA synchronous = FULL")
            with self._transaction(write=initialize):
                if initialize and not self._schema_objects():
                    self._connection.execute(
                        "CREATE TABLE events (seq INTEGER PRIMARY KEY, record_json TEXT NOT NULL, "
                        "prev_hash TEXT NOT NULL, hash TEXT NOT NULL UNIQUE)"
                    )
                self._verified_events()
        except (sqlite3.Error, IntegrityError) as exc:
            self.close()
            raise IntegrityError(f"cannot open verified ledger: {exc}") from exc

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()

    def close(self):
        if self._connection is not None:
            self._connection.close()
            self._connection = None

    @contextmanager
    def _transaction(self, write=False):
        if self._connection is None:
            raise IntegrityError("ledger is closed")
        try:
            self._connection.execute("BEGIN IMMEDIATE" if write else "BEGIN")
            yield
            self._connection.execute("COMMIT")
        except BaseException as exc:
            if self._connection.in_transaction:
                self._connection.rollback()
            if isinstance(exc, sqlite3.Error):
                raise IntegrityError(f"SQLite ledger error: {exc}") from exc
            raise

    def _schema_objects(self):
        return list(self._connection.execute(
            "SELECT type, name FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' ORDER BY type, name"
        ))

    def _verify_schema(self):
        if self._schema_objects() != [("table", "events")]:
            raise IntegrityError("unexpected SQLite schema; expected only the CivOS events table")
        rows = list(self._connection.execute("PRAGMA table_xinfo(events)"))
        columns = [tuple(row[1:6]) for row in rows]
        if columns != EVENT_COLUMNS or any(row[6] != 0 for row in rows):
            raise IntegrityError("events table does not match the CivOS column contract")
        indexes = list(self._connection.execute("PRAGMA index_list(events)"))
        if len(indexes) != 1 or tuple(indexes[0][2:]) != (1, "u", 0):
            raise IntegrityError("events table must have exactly one unique hash constraint")
        indexed = list(self._connection.execute("SELECT name FROM pragma_index_info(?)", (indexes[0][1],)))
        if indexed != [("hash",)]:
            raise IntegrityError("events unique constraint must cover hash")

    def _verified_events(self, expected_head=None):
        self._verify_schema()
        if expected_head is not None and (
            not isinstance(expected_head, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_head)
        ):
            raise ValidationError("expected_head must be a lowercase SHA-256 hex digest")
        events, prior = [], {}
        previous = EMPTY_HEAD
        rows = self._connection.execute("SELECT seq, record_json, prev_hash, hash FROM events ORDER BY seq")
        for expected_seq, row in enumerate(rows, 1):
            seq, encoded, prev_hash, stored_hash = row
            if type(seq) is not int or seq != expected_seq or prev_hash != previous:
                raise IntegrityError(f"broken sequence or previous hash at event {expected_seq}")
            try:
                record = validate_record(json.loads(encoded), prior)
                if canonical_json(record) != encoded:
                    raise IntegrityError(f"noncanonical record encoding at event {seq}")
                digest = event_hash(seq, prev_hash, record)
            except (ValidationError, ValueError, TypeError, UnicodeError, RecursionError) as exc:
                raise IntegrityError(f"invalid stored record at event {seq}: {exc}") from exc
            if stored_hash != digest:
                raise IntegrityError(f"hash mismatch at event {seq}")
            events.append({"seq": seq, "prev_hash": prev_hash, "hash": digest, "record": record})
            prior[record["id"]] = record
            previous = digest
        if expected_head is not None and previous != expected_head:
            raise IntegrityError("ledger head differs from the externally supplied checkpoint")
        return events

    def events(self, expected_head=None):
        """Return verified envelopes ordered by append sequence."""
        with self._transaction():
            return self._verified_events(expected_head)

    def records(self, expected_head=None):
        return [event["record"] for event in self.events(expected_head)]

    def verify(self, expected_head=None):
        events = self.events(expected_head)
        return {"valid": True, "count": len(events), "head": events[-1]["hash"] if events else EMPTY_HEAD}

    def append(self, records, expected_head=None):
        """Append a nonempty ordered list atomically, optionally requiring its prior head.

        References within the batch must point backwards. On any validation or
        integrity failure, the complete batch is rolled back.
        """
        if not isinstance(records, list) or not records:
            raise ValidationError("append requires a nonempty list of records")
        with self._transaction(write=True):
            existing = self._verified_events(expected_head)
            prior = {event["record"]["id"]: event["record"] for event in existing}
            previous = existing[-1]["hash"] if existing else EMPTY_HEAD
            appended = []
            for seq, value in enumerate(records, len(existing) + 1):
                record = validate_record(value, prior)
                digest = event_hash(seq, previous, record)
                appended.append({"seq": seq, "prev_hash": previous, "hash": digest, "record": record})
                prior[record["id"]] = record
                previous = digest
            self._connection.executemany(
                "INSERT INTO events (seq, record_json, prev_hash, hash) VALUES (?, ?, ?, ?)",
                [(e["seq"], canonical_json(e["record"]), e["prev_hash"], e["hash"]) for e in appended],
            )
            return appended

    def export(self, expected_head=None):
        return {"format": FORMAT, "events": self.events(expected_head)}
