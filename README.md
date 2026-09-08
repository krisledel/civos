# CivOS

**Kris Ledel**

CivOS connects evidence, competing perspectives, computational models, decisions, and observed outcomes. A group can state its assumptions as equations, find where its preferences diverge, test hard constraints, and see which measurements could change the result. Saved analyses remain linked to the exact evidence and model versions used in a decision.

The web application provides account access, persistent workspaces, 19 record types, version history, and signed exchange between separate branches. The computational kernel is `civos.affine.v1`.

## Try the computational workflow

Open **Models → Open synthetic example** in the application. The example creates a separate workspace with invented inputs, three energy packages, and two perspectives.

1. At the initial values, Cost prefers Flexible; Continuity prefers Reserve. Save the analysis.
2. Inspect the exact price threshold at `4`. Moving the reference value above it changes Cost's pointwise winner, while the full uncertainty interval remains unresolved.
3. Record a synthetic price measurement with bounds `[4.2,4.8]` and reference `4.5`. Reserve becomes guaranteed preferred in both perspectives. The earlier analysis is preserved and flagged.
4. Revise the stress assumption to `[3,4]`, reference `3.5`, and record the price interval for the new model version. Reserve now violates a hard constraint throughout the bounds. Balanced wins at the reference point, but it is not guaranteed preferred throughout all allowed prices.

See the [worked model guide](articles/civos-models.md) for every equation, result, measurement entry, and decision attachment. All example values are synthetic.

## What the kernel calculates

Each perspective defines a separate score expression and hard constraints for every option. Higher scores are better within that perspective. Scores are never averaged across perspectives.

- Exact affine bounds over a box of simultaneous input intervals, with shared variables retained in pairwise score differences.
- Feasible options and tied winners at the selected reference values.
- Conservative certificates for feasibility and weak preference throughout the full bounds.
- Exact switching points along one input, with the other reference values held fixed.
- Sufficient measurement ranges for a shared preference while retaining the other inputs' uncertainty.
- Decomposition of score differences into declared evidence, assumption, and value contributions.

Expressions allow constants, input names, addition, subtraction, multiplication by constants, and division by nonzero constants. Limits are 1–8 inputs, 2–6 options, 1–4 perspectives, and four constraints per option and perspective. Nonlinear expressions are rejected. Exact comparisons use rational arithmetic on the represented inputs; displayed decimals are rounded. Parser, model-size, coefficient-precision, and arithmetic limits reject oversized calculations.

Guarantees are conditional on the entered equations and bounds. The uncertainty box supplies no probability distribution and does not encode correlations. A missing certificate means this conservative test did not establish a result. It does not prove agreement impossible. Units and input categories are declared by the author; no dimensional analysis, source validation, causal inference, or institutional mandate is calculated.

## Evidence, review, and decisions

The five original layers are represented in the same case history:

| Layer | Implemented workflow |
| --- | --- |
| Observation | Sources, methods, origin, attachments, observations, categories, uncertainty, and measurements. |
| Perspectives | Frames, scoped concepts and mappings, explicit assumptions, and separate computational rules. |
| Review | Assessments, methods, stated interests, objections, and registering accounts. |
| Consequential action | Options, arguments, model analyses, decisions, owners, targets, tasks, and measured outcomes. |
| Reflection | Findings, changed evidence, missed follow-up, rule proposals, and new working-rule versions. |

A decision requires the current working rule, sufficient registering reviewer accounts for each observation in its option's basis, contributions from required groups, and a future follow-up date. It records responsibility, claimed authority, rationale, remaining objections, a target, and a stopping condition. Reviews can disagree when a decision proceeds.

A decision may attach a current saved analysis. Its selected option must satisfy all modeled hard constraints at the saved reference point. The application does not require the option to be preferred or feasible throughout all bounds. An imported analysis must be recalculated locally before attachment to a local decision.

New measurements can flag analyses and attached decisions for review. Conflicting measurements require an explicit choice. Model, option, perspective, and source revisions retain exact earlier references. A correction appends a record through `supersedes`; it does not rewrite previous results. Cases have stable IDs. Saved analyses are immutable and can only be followed by another analysis.

