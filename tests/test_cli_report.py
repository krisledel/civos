import copy
from contextlib import closing
from html.parser import HTMLParser
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

from civos.ledger import Ledger
from civos.report import render_report, review_state

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = json.loads((ROOT / "examples/water-review.json").read_text(encoding="utf-8"))


class Markup(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids, self.refs, self.scripts = [], [], 0
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if attrs.get("href", "").startswith("#") and len(attrs["href"]) > 1:
            self.refs.append(attrs["href"][1:])
        self.scripts += tag == "script"


class CliReportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.db = self.directory / "ledger.sqlite3"

    def run_cli(self, *args, good=True, db=None):
        result = subprocess.run([sys.executable, "-m", "civos", "--db", str(db or self.db), *map(str, args)],
                                cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(result.returncode, 0 if good else 1, result.stdout + result.stderr)
        self.assertNotIn("Traceback", result.stderr)
        return result

    def test_demo_export_restore_report_and_checkpoint(self):
        self.run_cli("demo")
        summary = json.loads(self.run_cli("verify").stdout)
        self.assertEqual(summary["count"], 11)
        export = self.directory / "export.json"
        self.run_cli("export", "--output", export)
        restored = self.directory / "restored.sqlite3"
        self.run_cli("restore", export, db=restored)
        self.run_cli("verify", "--expected-head", summary["head"], db=restored)
        self.run_cli("restore", export, db=restored, good=False)
        report = self.directory / "report.html"
        self.run_cli("report", "--as-of", "2026-09-08T12:00:00Z", "--output", report)
        text = report.read_text(encoding="utf-8")
        self.assertIn("Review overdue; no outcome recorded", text)
        self.assertIn("Disputed basis: claim-drainage", text)
        self.assertIn(summary["head"], text)
        self.run_cli("report", "--output", report, good=False)
        self.assertEqual(text, report.read_text(encoding="utf-8"))

    def test_bad_import_and_export_leave_existing_history_unchanged(self):
        self.run_cli("demo")
        before = self.db.read_bytes()
        bad = copy.deepcopy(FIXTURE[:2])
        bad[0]["id"] = "new-claim"
        bad[1]["surprise"] = True
        path = self.directory / "bad.json"
        path.write_text(json.dumps(bad), encoding="utf-8")
        self.run_cli("append", path, good=False)
        self.assertEqual(before, self.db.read_bytes())
        self.run_cli("export", "--output", self.db, good=False)
        self.assertEqual(before, self.db.read_bytes())
        duplicate = self.directory / "duplicate.json"
        duplicate.write_text('{"id":1,"id":2}', encoding="utf-8")
        self.run_cli("append", duplicate, good=False)
        self.run_cli("report", "--as-of", "2026-09-08", "--output", self.directory / "bad.html", good=False)

    def test_restore_rejects_tampering_and_handles_empty_export(self):
        with Ledger(":memory:") as ledger:
            ledger.append(FIXTURE)
            export = ledger.export()
        export["events"][0]["record"]["statement"] = "tampered"
        path = self.directory / "export.json"
        path.write_text(json.dumps(export), encoding="utf-8")
        self.run_cli("restore", path, good=False)
        self.assertFalse(self.db.exists())
        path.write_text(json.dumps({"format": "civos-ledger-v1", "events": []}), encoding="utf-8")
        self.run_cli("restore", path)
        self.assertEqual(json.loads(self.run_cli("verify").stdout)["count"], 0)

    def test_missing_read_target_is_not_created_and_corruption_is_reported(self):
        self.run_cli("verify", good=False)
        self.assertFalse(self.db.exists())
        self.run_cli("demo")
        with closing(sqlite3.connect(self.db)) as database, database:
            database.execute("UPDATE events SET hash = ? WHERE seq = 1", ("f" * 64,))
        self.run_cli("verify", good=False)
        self.run_cli("report", "--output", self.directory / "corrupt.html", good=False)
        self.assertFalse((self.directory / "corrupt.html").exists())

    def test_review_dispute_uncertainty_outcomes_and_revisions(self):
        early = review_state(FIXTURE, "2026-09-05T12:00:00Z")
        access = next(item for item in early["decisions"] if item["record"]["id"] == "decision-access")
        self.assertFalse(access["overdue"])
        self.assertIn("Uncertain assessment: claim-access", access["issues"])
        state = review_state(FIXTURE, "2026-09-08T12:00:00Z")
        self.assertEqual(sum(item["overdue"] for item in state["decisions"]), 1)
        self.assertTrue(state["claims"]["claim-drainage"]["disputed"])
        revised = copy.deepcopy(FIXTURE[2])
        revised.update(id="evidence-map-v2", supersedes="evidence-map", created_at="2026-09-08T11:00:00Z")
        state = review_state(FIXTURE + [revised], "2026-09-08T12:00:00Z")
        self.assertTrue(state["claims"]["claim-drainage"]["stale"])
        self.assertEqual(state["by_id"]["assessment-design"]["evidence_ids"], ["evidence-map"])

    def test_report_escapes_input_preserves_template_text_and_resolves_links(self):
        records = copy.deepcopy(FIXTURE)
        records[0]["statement"] = '<script>alert("x")</script> {{HISTORY}} & {{HEAD}}'
        records[0]["id"] = "search"
        for record in records:
            if record.get("claim_id") == "claim-drainage":
                record["claim_id"] = "search"
            if record.get("claim_ids") == ["claim-drainage"]:
                record["claim_ids"] = ["search"]
        with Ledger(":memory:") as ledger:
            ledger.append(records)
            report = render_report(ledger.events(), "2026-09-08T12:00:00Z")
        markup = Markup(report)
        self.assertEqual(markup.scripts, 1)
        self.assertIn('&lt;script&gt;', report)
        self.assertIn('{{HISTORY}} &amp; {{HEAD}}', report)
        self.assertEqual(len(markup.ids), len(set(markup.ids)))
        self.assertTrue(set(markup.refs).issubset(markup.ids))


if __name__ == "__main__":
    unittest.main()
