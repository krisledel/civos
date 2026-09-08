import unittest

from civos.model import ValidationError, parse_timestamp, validate_record


def claim(identifier="c1", **changes):
    return dict(id=identifier, kind="claim", author="Kris Ledel",
                created_at="2026-09-08T08:00:00Z", statement="A falsifiable claim.",
                context="A defined situation.", assumptions=[], limitations=[], **changes)


def related(kind, identifier, **fields):
    return dict(id=identifier, kind=kind, author="Kris Ledel",
                created_at="2026-09-08T09:00:00+01:00", **fields)


def evidence(identifier="e1", claim_id="c1"):
    return related("evidence", identifier, claim_id=claim_id, stance="supports",
                   source_uri="urn:example:measurement-1", summary="Measured observation.",
                   method="A stated procedure.", limitations=[])


def assessment(identifier="a1", claim_id="c1", evidence_ids=None):
    return related("assessment", identifier, claim_id=claim_id,
                   evidence_ids=["e1"] if evidence_ids is None else evidence_ids,
                   verdict="uncertain", rationale="The sample is too small.")


def decision(identifier="d1", claim_ids=None):
    return related("decision", identifier, claim_ids=["c1"] if claim_ids is None else claim_ids,
                   action="Run a limited trial.", rationale="Reduce uncertainty.", owner="Kris Ledel",
                   alternatives=["Keep the existing process."], dissent="No objections recorded.",
                   review_at="2026-10-08T08:00:00Z", success_criteria="At least 10 observations.",
                   stop_condition="Any safety incident.")


def outcome(identifier="o1", decision_id="d1"):
    return related("outcome", identifier, decision_id=decision_id, observation="Only 5 observations.",
                   result="not_met", next_action="Review collection methods.")


class ModelTests(unittest.TestCase):
    def setUp(self):
        self.prior = {item["id"]: item for item in [claim(), claim("c2"), evidence(),
                                                   evidence("e2", "c2"), decision()]}

    def assertInvalid(self, value, prior=None):
        with self.assertRaises(ValidationError):
            validate_record(value, self.prior if prior is None else prior)

    def test_five_record_kinds_and_detached_result(self):
        prior = {}
        for item in [claim(), evidence(), assessment(), decision(), outcome()]:
            validated = validate_record(item, prior)
            self.assertEqual(validated, item)
            self.assertIsNot(validated, item)
            prior[item["id"]] = validated

    def test_schema_and_scalar_validation(self):
        for patch in [{"extra": "value"}, {"statement": " "}, {"id": "../x"}, {"id": "x" * 129},
                      {"id": "påstående"}, {"assumptions": "text"}, {"limitations": [42]},
                      {"author": None}, {"kind": []}, {"statement": "\ud800"}]:
            with self.subTest(patch=patch):
                self.assertInvalid(claim("new") | patch)
        for item in [None, [], "x", {1: "x"}, {"kind": "claim"}]:
            self.assertInvalid(item)

    def test_dates_require_valid_timezone_and_later_review(self):
        for value in ["2026-09-08", "2026-09-08T08:00:00", "2026-02-30T00:00:00Z",
                      "2026-09-08T08:00:00+00:99", "2026-09-08T08:00:00+24:00",
                      "2026-09-08T08:00:00.1234567Z"]:
            with self.subTest(value=value):
                self.assertInvalid(claim("new") | {"created_at": value})
        item = decision("new")
        item["review_at"] = "2026-09-08T10:00:00+02:00"
        self.assertInvalid(item)
        self.assertEqual(parse_timestamp("2026-09-08T10:00:00+02:00"),
                         parse_timestamp("2026-09-08T08:00:00Z"))

    def test_sources_and_enums(self):
        for uri in ["file:///tmp/source", "javascript:alert(1)", "ftp://example.test/a",
                    "https:///no-host", "https://user:secret@example.test", "urn:missing",
                    "https://example.test:99999", "https://example.test/a b",
                    "https://example.test/%GG", "https://example.test/a\\b"]:
            with self.subTest(uri=uri):
                self.assertInvalid(evidence("new") | {"source_uri": uri})
        for uri in ["https://example.test/source?q=1", "http://localhost:8000", "urn:example:source"]:
            validate_record(evidence("new") | {"source_uri": uri}, self.prior)
        self.assertInvalid(evidence("new") | {"stance": "true"})
        self.assertInvalid(assessment() | {"verdict": "proven"})
        self.assertInvalid(outcome() | {"result": "success"})

    def test_linked_records_cannot_predate_their_sources(self):
        for item in [evidence("new"), assessment(), decision("new"), outcome()]:
            with self.subTest(kind=item["kind"]):
                self.assertInvalid(item | {"created_at": "2026-09-08T07:59:59Z"})
        self.prior["e1"]["created_at"] = "2026-09-08T08:00:01Z"
        self.assertInvalid(assessment())

    def test_references_types_cross_claim_and_empty_or_duplicate_lists(self):
        for item in [evidence("new", "missing"), evidence("new", "e1"),
                     assessment(evidence_ids=["e2"]), assessment(evidence_ids=["c1"]),
                     assessment(evidence_ids=[]), assessment(evidence_ids=["e1", "e1"]),
                     decision("new", []), decision("new", ["c1", "c1"]),
                     decision("new") | {"alternatives": []}, outcome(decision_id="c1")]:
            with self.subTest(item=item):
                self.assertInvalid(item)

    def test_revision_kind_subject_tip_and_time(self):
        revision = evidence("e3") | {"supersedes": "e1", "stance": "disputes"}
        validate_record(revision, self.prior)
        self.assertInvalid(evidence("e3", "c2") | {"supersedes": "e1"})
        self.assertInvalid(evidence("e3") | {"supersedes": "c1"})
        self.assertInvalid(decision("d2", ["c2"]) | {"supersedes": "d1"})
        self.assertInvalid(claim("c3") | {"supersedes": "c1", "created_at": "2026-09-07T00:00:00Z"})
        self.prior["e3"] = revision
        self.assertInvalid(evidence("e4") | {"supersedes": "e1"})
        validate_record(evidence("e4") | {"supersedes": "e3"}, self.prior)

    def test_complete_revision_chain_advances_exact_targets_without_regression(self):
        initial = [claim(), evidence(), assessment(), decision(), outcome()]
        revised = [claim("c-new") | {"supersedes": "c1"},
                   evidence("e-new", "c-new") | {"supersedes": "e1"},
                   assessment("a-new", "c-new", ["e-new"]) | {"supersedes": "a1"},
                   decision("d-new", ["c-new"]) | {"supersedes": "d1"},
                   outcome("o-new", "d-new") | {"supersedes": "o1"}]
        prior = {}
        for item in initial + revised:
            prior[item["id"]] = validate_record(item, prior)
        self.assertEqual(prior["d1"]["claim_ids"], ["c1"])
        self.assertEqual(prior["o1"]["decision_id"], "d1")
        for item in [evidence("e-back") | {"supersedes": "e-new"},
                     assessment("a-back") | {"supersedes": "a-new"},
                     decision("d-back") | {"supersedes": "d-new"},
                     outcome("o-back") | {"supersedes": "o-new"},
                     decision("duplicate", ["c1", "c-new"])]:
            with self.subTest(item=item):
                self.assertInvalid(item, prior)
        prior["unrelated"] = validate_record(claim("unrelated"), prior)
        self.assertInvalid(evidence("e-other", "unrelated") | {"supersedes": "e-new"}, prior)
        self.assertInvalid(decision("d-other", ["unrelated"]) | {"supersedes": "d-new"}, prior)


if __name__ == "__main__":
    unittest.main()
