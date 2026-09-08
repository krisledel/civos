# CivOS: an instruction set for shared inquiry and accountable action

**Kris Ledel · September 2026**

CivOS begins with a practical problem: a group can possess plenty of information and still be unable to explain how it reached a decision, whose interpretation prevailed, or what happened afterwards. The missing connection is often between different parts of the process. Observations lose their conditions. Concepts change meaning between groups. Reviews disappear into summaries. Decisions outlive the evidence that justified them.

The original CivOS architecture proposed five connected layers: perception, cognitive frames, trust, consequential action, and reflection on coordination itself. The web implementation now gives each layer an explicit place in the same working environment. It supports recording, comparison, review, decisions, outcomes, and changes to the rules governing those activities.

This is the software portion of a broader institutional proposal. A running application does not establish public legitimacy, factual truth, or a society's capacity to coordinate. Those require people, procedures, evidence, and scrutiny outside the application. The implementation makes their recorded claims and relationships inspectable.

## A question that crosses all five layers

A fictional community workshop is considering an extra evening opening. Fourteen members say they would like to attend. Volunteers can staff one trial session but have not committed to a regular schedule. The members' question is whether opening times fit their lives. The volunteers' question is whether the proposed service can be delivered.

These perspectives meet at a proposed Tuesday evening. They do not thereby become equivalent. An expression of interest is different from a confirmed booking. A staffed evening is different from a well-attended evening. If the group collapses them into a single positive score, it loses information it will need when the trial fails to meet its target.

In CivOS the group can retain these distinctions, approve a bounded trial, assign responsibility, count attendance, and revise its procedure. Suppose eight people attend against a target of twelve. The application shows the missed target. Participants then decide whether future proposals should distinguish survey interest from confirmed attendance. This example is synthetic. It reports no deployment or measured benefit.

## 1. Observation carries its context

The first layer connects an observation to its source, time, place, method, uncertainty, and relevant perspective. An entry identifies whether it is an observation, interpretation, forecast, or value judgment. These labels help a reviewer understand the kind of claim being made; selecting one does not certify it.

Sources retain their address, collection method, limitations, and common origin. If several documents reproduce the same survey, the group can identify that shared origin. Counting documents without examining their relationship would exaggerate the evidence.

Documents can be attached to the workspace and linked to source records by identifier and SHA-256 digest. A digest lets someone compare file contents. It cannot establish whether the source observed an event accurately.

## 2. Perspectives keep their meanings

A perspective describes what it pays attention to, how it investigates, what it assumes, where it applies, and what it misses. Concepts belong to a perspective and retain a definition and examples.

A mapping connects two concepts through an explicit relation: overlapping, narrower, broader, incompatible, or equivalent within a stated scope. It also records what the translation loses and why the proposed relation is defensible. The workshop's desired opening time and staffed opening time can overlap without becoming synonyms.

These records create something participants can challenge. They do not automatically translate language, infer an ontology, or resolve a cultural disagreement. A contested mapping can receive its own assessment, just as an empirical observation can.

## 3. Trust is a record of judgments and responsibilities

An assessment identifies its target, stated reviewer, perspective, conclusion, method, evidence, interests, and reservations about independence. Support, objection, and uncertainty remain separate conclusions. Several reviews can disagree without being averaged into a universal credibility score.

The system distinguishes the account that entered a record from a participant described inside it. A participant record may state an organisational role or a field of knowledge. That statement is not an authenticated credential and confers no access rights.

Workspace roles govern actual application access. Owners manage membership, rules, and the local record of recognised or revoked node keys. Editors register material and revise their own records. Reviewers contribute assessments, arguments, and outcomes. Readers inspect and export the material they can access. Owners may also revise another contributor's record, with the earlier version retained.

The configured number of reviewer accounts is a procedural requirement. Multiple accounts do not prove independent expertise. The same distinction applies to representation: an argument attributed to a group does not prove that the group authorised the speaker.

## 4. Decisions return to observable consequences

