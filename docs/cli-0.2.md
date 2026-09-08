# CivOS

**Trace a decision from its evidence to its consequences.**

Kris Ledel

CivOS records what was claimed, which evidence was used, who disagreed, who took responsibility, and what happened afterward. Its research question is whether keeping these connections intact improves collective decisions under uncertainty.

Version 0.2 is a working local prototype: a Python command line tool, a SQLite ledger, portable JSON, and an offline HTML review report. The broader architecture remains a proposal. There are no field results yet.

## Run the example

Requires **Python 3.10 or later**, including its standard SQLite module. No package installation, account, API key, model, or network connection is required after downloading the source.

From the repository directory:

```sh
python -m civos --db work/demo.sqlite3 demo
python -m civos --db work/demo.sqlite3 verify
python -m civos --db work/demo.sqlite3 report --as-of 2026-09-08T12:00:00Z --output work/report.html
```

Open `work/report.html` in a browser. On Windows, `py -3` can replace `python` if that is how Python is installed. On other systems the executable may be `python3`.

The fictional drainage example contains **11 records, two decisions, one disputed claim, and one review overdue without a recorded outcome** at the specified review clock. One inspection has an inconclusive outcome; another decision still awaits access review. Every person, observation and location in the fixture is invented.

`demo` requires an empty database. Output commands refuse to replace existing files. Use a new database or output name for a second run.

## The record model

| Record | What it preserves |
| --- | --- |
| Claim | A statement, its context, assumptions and limitations |
| Evidence | A source reference, method, summary and stance toward one claim |
| Assessment | A named person's judgment of evidence for one claim |
| Decision | The claim basis, action, owner, alternatives, dissent, review time, success criteria and stop condition |
| Outcome | An observation about a decision, its reported result and next action |

Assessments remain distinct even when they disagree. A source count is not a vote or a confidence estimate. An owner remains responsible for deciding whether to act.

The report flags disputed or unassessed bases, uncertain assessments, missing evidence, revised references, inconclusive outcomes and overdue reviews. These are prompts for inspection, not automated verdicts.

## Add your own records

Copy [the example JSON](examples/water-review.json), replace its fictional content, and use fresh identifiers. Put referenced records before the records that use them.

```sh
python -m civos --db work/my-review.sqlite3 append my-records.json
python -m civos --db work/my-review.sqlite3 list
python -m civos --db work/my-review.sqlite3 report --output work/my-review.html
```

An import succeeds as a whole or adds nothing. Wrong fields, malformed timestamps, duplicate IDs, missing references and evidence from the wrong claim are rejected. See the [record contract](docs/record-format.md) before adding revisions.

## Export and check a copy

```sh
python -m civos --db work/demo.sqlite3 export --output work/ledger.json
python -m civos --db work/restored.sqlite3 restore work/ledger.json
python -m civos --db work/restored.sqlite3 verify
```

Keep the `head` value returned by `verify` separately. To compare a restored copy with that **exact snapshot**, substitute the saved 64-character lowercase digest:

```sh
python -m civos --db work/restored.sqlite3 verify --expected-head YOUR_SAVED_HEAD
```

A legitimate append changes the current head. An older checkpoint therefore does not match the new current head. The command compares exact snapshots; it does not prove that one ledger is a prefix of another.

## What verification establishes

Verification checks record structure, reference relationships, append order and SHA-256 hash continuity. It detects inconsistent edits. An independently retained head also detects a different exact snapshot, including truncation or a fully recomputed history.

Authors are self-declared. Local file permissions control access. Anyone able to rewrite the database can rewrite its entire chain; anyone allowed to append can submit a revision under another name. The prototype does not authenticate authors, archive source content, prove truth, infer causality, confer decision authority, or synchronize independent nodes. See [technical limits](technical-overview.md) and [failure modes](thedarkmirror).

## Development

```sh
python -m unittest discover -s tests -v
```

The tests exercise invalid imports, rollback, concurrent writers, revision chains, tampering, checkpoints, export/restore and report escaping. The CI workflow runs the same suite on Windows and Linux; remote results depend on the actual workflow run.

## Read further

- [Technical overview](technical-overview.md)
- [Record format](docs/record-format.md)
- [Pilot protocol](docs/pilot-protocol.md)
- [Philosophical basis](philosophical-basis.md)
- [Climate example](climate-knowledge-integration.md)
- [English article](articles/civos-instruction-set.md) / [Svensk installationsguide](articles/civos-installationsguide.md)
- [Contributing](CONTRIBUTING.md) / [Code of conduct](CODE_OF_CONDUCT.md)

## License

Documentation is offered under CC BY-SA 4.0; code under MIT, as specified in [LICENSE](LICENSE). Existing notices are retained.
