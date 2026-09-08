# CivOS record format, version 1

This document describes the separate CivOS 0.2 Python command-line prototype. The current web application uses 19 record types and signed bundles. See the [installation guide](../articles/civos-installationsguide.md) and [computational-model guide](../articles/civos-models.md) for the web workflow.


The executable contract is `civos/model.py`. This document specifies its inputs and relationships. The format describes records of claims and decisions; successful validation establishes neither truth nor authority.

## Common fields

Every record is an object with `id`, `kind`, `author`, and `created_at`. All fields below are required unless marked optional. Unknown fields are rejected.

- `id`: 1–128 ASCII characters matching `[A-Za-z0-9][A-Za-z0-9._:-]*`, unique in the ledger.
- `kind`: `claim`, `evidence`, `assessment`, `decision`, or `outcome`.
- `author`: nonempty self-declared attribution. This is not an authenticated identity.
- `created_at`: `YYYY-MM-DDTHH:MM:SS[.ffffff](Z|+HH:MM|-HH:MM)`, with a valid date and timezone. The timestamp must not predate any referenced record. It is a declared record time, not a trusted clock reading.
- `supersedes` (optional): the earlier record's ID. See revision rules below.

Strings must contain non-whitespace text and valid Unicode. Arrays contain nonempty strings. `assumptions` and `limitations` may be empty; other arrays may not. Empty limitations mean no limitations were recorded, not that none exist. Duplicate evidence and claim IDs are rejected within an array.

## Kind-specific fields

| Kind | Fields |
| --- | --- |
| `claim` | `statement`, `context`, `assumptions` (array), `limitations` (array) |
| `evidence` | `claim_id`, `stance`, `source_uri`, `summary`, `method`, `limitations` (array) |
| `assessment` | `claim_id`, `evidence_ids` (array), `verdict`, `rationale` |
| `decision` | `claim_ids` (array), `action`, `rationale`, `owner`, `alternatives` (array), `dissent`, `review_at`, `success_criteria`, `stop_condition` |
| `outcome` | `decision_id`, `observation`, `result`, `next_action` |

Unmarked fields are strings. Evidence `stance` is `supports`, `disputes`, or `context`. Assessment `verdict` is `supports`, `disputes`, or `uncertain`. Outcome `result` is `met`, `not_met`, or `inconclusive` and records the author's judgment, not an independent evaluation.

`review_at` follows the timestamp format above and must be later than the decision's `created_at`. If there is no recorded dissent, say so explicitly; the field must not be omitted. State decision authority and accepted uncertainty in `rationale` because the prototype has no separate mandate or uncertainty object.

`source_uri` accepts HTTP/HTTPS URLs with a hostname and without embedded credentials, or namespace-qualified URNs. Whitespace and control characters are rejected. URIs are references, not fetched or archived content. Example URNs identify fictional source material.

## References and revisions

Each reference must address an existing record or an earlier record in the same batch. Evidence addresses a claim. Every evidence ID in an assessment must address that assessment's exact `claim_id`. A decision addresses one or more claims. An outcome addresses one decision version.

A correction has a new ID and points to the latest version using `supersedes`. It must have the same kind. A superseded record cannot acquire two successors. The complete old record remains stored.

Evidence and assessment revisions may keep their claim reference or advance it to a descendant in the same claim lineage. An outcome revision may similarly advance its decision reference. Decision revisions preserve the set of claim lineages, with at most one version from each lineage; references may advance, never regress. Unrelated subjects require a new independent record.

Old references never move. Advancing a claim therefore requires reassessing its evidence; a previous assessment does not automatically become evidence for the new wording. An outcome attached to an old decision does not satisfy the revised decision's follow-up.

Author names do not control supersession. The custodian must agree correction rules with participants. Replacing another participant's assessment can remove its dispute flag from the current summary even though the original remains in history.

## Input and export

`append` takes a nonempty JSON array of records. Inputs over 10 MB, duplicate object keys and non-JSON numeric constants are rejected. Batches are atomic. A failed import adds no records.

`export` produces an object with exactly `format` and `events`:

```json
{"format":"civos-ledger-v1","events":[]}
```

Each event has exactly `seq` (integer starting at 1), `prev_hash`, `hash`, and `record`. The first previous hash is 64 zeros. Later previous hashes equal their predecessor's hash. Restoring an empty export is allowed. Restore requires an empty destination, validates the exported chain before importing, and preserves its head.

## Hash encoding

For each event, hash the following object, excluding the event's `hash` field:

```json
{"seq":1,"prev_hash":"0000000000000000000000000000000000000000000000000000000000000000","record":{}}
```

The empty record above illustrates the hash envelope only; it is not a valid CivOS record. Use Python `json.dumps` with `ensure_ascii=False`, `sort_keys=True`, `separators=(',', ':')`, and `allow_nan=False`, encode as UTF-8 with no BOM or trailing newline, then calculate lowercase SHA-256 hex. Arrays retain order. Unicode is not normalized. Implementations must reproduce this encoding, including escaping control characters, to obtain the same hash.

The saved head is the last event hash, or 64 zeros for an empty ledger. `verify --expected-head` compares the exact current head. A legitimate append changes it. This is neither a signature nor a proof that one independently changed history extends another.
