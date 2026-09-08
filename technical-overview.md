# CivOS 0.2: technical overview

The prototype implements a local decision record with checked references and an inspectable history. Its scope is one database managed by a known custodian. The distributed architecture proposed in the original essays remains a design question.

## Components

| Component | Implementation | Responsibility |
| --- | --- | --- |
| Command line | `civos/__main__.py` | Import, inspection, export, restore and report commands |
| Record validation | `civos/model.py` | Strict fields, timestamps, reference kinds and revision rules |
| Ledger | `civos/ledger.py` | SQLite transactions, append sequence and SHA-256 chain |
| Review report | `civos/report.py` | Deterministic review flags and escaped, offline HTML |
| Example | `examples/water-review.json` | Fictional disagreement and follow-up workflow |

Only Python's standard library is required. Reports embed their styles and interaction code; searching a report does not contact a server.

## Write path

1. Parse an ordered JSON array. The command line rejects duplicate object keys, non-JSON numeric constants and files over 10 MB.
2. Open the ledger and check its database schema and existing history.
3. Begin a SQLite `IMMEDIATE` transaction before reading the current head. Concurrent writers wait for the write lock.
4. Validate the entire batch. References must point to existing records or earlier members of the batch. Referencing records cannot predate their dependencies.
5. Calculate each event hash and insert the batch in sequence. Commit once. Any validation or database error rolls back the batch.

Use a separate connection per caller; do not share a connection across threads. Lock waits are limited to 30 seconds. SQLite and the underlying filesystem remain the durability boundary.

## Read and restore paths

Every public ledger read verifies one consistent database snapshot. A changed record, gap, invalid reference, noncanonical encoding or inconsistent hash aborts the operation. Schema checks reject unrelated databases and unexpected tables, indexes, views or triggers.

An export carries event sequence numbers, previous hashes, hashes and original records. Restore rebuilds and compares that chain in memory, then imports into an empty ledger. It does not silently recalculate and accept a corrupted export. Keep exports and checkpoints separately when they need to provide an independent comparison.

## Revisions

Records are immutable through the API. A correction adds a new identifier with `supersedes` pointing to the latest version. Forking a revision chain is rejected.

Existing references keep their exact targets. A new revision may advance a reference to a descendant of that target in the same subject lineage. It may not switch to an unrelated claim or move back to an older target. Decision revisions preserve the set of underlying claim lineages.

A revised claim does not automatically inherit evidence or assessments. Reviewers must check the changed statement and record suitable evidence and assessments for that exact version. An outcome for an old decision version does not fulfill follow-up for a revised decision.

## Review rules

The report uses all records in the exported snapshot. `--as-of` is a review clock, not a historical query; it changes deadline evaluation only.

- A current evidence record with stance `disputes`, or assessment with verdict `disputes`, flags its exact claim as disputed.
- Uncertain assessments, missing evidence and missing assessments require review.
- Decisions referencing superseded claims and assessments referencing superseded evidence are flagged.
- A decision is overdue when its review time has passed and no current outcome refers to that exact decision ID.
- `not_met` and `inconclusive` outcomes remain visible. Recording an outcome does not constitute acceptance or closure.

Current means not superseded. It is a revision relation, not a quality label. A custodian can suppress dissent from current summaries by appending a replacement; preserved history does not prevent that. Inspect the complete record and control revision authority in the operating process.

## Integrity boundary

The chain has no signatures, trusted timestamps, external witnesses or identity verification. A person who can replace the database can recompute all hashes. A separately trusted head detects an altered exact snapshot, but cannot establish that the observations were correct or that a claimed author wrote them. A legitimate append also changes the head.

The [hash encoding](docs/record-format.md) is a project format. No conformance with JSON Canonicalization Scheme, W3C PROV, C2PA or a verifiable-credentials standard is claimed.

Source URIs accept HTTP, HTTPS and namespace-qualified URNs. They are not fetched. External content is not verified and attachments are not archived. The HTML report escapes record content and permits no external scripts, styles or automatic resource requests.

## Performance boundary

Verification scans all events. Each append verifies the existing history; revision checks can scan earlier records. Cost grows with ledger size and may become quadratic across repeated appends. Reports and exports are assembled in memory. No throughput, scale or production reliability claim has been measured.

Before broader shared use, specify identity, authorization, revision ownership, source retention, consent and deletion, migration, recovery and conflicting imports. Federation requires a conflict protocol and an independent trust model. Implement extensions against concrete failures in the [pilot](docs/pilot-protocol.md).
