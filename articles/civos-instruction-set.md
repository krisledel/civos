# CivOS: an instruction set for accountable decisions

**Kris Ledel · September 2026**

A decision should leave enough evidence for somebody else to challenge it. The record should show what was believed, why it was believed, who chose to act, which objections remained, and what happened afterward. When that trail breaks, an institution can repeat a mistake while telling itself a story of continuous improvement.

CivOS begins with a testable proposition: preserving these relationships can make collective decisions easier to inspect and revise. The project asks a larger question about how institutions learn, but its present implementation is deliberately small: a local decision ledger, written in Python, with a synthetic example that anyone can inspect.

The distance between that prototype and the phrase “civilizational operating system” is substantial. Closing it would require evidence from actual use, workable institutions, and the participation of people affected by decisions. The name identifies the research ambition. It does not certify the result.

## Where a decision loses its reasons

Imagine a maintenance group considering a drainage inspection. An old drawing suggests the culvert has enough capacity. Residents report water backing up near its inlet. A reviewer concludes that the drawing is useful only if the inlet is clear. Another person raises an access problem for households beside the proposed work.

The group has several questions, not one. Is the capacity estimate applicable? What would an inspection establish? Who may approve it? Can people still reach their homes? A single confidence score would obscure those distinctions. A meeting minute saying “inspection approved” would discard most of the reasoning.

A useful record keeps each question identifiable. It connects evidence to the claim it concerns and records why a decision proceeds despite uncertainty. It also records what remains unresolved. The point of coordination is to make an accountable next move without pretending that every dispute has disappeared.

This drainage case is fictional. It is a design example, not a report of a deployment or a conclusion about climate adaptation.

## Five instructions

**State the claim.** Write something that can be assessed within a defined context. Identify the place, period, assumptions, and limits. “The culvert is adequate” is incomplete if adequacy depends on a particular flow estimate and an unobstructed inlet. A later reader needs those conditions to understand what the claim meant.

**Attach the evidence.** Keep the source, method, and limitations visible. An observation and an interpretation of that observation are different records. Two accounts based on the same underlying event do not automatically provide two independent confirmations. A source reference helps a reviewer locate evidence; it cannot guarantee the source is accurate or will remain available.

**Record the assessment.** A reviewer explains how the evidence bears on the claim. Supporting, disputing, and uncertain assessments can coexist. A regional model, a local observation, and a cost estimate answer different questions. Their relevance should be argued, not converted into an unexplained average. A minority assessment remains part of the decision trail.

**Make the decision accountable.** Record the action, responsible person, reasons, alternatives, objection, review date, success criteria, and stop condition. Participants must establish the decision-maker's mandate separately. The record helps expose an authority claim; the application does not authenticate it or confer permission to act.

**Return with the outcome.** Describe what was observed and what remains uncertain. Completing an inspection does not prove that the drainage problem is solved. A dry month does not demonstrate that maintenance prevented flooding. When evidence changes, record the correction and reconsider the affected conclusions. Silence after a deadline is missing feedback, not a successful outcome.

Together these instructions create a chain: claim, evidence, assessment, decision, outcome. The links matter as much as the individual documents. They let a reader move backward from an action to its reasons, or forward from a disputed observation to the decisions that relied on it.

## Three boundaries that cannot be automated away

The first is between **provenance and truth**. Provenance concerns where information came from and how it was produced. The [W3C PROV overview](https://www.w3.org/TR/prov-overview/) describes it as information used to assess quality, reliability, or trustworthiness. Such an assessment still has to be made. A precisely attributed false statement remains false. CivOS uses its own small record format and does not claim PROV compliance.

The second is between **difference and equivalence**. Research on cultural cognition describes variation in how people attend, reason, and explain. It does not establish that every conclusion is equally supported. [Bender and Beller's review](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2016.00509/full) is useful context for this distinction, not a validation of CivOS. A design should allow different accounts to meet without erasing their context or exempting their empirical claims from examination.

The third is between **procedure and legitimacy**. A perfectly documented decision may still exclude the people who bear its costs. Recording an objection is not the same as giving its author an effective right to challenge the decision. [Xin Xu's work on epistemic diversity](https://ora.ox.ac.uk/objects/uuid:b12dcaf2-f7bb-422c-af18-fd18a17f2019) draws attention to unequal relationships between knowledge traditions. For CivOS, this motivates a design question: who controls the categories, interpretation, and permission to share? A database cannot settle that question on their behalf.

These boundaries rule out a universal truth score, a ranking of people's worth as sources, and automatic conversion of a recorded recommendation into real-world action.

## What runs today

The repository contains a zero-dependency Python 3.10+ application using SQLite. It accepts structured records, validates their relationships, stores their history, exports JSON, and generates an HTML report. It operates on a local machine. It has no distributed network, authenticated identities, permission system, or autonomous execution layer.

Accepted records are immutable through the application's workflow. A correction can supersede an earlier record while retaining it. A later interpretation should not silently replace the evidence that was available at the time of a decision.

Each stored record participates in a SHA-256 hash chain. Verification detects an inconsistent chain. Comparing a copied or restored history with an independently retained expected head can reveal that it differs from the checkpointed history. These checks concern records, not their truth.

An operator who controls the database can rewrite the whole history and recompute its hashes. Without a trusted external checkpoint, the replacement may verify internally. Actor names and timestamps are also supplied data. They are not cryptographic proof of authorship or time. These limits belong in the specification, because omitting them would turn a useful check into a misleading promise.

After downloading the repository and entering its directory, run the following commands. The demo needs an empty database, and report output needs an unused filename; choose new paths when repeating the exercise:

```sh
python -m civos --db work/demo.sqlite3 demo
python -m civos --db work/demo.sqlite3 verify
python -m civos --db work/demo.sqlite3 report --as-of 2026-09-08T12:00:00Z --output work/report.html
```

The synthetic example retains a disputed capacity claim, an inconclusive inspection outcome, and an overdue access review with no recorded outcome. Those are deliberate states. A useful report must expose unfinished work without manufacturing closure.

## The experiment that would justify continuing

The next step is a controlled pilot against an ordinary document or spreadsheet. Select comparable low-stakes cases, use both methods, and vary their order. Ask someone who did not make each decision to reconstruct its basis, identify the responsible person, find the material objection, and locate the latest correction.

Measure accuracy and elapsed time. Include the time required to enter, review, and repair records. Count missing outcomes and interpretation errors, with denominators. Ask participants whether the account represents their contribution and whether they could effectively challenge it. Document who declined or could not participate.

Before starting, specify the minimum useful improvement, maximum acceptable burden, and conditions for stopping. If the ledger does not improve reconstruction enough to justify its cost, it fails for that setting. If it hides disagreement, discourages correction, or excludes affected participants, revise the process or abandon the trial. There are no measured pilot benefits to report here.

Only after demonstrating value in a bounded setting should the project attempt exchange between independent groups. Shared formats would introduce additional questions about authority, privacy, incompatible definitions, and contested histories. Each deserves an explicit protocol and its own evaluation.

The ambition is an institutional capacity to remember reasons and act on corrections. The immediate test is simpler: can another person examine this decision, understand the disagreement, and tell what should happen next?

The [CivOS repository](https://github.com/krisledel/civos) contains the code, technical limits, test suite, and contribution guide. Bring a case where the decision trail breaks, or a result that shows this approach is unnecessary. Either would move the project forward.
