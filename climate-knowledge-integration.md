# Climate knowledge integration: a bounded worked example

**This entire case is fictional.** It describes a possible use of CivOS, not a field deployment, climate finding, community partnership, or measured benefit. All people, observations, costs, and outcomes are invented for explaining the method. The executable repository fixture provides a separate synthetic drainage example.

## Decision and scope

A small property maintenance group must decide whether to inspect and clear a courtyard drain before the next rainy period. Its budget permits an inspection and minor maintenance, but not redesign of the drainage network. Residents disagree about the cause of recent standing water.

This is a maintenance decision influenced by weather and local observations. A few observations do not establish a climate trend. The example does not determine emergency measures or the safety of a real building.

The group wants a record that survives beyond the meeting: the claim, the evidence used, the objections considered, the person responsible for the chosen action, and the later inspection result.

## Keep the evidence types separate

| Input | What it could support | What it cannot establish alone |
| --- | --- | --- |
| Resident's dated observation of standing water | Water was reported at a stated place and time | The cause, recurrence rate, or regional climate trend |
| Maintenance photograph with documented context | A visible condition at the photographed location | Conditions outside the frame or the state of buried pipes |
| Inspection note | Conditions encountered using the stated inspection method | A guarantee about the next storm |
| A regional forecast | A forecast for its stated area and period, with its uncertainty | What will happen in this particular courtyard |
| Contractor's estimate | An offer with stated scope and assumptions | An independent assessment of whether that work is necessary |

No input receives a universal score. A relevant source may be weak for one inference and strong for another. Reviewers explain the relationship instead of averaging unlike inputs.

For a real case, source rights and disclosure rules must be resolved before entry. Do not upload testimony, exact household locations, private photographs, or culturally restricted knowledge merely because they might improve the record. The local prototype does not enforce those boundaries.

## Construct the decision trail

### 1. Claim

“A partial blockage in the courtyard drain contributes to the standing water reported after recent rain.”

The claim is about a specified drain and period. It is provisional. Alternative explanations include an inadequate pipe, unusually heavy rainfall, or a reporting error. The group can inspect a blockage; it cannot test every hydrological explanation within its maintenance budget.

### 2. Evidence

The record references a fictional maintenance photograph and a fictional inspection note. It states where the sources came from and their limitations. An observer's account remains distinguishable from a coordinator's summary of it.

A broken source link does not make an earlier assessment disappear, but it limits what another reviewer can check. Record that loss explicitly. The ledger stores references and descriptions; it does not promise permanent access to external sources.

### 3. Assessment

One reviewer considers a blockage plausible enough to justify an inspection. Another argues that the pipe may be undersized and that clearing it might have little effect. Each assessment names its evidence and explains its scope.

These positions need not be compressed into one conclusion. The objection matters even if the group chooses the same immediate action. It changes what the inspection should look for and what a later outcome would mean.

### 4. Decision

The maintenance coordinator records a limited inspection and, if appropriate, minor clearing. The record states the coordinator's actual mandate, the chosen scope, the relevant assessments, and the reason for proceeding despite the capacity objection.

The coordinator also sets a review date and an observable question: was material obstructing the drain, and did the inspection reveal a problem beyond the authorized maintenance scope? A report that work was completed answers a different question from whether flooding risk was reduced.

CivOS stores this decision. It does not appoint the coordinator, check their mandate, purchase services, or instruct equipment. Those actions remain manual and outside the application.

### 5. Outcome and correction

Suppose the fictional inspection finds debris and also identifies uncertainty about the pipe's condition. The outcome records both. It does not declare the original claim fully proven or attribute later dry weather to the maintenance.

If the original photograph was misdated, add a correction that supersedes the earlier evidence record. Reassess any conclusion that depended on that date. Preserve the original so a reader can understand why the first decision was reasonable or unreasonable at the time.

## What integration means here

Integration means connecting records while preserving their origins, limits, and differences. It does not mean collecting all knowledge into a central database or converting every contribution into a scientific measurement.

For a pilot involving knowledge held by a community, that community must decide who may share it, who may interpret it, and what must remain outside the record. If those conditions cannot be met, exclude that material or choose a different pilot. The database cannot grant permission on a custodian's behalf.

A transparent record can still describe a decision that affected people had no power to influence. Evaluate participation and appeal separately from record completeness. A tidy trail is no substitute for a legitimate process.

## Evaluation before expansion

Use a controlled, low-stakes exercise before considering a real maintenance workflow. Prepare comparable fictional cases: some with corrected evidence, some with unresolved objections, and some with missing outcomes. Have participants use the current notes or spreadsheet for one set and CivOS for the other. Vary the order to reduce learning effects, and record any differences in case difficulty.

Measure:

- Time and accuracy when an independent reviewer identifies the decision's basis, responsible person, and next review date.
- Whether the reviewer finds the objection and the superseded evidence without assistance.
- Time spent entering, checking, correcting, and exporting the record.
- Unresolved interpretation errors and missing outcomes, using explicit counts and denominators.
- Whether participants can recognize and challenge how their contribution is represented.

Before the exercise, agree what improvement would justify the extra work and which failures would stop the pilot. Report both conditions with the result. If the ledger increases recording effort without a useful retrieval benefit, or if its structure repeatedly conceals the central objection, the proposed workflow has failed that test.

The prototype's automated checks establish properties of records and their links. They cannot establish climate validity, causal impact, inclusion, or improved decision quality. Those require appropriate evidence and evaluation beyond a software test.

## Next steps

Start with the [README](README.md) for executable commands. Use the [technical overview](technical-overview.md) to inspect the data model and the [threat model](thedarkmirror) to decide what the prototype can safely test. Submit a reproducible example or a concrete objection through the [repository](https://github.com/krisledel/civos).
