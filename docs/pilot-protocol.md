> This protocol describes the CivOS 0.2 CLI pilot. For the complete web workflow, see ../articles/civos-installationsguide.md.

# A test that CivOS can fail

**Question:** Does an explicit record of claims, evidence, dissent and follow-up make a small group's decisions easier to inspect and correct, at an acceptable administrative cost?

This is a proposed evaluation. No trial has been conducted and no improvement is claimed.

## Scope and roles

Use a voluntary, low-stakes process with reversible decisions. Select the scope, duration, comparison method and stopping rules before collecting data. Avoid decisions about personal eligibility, emergency response, medical care or legally binding entitlements in this first experiment.

Name a decision owner, a record custodian and a reviewer who did not write the decision. Agree who may enter records, how participants challenge them, who may approve corrections to someone else's evidence, and how dissent remains visible. The software does not enforce these roles.

Use synthetic or non-sensitive operational records initially. Establish consent and retention rules before adding participant material. An append-only history makes later removal and corrections to distributed copies difficult; withdrawal does not delete an export.

## Comparison

Use ordinary minutes or an issue tracker as the baseline. Define comparable tasks and assign them between the baseline and CivOS conditions where feasible. If the same people use both methods, vary the order and record learning effects. With a small sample, report descriptive results and limitations; do not infer a general civilizational effect.

Ask a reviewer, given only the resulting record, to reconstruct each decision's evidence, assumptions, dissent, owner and follow-up. Score against a separately prepared case record, not the presence of fields alone. Empty or uninformative entries must not count as successful traceability.

## Measures

| Measure | Operational definition |
| --- | --- |
| Reconstruction accuracy | Correctly recovered required facts divided by all required facts in the case record |
| Reconstruction time | Minutes to complete the same review task |
| Correction time | Time from a known challenge to a documented response |
| Dissent retention | Material objections recoverable by the reviewer divided by objections recorded separately |
| Follow-up rate | Decisions with an inspectable outcome by their deadline divided by decisions with elapsed deadlines |
| Entry burden | Participant minutes spent creating, reviewing and correcting records |
| Participation cost | Who could not or would not contribute, and the stated reason |

Report denominators, missing data, task differences and participant counts. Do not turn the measures into a composite credibility score. A fast decision may be poor; a longer correction interval may reflect a harder problem.

## Failure criteria

Before the pilot, agree the largest tolerable additional entry burden and the smallest reconstruction improvement that would justify it. Stop or revise the design if reviewers cannot recover material dissent, if participants cannot challenge attribution, if entries become ceremonial filler, or if administrative cost exceeds the agreed limit without useful gains.

Also test operational failure: interrupt an import, restore an export, compare an independently saved checkpoint, revise a claim, and inspect whether an earlier decision still shows its original basis. Software tests do not substitute for the process comparison.

## Results record

Publish methods, aggregate results, observed failures and the next decision. Keep personal data out of public outputs. Record whether to continue, narrow, change or stop, who made that decision, and what evidence would reverse it. Expansion depends on measured usefulness in the process CivOS actually supports.