An option identifies a proposed action, its observational basis, expected benefits, costs, and reversibility. Arguments state support, opposition, or conditions, with references to the material being discussed.

Before accepting a decision, the application checks the current rule, the required number of registering reviewer accounts for every observation in the selected option's basis, and arguments from required groups. It requires a future review date. A decision also records its owner, claimed authority, rationale, accepted uncertainty, unresolved objections, measurable target, and stopping condition.

Passing these checks does not establish a right to act. The application records a mandate claim; the responsible organisation must establish the mandate itself. An outstanding objection can remain visible when a decision proceeds.

Tasks connect implementation to an owner and deadline. Outcomes record the observed value, unit, measurement method, sources, limitations, and next step. The unit must match the decision's target, and the measurement cannot predate the recorded decision. The application compares values using at least, at most, or exactly. It does not infer that the decision caused the observed result.

## 5. The process can examine and revise itself

The coordination view exposes observations without assessments, unresolved objections, missing group contributions, overdue tasks, absent follow-up, missed targets, and references to superseded material. These findings identify records needing attention. They do not diagnose an institution's overall health.

Participants can propose a rule change and connect it to the cases, assessments, decisions, or outcomes that motivated it. The owner records acceptance or rejection. Acceptance creates a new rule version. Subsequent decisions must use that version, while earlier decisions retain their original references.

This closes a practical loop: evidence informs action; outcomes inform a review of the process; the process changes through a recorded decision. The loop remains open to criticism because neither the old evidence nor the old rules disappear.

## Models compute consequences of stated assumptions

The computational workbench connects registered options and perspectives to explicit affine equations, input bounds, and hard constraints. Each perspective defines its own score scale. Higher scores are preferred within that perspective. The application keeps those scales separate and compares which options each perspective prefers.

Inputs are declared as evidence, assumptions, or value judgments. These categories belong to the author; the software does not infer or validate them. Moving a reference value explores a scenario. Recording a sourced measurement supplies a new interval. Neither action silently changes a perspective's values.

For an expression `f(x) = c + Σ aᵢxᵢ`, with each input bounded by `[lᵢ,uᵢ]`, the exact lower bound is `c + Σ min(aᵢlᵢ,aᵢuᵢ)` and the upper bound uses `max`. The uncertainty set is the entire Cartesian box. No probabilities or correlations are inferred. Comparisons operate on the difference between two score expressions before bounding it, so shared input terms cancel correctly.

An option receives a guaranteed-preference certificate when every modeled hard constraint holds throughout the box and its score is at least as high as every competitor the test has not proved impossible. This is a sufficient, conservative certificate; its absence does not prove that no acceptable option exists. Pointwise winners, including ties, are shown separately. The kernel also calculates exact switching boundaries while holding other inputs at their reference values, and sufficient measurement ranges that retain all other input uncertainty.

For example, two synthetic cost scores `80 - 8 * price` and `20 + 7 * price` tie at `price = 4`. Moving the reference value above 4 changes the pointwise preference. Narrowing the evidence interval to `[4.2,4.8]` establishes a preference throughout that interval. A separate hard constraint can still exclude the higher-scoring option. The [computational-model guide](civos-models.md) provides the complete two-perspective example, including a failed constraint and revision handling.

The `civos.affine.v1` implementation supports 1–8 inputs, 2–6 options, 1–4 perspectives and up to four constraints per option and perspective. It uses rational arithmetic for represented inputs, with rounded decimal display. Nonlinear expressions are rejected. A bounded parser, coefficient-precision budget, and exact-arithmetic limits constrain calculation size. These are standard affine and interval calculations; their integration with perspective-specific models, evidence versions, and decision history is the implemented contribution.

Saving an analysis records the exact model version, selected measurements, scenario, kernel version, and history-prefix hash and sequence. The server recalculates the stored summary; replay checks it again. New evidence can flag the analysis and attached decisions for review. Model, option, perspective, and source revisions preserve old references and block the earlier basis pending review. Conflicting measurements require an explicit choice. Saved analyses are immutable; a changed basis requires a new analysis.

