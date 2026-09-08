import hashlib
import json
import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from threading import Barrier
from unittest.mock import Mock

from civos.ledger import EMPTY_HEAD, IntegrityError, Ledger, ValidationError, canonical_json, event_hash


def claim(identifier="c1"):
    return dict(id=identifier, kind="claim", author="Kris Ledel", created_at="2026-09-08T08:00:00Z",
                statement="Mätbar förbättring.", context="A bounded trial.", assumptions=[], limitations=[])


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "ledger.sqlite3"
        self.ledger = Ledger(self.path)

    def tearDown(self):
        self.ledger.close()
        self.directory.cleanup()

    def alter(self, sql, values=()):
        with closing(sqlite3.connect(self.path)) as connection, connection:
            connection.execute(sql, values)

    def test_empty_append_reopen_export_and_hash_recipe(self):
        self.assertEqual(self.ledger.verify(), {"valid": True, "count": 0, "head": EMPTY_HEAD})
        source = claim()
        event = self.ledger.append([source])[0]
        body = json.dumps({"seq": 1, "prev_hash": EMPTY_HEAD, "record": source},
                          sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        self.assertEqual(event["hash"], hashlib.sha256(body.encode("utf-8")).hexdigest())
        source["statement"] = "changed in memory"
        self.assertEqual(self.ledger.records(), [claim()])
        self.ledger.close()
        with Ledger(self.path) as reopened:
            self.assertEqual(reopened.export(), {"format": "civos-ledger-v1", "events": [event]})

    def test_atomic_batch_duplicate_id_and_forward_reference(self):
        self.ledger.append([claim()])
        checkpoint = self.ledger.verify()
        for batch in [[claim("c2"), claim()], [claim("c2"), claim("c2")],
                      [claim("c2") | {"supersedes": "c3"}, claim("c3")], [], {},
                      [claim("c2"), claim("bad id")]]:
            with self.subTest(batch=batch), self.assertRaises(ValidationError):
                self.ledger.append(batch)
            self.assertEqual(self.ledger.verify(), checkpoint)
        self.ledger.append([claim("c2"), claim("c3") | {"supersedes": "c2"}])
        self.assertEqual(self.ledger.verify()["count"], 3)

    def test_tampered_history_blocks_reads_writes_and_reopening(self):
        self.ledger.append([claim(), claim("c2")])
        self.alter("UPDATE events SET record_json=? WHERE seq=1", (canonical_json(claim("changed")),))
        for operation in [self.ledger.records, self.ledger.events, self.ledger.verify,
                          self.ledger.export, lambda: self.ledger.append([claim("c3")]),
                          lambda: Ledger(self.path)]:
            with self.assertRaises(IntegrityError):
                operation()
        with closing(sqlite3.connect(self.path)) as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM events").fetchone()[0], 2)

    def test_database_failure_rolls_back_already_inserted_batch_rows(self):
        real_connection = self.ledger._connection
        wrapped = Mock(wraps=real_connection)

        def fail_after_first(sql, rows):
            real_connection.execute(sql, rows[0])
            raise sqlite3.IntegrityError("deliberate mid-batch failure")

        wrapped.executemany.side_effect = fail_after_first
        self.ledger._connection = wrapped
        with self.assertRaises(IntegrityError):
            self.ledger.append([claim(), claim("c2")])
        self.ledger._connection = real_connection
        self.assertEqual(self.ledger.verify()["count"], 0)
        self.assertEqual(self.ledger.append([claim()])[0]["seq"], 1)

    def test_unrelated_database_is_rejected_without_mutation(self):
        other = Path(self.directory.name) / "other.sqlite3"
        with closing(sqlite3.connect(other)) as connection, connection:
            connection.execute("CREATE TABLE other_application_data(name TEXT)")
            connection.execute("INSERT INTO other_application_data VALUES ('untouched')")
        original = other.read_bytes()
        with self.assertRaises(IntegrityError):
            Ledger(other)
        self.assertEqual(other.read_bytes(), original)

    def test_existing_only_open_never_creates_or_initializes(self):
        missing = Path(self.directory.name) / "missing.sqlite3"
        with self.assertRaises(IntegrityError):
            Ledger(missing, initialize=False)
        self.assertFalse(missing.exists())
        for name in ["zero.sqlite3", "empty.sqlite3"]:
            target = Path(self.directory.name) / name
            target.touch()
            if name == "empty.sqlite3":
                with closing(sqlite3.connect(target)) as connection:
                    connection.execute("VACUUM")
            before = target.read_bytes()
            with self.assertRaises(IntegrityError):
                Ledger(target, initialize=False)
            self.assertEqual(target.read_bytes(), before)
        with Ledger(self.path, initialize=False) as existing:
            self.assertEqual(existing.verify()["count"], 0)

    def test_schema_tampering_blocks_open_reads_and_appends(self):
        for schema, cleanup in [
            ("CREATE TABLE unrelated(id TEXT)", "DROP TABLE unrelated"),
            ("CREATE TABLE sqliteXhidden(id TEXT)", "DROP TABLE sqliteXhidden"),
            ("CREATE TRIGGER unexpected AFTER INSERT ON events BEGIN DELETE FROM events; END", "DROP TRIGGER unexpected")
        ]:
            with self.subTest(schema=schema):
                self.alter(schema)
                for operation in [self.ledger.verify, lambda: self.ledger.append([claim()]),
                                  lambda: Ledger(self.path)]:
                    with self.assertRaises(IntegrityError):
                        operation()
                self.alter(cleanup)
        self.alter("DROP TABLE events")
        self.alter("CREATE TABLE events(seq TEXT PRIMARY KEY, record_json TEXT NOT NULL, "
                   "prev_hash TEXT NOT NULL, hash TEXT NOT NULL UNIQUE)")
        with self.assertRaises(IntegrityError):
            self.ledger.verify()

    def test_checkpoint_detects_truncation_and_valid_rewrite(self):
        self.ledger.append([claim(), claim("c2")])
        old_head = self.ledger.verify()["head"]
        self.alter("DELETE FROM events WHERE seq=2")
        self.assertTrue(self.ledger.verify()["valid"])
        for operation in [lambda: self.ledger.verify(old_head), lambda: self.ledger.records(old_head),
                          lambda: self.ledger.append([claim("c3")], expected_head=old_head)]:
            with self.assertRaises(IntegrityError):
                operation()
        current_head = self.ledger.verify()["head"]
        replacement = claim("replacement")
        self.alter("UPDATE events SET record_json=?, hash=? WHERE seq=1",
                   (canonical_json(replacement), event_hash(1, EMPTY_HEAD, replacement)))
        self.assertTrue(self.ledger.verify()["valid"])
        with self.assertRaises(IntegrityError):
            self.ledger.verify(current_head)

    def test_sequence_noncanonical_json_and_recomputed_invalid_record(self):
        self.ledger.append([claim(), claim("c2")])
        self.alter("DELETE FROM events WHERE seq=1")
        with self.assertRaises(IntegrityError):
            self.ledger.verify()
        self.alter("DELETE FROM events")
        self.ledger.append([claim()])
        self.alter("UPDATE events SET record_json=? WHERE seq=1", (json.dumps(claim()),))
        with self.assertRaises(IntegrityError):
            self.ledger.verify()
        invalid = claim() | {"extra": "unrecognized"}
        self.alter("UPDATE events SET record_json=?, hash=? WHERE seq=1",
                   (canonical_json(invalid), event_hash(1, EMPTY_HEAD, invalid)))
        with self.assertRaises(IntegrityError):
            self.ledger.verify()

    def test_checkpoints_validate_input_and_advance_atomically(self):
        for bad in ["bad", "A" * 64, 12, {"head": EMPTY_HEAD}]:
            with self.assertRaises(ValidationError):
                self.ledger.verify(bad)
        event = self.ledger.append([claim()], expected_head=EMPTY_HEAD)[0]
        with self.assertRaises(IntegrityError):
            self.ledger.append([claim("c2")], expected_head=EMPTY_HEAD)
        self.ledger.append([claim("c2")], expected_head=event["hash"])

    def test_concurrent_writers_produce_one_contiguous_chain(self):
        barrier = Barrier(6)

        def append(index):
            with Ledger(self.path) as ledger:
                barrier.wait(timeout=15)
                return ledger.append([claim(f"writer-{index}")])[0]

        with ThreadPoolExecutor(max_workers=6) as pool:
            events = list(pool.map(append, range(6)))
        self.assertEqual(sorted(event["seq"] for event in events), list(range(1, 7)))
        self.assertEqual(self.ledger.verify()["count"], 6)
        self.assertEqual({r["id"] for r in self.ledger.records()}, {f"writer-{i}" for i in range(6)})


if __name__ == "__main__":
    unittest.main()