## Record model

The executable schema and validation are in [`web/lib/model.ts`](web/lib/model.ts). Computational semantics are in [`kernel.ts`](web/lib/kernel.ts), [`rational.ts`](web/lib/rational.ts), and [`kernel-records.ts`](web/lib/kernel-records.ts).

| Function | Record types |
| --- | --- |
| Scope and participants | `case`, `actor` |
| Evidence | `source`, `observation` |
| Interpretation | `frame`, `concept`, `mapping` |
| Review | `assessment` |
| Computation | `model`, `model_measurement`, `model_run` |
| Deliberation and action | `option`, `argument`, `decision`, `task` |
| Feedback | `outcome` |
| Rules | `policy`, `rule_change`, `rule_resolution` |

`model_run` identifies its model, selected measurements, scenario reference overrides, kernel version, history-prefix length and hash, and result summary. The server computes that summary and verifies it again during history replay. A modified result cannot pass validation merely by rebuilding the record hashes.

## Accounts and exchange

Owners manage workspace content, invitations, access, node trust, and rules. Editors register content and rule proposals and revise their own records. Reviewers contribute assessments, arguments, and outcomes. Readers inspect and export accessible content. A participant name inside a record grants no account permissions. Multiple accounts do not establish independent expertise or representative authority.

Exports use canonical `civos.bundle.v1` envelopes signed with the node's Ed25519 key. They include records, the chain head, public key, and signature. Import checks the signature, record chain, references, and computations, then creates an isolated read-only branch. Re-export preserves the original envelope. A local continuation retains provenance and receives its own access and working rule; local decisions require local review.

Exchange is manual. Automatic synchronization, branch merging, and decentralized consensus are not implemented. Signatures authenticate a key's export, not the truth of its contents or personal authorization by every participant. An operator controlling both the database and signing key can rewrite and re-sign history; independently retained exports provide checkpoints.

Record exports omit attachment bytes, membership, and the node-trust register. Back up the database, attachment storage, and signing key separately. Revising a record does not delete it from copies already shared.

## Run locally

Use Node.js 22.13 or later. From the repository root:

```sh
cd web
npm ci
npm run setup:key
npm run db:migrate
npm run dev
```

Open the printed localhost address and sign in. Development uses a local test identity. The private hosted installation uses platform authentication. Storage bindings are `DB` and `ATTACHMENTS`; `CIVOS_SIGNING_KEY` is the server's private Ed25519 JWK. The ignored `.dev.vars` file holds the local key. Keep it out of client code, Git, and shared archives.

With the local server running:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Use `npm run test:ci` when no development server is running; it starts and stops one. Tests cover exact arithmetic, constraints, certificates, saved analyses, changed evidence, decisions, replay, signed import/export, concurrency, and attachments. See the [installation guide](articles/civos-installationsguide.md) for the complete record workflow.

Operational limits are 1,900 records and 1.5 MB of canonical history per workspace, 2 MB per transfer file, and 5 MB per attachment. Additional accounts need both installation access and a workspace invitation.

## Repository and research

The separate Python 0.2 prototype in `civos/` uses SQLite, five record kinds, and an offline HTML report. Its unsigned export format is different from the web format and cannot be imported directly into the web application. Run its tests with `python -m unittest discover -s tests -v`.

- [Architecture and instruction set](articles/civos-instruction-set.md)
- [Computational models](articles/civos-models.md)
- [Installation and trial](articles/civos-installationsguide.md)
- [Knowledge, authority, and correction](philosophical-basis.md)
- [Pilot evaluation protocol](docs/pilot-protocol.md), originally scoped to the CLI prototype
- [Contribution guide](CONTRIBUTING.md)

This is working pilot software. No real-world organizational benefit or society-scale deployment is claimed. The next empirical test is whether another participant can reconstruct and challenge a decision more accurately, with an acceptable recording burden, than with the group's existing tools.

Code is MIT licensed. Texts and concepts are CC BY-SA 4.0. See [LICENSE](LICENSE).