A decision can attach a current local analysis containing its chosen option. The option must satisfy all modeled hard constraints at the saved reference values. The application does not require it to be preferred or guaranteed feasible across every bound; those judgments remain visible for the decision's rationale. Existing review, responsibility, working-rule, and follow-up requirements still apply.

## The complete record model

The implementation contains nineteen record types:

| Function | Types |
| --- | --- |
| Scope and participants | `case`, `actor` |
| Observation and provenance | `source`, `observation` |
| Interpretation | `frame`, `concept`, `mapping` |
| Computational models | `model`, `model_measurement`, `model_run` |
| Review | `assessment` |
| Deliberation and action | `option`, `argument`, `decision`, `task` |
| Feedback | `outcome` |
| Rules and their revision | `policy`, `rule_change`, `rule_resolution` |

A correction appends a new record referring to its predecessor through `supersedes`. The old record remains. References made by older decisions continue to point to the evidence used at the time. A later correction therefore creates a reason to reconsider affected decisions, rather than silently rewriting their history.

## Exchange without automatic agreement

A workspace can export its record history in a canonical JSON bundle signed with the node's Ed25519 key. The receiver verifies the format, public-key fingerprint, signature, record hashes, and references. The signature covers the node's export envelope. It is not a personal signature by each participant.

Import creates an isolated, read-only branch. It does not overwrite another workspace or grant imported accounts local permissions. A local continuation preserves the source history and establishes its own membership and rule. New decisions require local re-examination; assessments imported from the source do not automatically satisfy the local review requirement.

The local trust register records a key fingerprint, domain, status, and reason. A mathematically valid signature and a recognised source are distinct conditions. Where identity matters, the receiver needs an independently known way to confirm the fingerprint.

The bundle carries records, not attachment files, membership permissions, or the local trust register. File references and digests can survive the transfer even when the files themselves are absent. Necessary files must be transferred separately and checked.

This mechanism enables manual exchange and independent continuation. It provides no automatic federation, conflict merger, or decentralised consensus. A node operator who controls the database and private key can produce a newly signed replacement history. Independently retained exports provide a basis for comparison; they do not make the operator infallible.

## Run the current implementation

The web application lives in `web/` and requires Node.js 22.13 or later. From the repository root:

```sh
cd web
npm ci
npm run setup:key
npm run db:migrate
npm run dev
```

The key setup command creates the private JWK used for node signing in the ignored `.dev.vars` file as `CIVOS_SIGNING_KEY`. Database migrations initialise the local D1 store. The application also uses the `ATTACHMENTS` object-storage binding. Use the local page's sign-in flow; the development identity is for testing. Hosted private access uses the deployment platform's authentication.

Run `npm run typecheck` and `npm run build` to check the code and production build. The installation guide describes the full trial, including deliberate review failures, a missed target, rule revision, export, and a new local branch.

The Python program in `civos/` remains the earlier **0.2 command-line prototype**. Its five-record ledger, HTML report, and JSON format are separate. Running its demo does not launch this web application, and its exports are not automatically converted into web workspaces.

The test of CivOS is whether people can use the complete process to understand and correct their work at a tolerable cost. Compare it with existing notes or issue tracking. Measure reconstruction errors, time, correction effort, retained objections, and missing outcomes. Record who could participate and who could not. A successful build proves that software can run. Its institutional usefulness still has to be demonstrated.

[Code and documentation](https://github.com/krisledel/civos).


Operational limits: at most 1,900 entries and 1.5 MB of canonical record history per workspace; a transfer file is limited to 2 MB and each attachment to 5 MB. Case IDs are stable: cases cannot be revised. Re-exporting a read-only import preserves its original envelope and signature. A local continuation exports signed lineage metadata (base head, base sequence, source node, source key fingerprint and original envelope hash). The original receipt is retained locally.
