# Contributing to CivOS

CivOS currently implements a local decision ledger. Contributions should improve an observable behavior, clarify a design claim, or make a limitation easier to test. Read the [README](README.md), [technical overview](technical-overview.md), [philosophical basis](philosophical-basis.md), and [threat model](thedarkmirror).

## Run the project

Use Python 3.10 or later with SQLite support. The implementation uses the Python standard library; no package installation is required.

```sh
git clone https://github.com/krisledel/civos.git
cd civos
python --version
python -m unittest discover -s tests -v
python -m civos --db work/demo.sqlite3 demo
python -m civos --db work/demo.sqlite3 verify
python -m civos --db work/demo.sqlite3 report --as-of 2026-09-08T12:00:00Z --output work/report.html
```

On systems where the interpreter is named `python3`, use that command throughout. On Windows, `py -3` is another option if it selects Python 3.10 or later. Keep generated databases, reports, and exports in `work/`, outside the source and fixtures.

The demo requires an empty database, and report and export commands require unused output filenames. Choose new paths when repeating the exercise. The demonstration contains synthetic records. It is not a field result or a real decision to be executed.

## Submit a useful change

Fork the repository and work on a branch. Keep a pull request focused enough that a reader can assess the resulting behavior. Explain the problem, the change, and how you checked it. For a behavioral change, include a test of the relevant invariant or failure case. For a documentation correction, identify the inaccurate statement and verify the replacement against the implementation or a primary source.

Use the [repository](https://github.com/krisledel/civos) for issues and pull requests. No particular issue labels, review deadline, or formal voting process is promised. Repository maintainers decide what is merged; a merged contribution does not authorize a real-world pilot or decision.

## Bug reports

Include the Python version, operating system, exact command, expected behavior, actual output, and the smallest synthetic input that reproduces the problem. Say whether the database was new or already contained records. Do not attach private records, credentials, or identifying testimony.

For a hash-chain issue, distinguish three cases: an inconsistent chain, a mismatch with an independently retained expected head, and a rewritten but internally consistent history. Internal verification cannot by itself identify the third case.

## Implementation standards

Keep record validation, persistence, and presentation responsibilities clear. Preserve historical records when adding corrections. Reject invalid relationships explicitly and avoid partially applying an invalid batch. Handle input errors with messages that help a user repair the input.

Run the test suite above before submitting a code change. When changing the CLI, run the documented example and update its commands. When changing a report, inspect the rendered HTML for missing objections, misleading dates, and unescaped input. Do not add dependencies unless the benefit and installation cost are explained.

## Writing and evidence

Distinguish implemented behavior, design proposals, and empirical results. Cite primary sources for factual research claims, close to the claim they support. Do not infer that a general paper about cognition or governance validates CivOS. Label invented people, data, and outcomes as synthetic or fictional.

Keep provenance separate from factual truth and procedure separate from legitimacy. Describe objections fairly. Avoid universal truth scores, personal reputation rankings, and claims of distributed operation that the code does not implement.

Participation follows the [Code of Conduct](CODE_OF_CONDUCT.md). The repository's [LICENSE](LICENSE) states its licensing terms; do not introduce material you lack permission to contribute.
