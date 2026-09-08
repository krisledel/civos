# CivOS: knowledge, authority, and correction

CivOS is a research and design project about the connection between reasons, decisions, and consequences. Its working hypothesis is that a group can make decisions easier to inspect and revise if it preserves the path from a specific claim, through evidence and assessment, to an accountable decision and an observed outcome.

The hypothesis concerns an institutional practice. The current implementation tests a small part of it: a local record system. Neither the hypothesis nor the software establishes that a decision is true, fair, or legitimate.

## The problem to investigate

Consider a maintenance team approving drainage work. A forecast, a resident's observation, and a contractor's estimate may all influence the decision. Minutes record the approved work. The reasons for rejecting a cheaper option remain in a private message. Three months later, nobody can tell whether the original concern was resolved or merely displaced.

CivOS calls this a broken decision trail. The proposed remedy is to retain enough context to answer five questions:

1. What claim was the decision based on, and within which limits?
2. Which evidence supported or challenged it?
3. Who assessed that evidence, using which criteria?
4. Who chose an action, under what authority, and despite which objections?
5. What happened, and what would justify changing course?

These questions are useful only if answering them costs less than the confusion, rework, or avoidable harm they prevent. That is an empirical question for a pilot.

## Distinctions the design must preserve

### Provenance and truth

Provenance describes origins and transformations: who supplied an observation, which source it refers to, and what happened to it. A well-documented measurement can still use a faulty instrument. An accurately attributed statement can still be false. An honest witness can misremember.

CivOS therefore records evidence and assessments separately. A hash protects a relationship between bytes; it does not validate the world described by those bytes. The project does not calculate a universal truth score or a reputation score for people.

### Evidence and authority

A forecast can inform a decision about flood protection. It cannot decide which households should bear the cost. Technical expertise, affected people's rights, resource constraints, and lawful authority answer different questions.

Recording an authority claim does not authenticate it. A decision record must say who made the decision and why they believed they were entitled to make it. Participants must establish and, where necessary, contest that authority outside the software. A complete procedure can still serve an illegitimate institution.

### Disagreement and error

Two accounts can disagree because they concern different locations, times, definitions, or values. They can also disagree because one is mistaken. Respect for participants does not require treating every empirical claim as equally well supported.

Assessment should expose these differences. A resident's report of water inside a basement is evidence about that basement. It does not directly establish a regional rainfall trend. A regional forecast does not disprove that report. Translation between the two requires an explicit bridge, with an opportunity for the source to correct it.

An objection must remain visible even when a decision proceeds. Agreement is neither a required output nor a substitute for reasons.

### Revision and erasure

In the application, a correction is a new record that can supersede an earlier one. The original remains available. Readers should be able to reconstruct what was known when a decision was made, rather than mistake the latest interpretation for the original rationale.

This persistence creates a data responsibility. The prototype has no consent workflow, access control, or selective erasure mechanism. Sensitive testimony and identifying information do not belong in an experimental ledger. Store only material suitable for retention and sharing; keep protected source material in an appropriate system under its custodian's control.

## What the name commits us to

“Civilizational operating system” names a long-term question about how institutions organize knowledge and collective action. It is not a description of a deployed system, and it does not make societies equivalent to computers. Institutions contain conflicting obligations, coercive powers, histories, and relationships that cannot be reduced to a schema.

The project should earn broader claims through increasingly demanding tests. A useful decision log would be one result. Shared formats between independent groups would be a separate achievement. Distributed trust, representation, and legitimate authority would require additional research and institutions. They are not properties obtained by adding a database or cryptography.

## A falsifiable research programme

Begin with a voluntary, reversible, low-stakes decision. Compare CivOS with the group's existing notes or spreadsheet, using comparable cases and the same questions. Measure retrieval accuracy, reconstruction time, correction handling, retained objections, and recording effort. Describe recruitment and missing observations so that an apparently successful pilot cannot conceal who was excluded.

Set a minimum useful improvement and a maximum acceptable burden before collecting results. Assign someone who did not make the decision to reconstruct its rationale. Record unsuccessful attempts and unresolved disputes. A missing outcome is missing data, not evidence of success.

The hypothesis fails for that setting if CivOS does not improve reconstruction enough to justify its cost, if participants cannot correct their representation, or if the format systematically hides material disagreement. Stop or redesign when those conditions occur. A polished demonstration cannot answer these questions.

## Present implementation

The repository contains a Python 3.10+ prototype using SQLite and the standard library. It stores five record kinds: claim, evidence, assessment, decision, and outcome. It can check its record chain, export data, and produce a readable report. It runs locally. Human participants remain responsible for review, authorization, and action.

The hash chain detects changes relative to a trusted earlier checkpoint. An operator who controls the database can rewrite its contents and recompute the whole chain; a verifier using only that rewritten database cannot recover the original. Preserve checkpoints independently when testing this property.

Read the [technical overview](technical-overview.md), [threat model](thedarkmirror), and [fictional climate example](climate-knowledge-integration.md) before using the prototype in a pilot.

## Research context

The following works help frame questions, not validate CivOS:

- [W3C PROV overview](https://www.w3.org/TR/prov-overview/) provides a vocabulary for describing provenance. CivOS's present schema is its own small format; PROV compatibility is not claimed.
- [Star and Griesemer, *Institutional Ecology, “Translations” and Boundary Objects* (1989)](https://doi.org/10.1177/030631289019003001) examines cooperation across social worlds. It motivates attention to translation without assuming everyone must share one interpretation.
- [Ostrom, *Beyond Markets and States: Polycentric Governance of Complex Economic Systems* (2009)](https://www.nobelprize.org/prizes/economic-sciences/2009/ostrom/lecture/) informs the distinction between locally workable arrangements and a universal governance design.
