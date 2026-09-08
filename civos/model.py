"""Strict record validation for the local CivOS ledger."""

import copy
import re
from datetime import datetime
from urllib.parse import urlsplit


class ValidationError(ValueError):
    """A proposed record does not satisfy the record contract."""


class IntegrityError(RuntimeError):
    """Stored history or its externally supplied checkpoint does not verify."""


KINDS = {
    "claim": {"statement", "context", "assumptions", "limitations"},
    "evidence": {"claim_id", "stance", "source_uri", "summary", "method", "limitations"},
    "assessment": {"claim_id", "evidence_ids", "verdict", "rationale"},
    "decision": {"claim_ids", "action", "rationale", "owner", "alternatives", "dissent",
                 "review_at", "success_criteria", "stop_condition"},
    "outcome": {"decision_id", "observation", "result", "next_action"},
}
COMMON = {"id", "kind", "author", "created_at"}
LIST_FIELDS = {"assumptions", "limitations", "evidence_ids", "claim_ids", "alternatives"}
ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\Z")
TIME_PATTERN = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"
    r"(?:\.[0-9]{1,6})?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])\Z"
)


def _string(value, field):
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"{field} must be a nonempty string")
    try:
        value.encode("utf-8")
    except UnicodeEncodeError as exc:
        raise ValidationError(f"{field} must contain valid Unicode") from exc


def _identifier(value, field):
    _string(value, field)
    if not ID_PATTERN.fullmatch(value):
        raise ValidationError(f"{field} must be an ASCII identifier of 1 to 128 characters")


def parse_timestamp(value, field="created_at"):
    """Parse the timestamp subset used by the record format, requiring a timezone."""
    _string(value, field)
    if not TIME_PATTERN.fullmatch(value):
        raise ValidationError(f"{field} must be YYYY-MM-DDTHH:MM:SS[.ffffff](Z|+HH:MM|-HH:MM)")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationError(f"{field} is not a valid timestamp") from exc


def _reference(identifier, field, kind, prior):
    _identifier(identifier, field)
    target = prior.get(identifier)
    if target is None or target["kind"] != kind:
        raise ValidationError(f"{field} must reference an earlier {kind}: {identifier}")
    return target


def _lineage(identifier, prior):
    while True:
        yield identifier
        identifier = prior[identifier].get("supersedes")
        if identifier is None:
            return


def _claim_roots(identifiers, prior):
    roots = {list(_lineage(identifier, prior))[-1]: identifier for identifier in identifiers}
    if len(roots) != len(identifiers):
        raise ValidationError("claim_ids must include at most one revision of each claim lineage")
    return roots


def _source_uri(value):
    if any(char.isspace() or ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValidationError("source_uri must not contain whitespace or control characters")
    if "\\" in value or re.search(r"%(?![0-9A-Fa-f]{2})", value):
        raise ValidationError("source_uri contains an invalid escape or backslash")
    try:
        uri = urlsplit(value)
        if uri.scheme in {"http", "https"}:
            if not uri.hostname or uri.username is not None or uri.password is not None:
                raise ValueError("invalid HTTP authority")
            _ = uri.port
        elif uri.scheme == "urn":
            if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]{0,31}:.+", uri.path):
                raise ValueError("invalid URN")
        else:
            raise ValueError("unsupported scheme")
    except ValueError as exc:
        raise ValidationError("source_uri must be an http/https URL or a namespace-qualified urn") from exc


def validate_record(record, prior):
    """Return a detached valid record; references may only address ``prior`` records.

    Supersession is linear. Linked subjects may stay fixed or advance to newer
    descendants; decision revisions preserve the set of claim lineage roots.
    Historical IDs stay addressable and are never silently retargeted.
    """
    if not isinstance(record, dict) or any(not isinstance(key, str) for key in record):
        raise ValidationError("each record must be a JSON object with string keys")
    kind = record.get("kind")
    if not isinstance(kind, str) or kind not in KINDS:
        raise ValidationError("kind must be claim, evidence, assessment, decision, or outcome")
    required = COMMON | KINDS[kind]
    missing = required - record.keys()
    unknown = record.keys() - required - {"supersedes"}
    if missing:
        raise ValidationError(f"missing fields: {', '.join(sorted(missing))}")
    if unknown:
        raise ValidationError(f"unknown fields: {', '.join(sorted(unknown))}")
    for field, value in record.items():
        if field in LIST_FIELDS:
            if not isinstance(value, list):
                raise ValidationError(f"{field} must be a list of strings")
            if not value and field not in {"assumptions", "limitations"}:
                raise ValidationError(f"{field} must not be empty")
            for item in value:
                _string(item, field)
            if field in {"evidence_ids", "claim_ids"} and len(value) != len(set(value)):
                raise ValidationError(f"{field} must not contain duplicates")
        else:
            _string(value, field)
    _identifier(record["id"], "id")
    if record["id"] in prior:
        raise ValidationError(f"duplicate record id: {record['id']}")
    created = parse_timestamp(record["created_at"])
    if kind in {"evidence", "assessment"}:
        _reference(record["claim_id"], "claim_id", "claim", prior)
    if kind == "evidence":
        if record["stance"] not in {"supports", "disputes", "context"}:
            raise ValidationError("stance must be supports, disputes, or context")
        _source_uri(record["source_uri"])
    elif kind == "assessment":
        if record["verdict"] not in {"supports", "disputes", "uncertain"}:
            raise ValidationError("verdict must be supports, disputes, or uncertain")
        for identifier in record["evidence_ids"]:
            evidence = _reference(identifier, "evidence_ids", "evidence", prior)
            if evidence["claim_id"] != record["claim_id"]:
                raise ValidationError("assessment evidence must address its exact claim_id")
    elif kind == "decision":
        for identifier in record["claim_ids"]:
            _reference(identifier, "claim_ids", "claim", prior)
        _claim_roots(record["claim_ids"], prior)
        if parse_timestamp(record["review_at"], "review_at") <= created:
            raise ValidationError("review_at must be later than created_at")
    elif kind == "outcome":
        _reference(record["decision_id"], "decision_id", "decision", prior)
        if record["result"] not in {"met", "not_met", "inconclusive"}:
            raise ValidationError("result must be met, not_met, or inconclusive")
    if "supersedes" in record:
        older = _reference(record["supersedes"], "supersedes", kind, prior)
        if any(item.get("supersedes") == older["id"] for item in prior.values()):
            raise ValidationError("supersedes must reference the latest revision; forks are forbidden")
        for field in {"claim_id", "decision_id"} & KINDS[kind]:
            if older[field] not in _lineage(record[field], prior):
                raise ValidationError(f"supersession {field} must stay fixed or advance within its lineage")
        if kind == "decision":
            old_roots, new_roots = _claim_roots(older["claim_ids"], prior), _claim_roots(record["claim_ids"], prior)
            if old_roots.keys() != new_roots.keys():
                raise ValidationError("supersession must preserve the set of claim lineage roots")
            if any(old_roots[root] not in _lineage(new_roots[root], prior) for root in old_roots):
                raise ValidationError("supersession claim_ids must stay fixed or advance within their lineages")
    references = [record[field] for field in ("claim_id", "decision_id", "supersedes") if field in record]
    references += record.get("evidence_ids", []) + record.get("claim_ids", [])
    for identifier in references:
        if created < parse_timestamp(prior[identifier]["created_at"]):
            raise ValidationError(f"created_at cannot predate referenced record: {identifier}")
    return copy.deepcopy(record)
