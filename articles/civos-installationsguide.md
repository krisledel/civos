# CivOS: install and test the complete workflow

**Kris Ledel · September 2026**

The web version of CivOS connects evidence, perspectives, review, deliberation, decisions, implementation, outcomes, and changes to working rules. You use forms in the browser. Records are saved on the server and can be reviewed from other accounts with assigned access.

This guide covers the web version in the `web/` directory. The Python program in `civos/` is the earlier 0.2 prototype. Its commands create a local decision ledger and an HTML report. They do not launch the web version, and its JSON exports cannot be imported directly here.

## 1. Install dependencies, the key, and the database

You need Node.js 22.13 or later. Get the version of the [repository](https://github.com/krisledel/civos) that contains `web/`, or unpack the delivery package. Open a terminal in the repository root and run:

```sh
node --version
cd web
npm ci
npm run setup:key
npm run db:migrate
npm run dev
```

`npm ci` installs the versions in the lockfile. `setup:key` creates a private Ed25519 key in JWK format as the value of `CIVOS_SIGNING_KEY` in `web/.dev.vars`. The server uses the key to sign export bundles. The private key must stay there; the export contains the public key.

`.dev.vars` is a local, ignored file. Do not put it in version control, client code, or a shared package. Keep the same key if you want a local installation to retain its fingerprint over time. An intentional key change creates a new fingerprint that recipients need to check.

`db:migrate` runs the migrations against the local D1 database through `wrangler.local.json` and the `DB` binding. The command uses local mode. Attachments are stored through the `ATTACHMENTS` binding. The local database and object storage contain development data, not a copy of a hosted installation.

Open the address printed by `dev` and use the page's sign-in flow. The development environment provides a local test identity. A private deployment uses the hosting platform's authentication. Do not expose the development server as a public service; the local test identity is not a production sign-in.

Also check types and the production build from `web/`:

```sh
npm run typecheck
npm run build
```

An installation without `CIVOS_SIGNING_KEY` cannot create signed exports. An error about missing tables means that the local database needs the correct migrations. Save the error message and resolve the underlying problem before continuing the trial.

## 2. Create the workspace and understand access

Create a workspace with a clear purpose, such as “Test an extra evening opening at the community workshop.” The account that creates the workspace becomes its owner. An initial working rule is created with a requirement for one reviewer account, no required groups, and a maximum follow-up period of 30 days.

There are four account roles:

| Role | What the account can do |
| --- | --- |
| Owner | Manage content, rules, invitations, access, and node trust. Revise their own and other contributors' records while preserving history. |
| Editor | Register content and rule proposals, and revise their own records. |
| Reviewer | Register assessments, arguments, and outcomes, and revise their own records of these types. |
| Reader | Read and export content without changing the original workspace. |

The owner can create an invitation code for one of the other three roles. The code is valid for 24 hours and can be used once. Give it to the intended participant through a channel you already use.

A participant record is different from an account. It describes a name, role, groups, fields of knowledge, and interests. The name in the record grants no permissions. When an assessment is registered, the system also records which signed-in account entered it. These registering accounts are counted toward the decision rule's review requirement.

## 3. Record a synthetic case across all layers

Use the following invented case. It makes no claim about a real organisation:

> Fourteen of twenty responding members want the workshop to open on Tuesday from 18:00 to 20:00. Two volunteers can staff one trial session. The group is considering a single evening trial with a target of at least twelve actual visitors.

Create the case and list “Members” and “Volunteers” as affected groups. Add a participant record for each group. State that the people and details are test data.

Create two perspectives. The first concerns members' access to the premises and uses survey responses. The second concerns available staffing and uses the volunteers' schedule. For each, state what the method can show and what it misses.

Add the concepts “desired opening time” and “staffable opening time” to their respective perspectives. Create an overlapping relation between them, limited to the trial week. Explicitly state that preferences are not binding bookings and that staffing does not guarantee attendance.

Then create two sources: a synthetic survey and a synthetic staffing schedule. Their addresses can be `urn:civos:test:verkstad:enkat` and `urn:civos:test:verkstad:bemanning`. Give them different common-origin identifiers because they describe different test material. If you add several copies of the same survey, those copies should share the same origin.

Register the observations with the correct source and perspective. Record time, place, and uncertainty. A measurement, an interpretation, a forecast, and a value judgment belong to different categories. Use the category that matches what you are actually claiming.

## 4. Test the review rule

Register the option “Run one trial session.” Link it to both observations. State the benefit of measuring actual attendance, the cost of four volunteer hours, and that the trial ends after that single evening.

Try to register a decision before the observations have been reviewed. It should be rejected. Then assess each observation and record the method, conclusion, evidence, interests, and reservations. A reviewer can support the accuracy of the survey summary while remaining uncertain about what it says about actual attendance.

If you test a rule requiring two reviewer accounts, two separate accounts must register an assessment of every observation in the option's evidence basis. Two different participant names entered from the same account are not enough. In turn, two accounts do not prove that the reviewers are independent people or experts; your working process must address that.

Add an argument from the members in favour of the trial and a condition from the volunteers: no automatic recurring opening. If the working rule requires these groups, the decision should be rejected until arguments from both have been registered. The representation check uses the group that the named participant is stated to represent. The application does not verify the person's mandate from that group.

An assessment marked “Objects” or “Uncertain” does not disappear when a decision is registered. The requirement is for documented review. It does not require everyone to reach the same conclusion.

## 5. Make the decision and record the outcome

Select the trial session as the option and assign a responsible participant. Describe the mandate claimed to authorise the group to organise the trial. Explain the decision while keeping the remaining uncertainty visible.

Set a future follow-up date, for example seven days from now. Set the indicator to “Number of unique visitors,” the target condition to “At least,” the target value to `12`, and the unit to `personer` (people). Add a stopping condition: cancel the trial if fewer than two volunteers can staff it. Select the current working rule.

Create a task with an owner, deadline, and status. In a synthetic test, you can then register an invented outcome of `8` people with its own source. The measurement time must follow the recorded decision. Use exactly `personer` as the unit here as well.

Check that the overview shows the target was not met. Revise the task's status to done and state where its follow-up is recorded. Completing the task does not mean the target was met. An outcome below the target does not prove why it fell short.

## 6. Change the rule based on what happened

Create a change proposal linked to the decision and outcome. Describe the problem: expressed interest was used to estimate actual attendance. Propose that future cases report survey responses and confirmed bookings separately. Specify the desired number of reviewer accounts, required groups, and maximum follow-up period.

The owner can accept or reject the proposal with a rationale. Acceptance creates both the rule resolution and a new version of the working rule. Check that a new decision requires the new version. The first decision should still show the rule that applied when it was registered.

Corrections are made through revision. A new record refers to its predecessor with `supersedes`. The old record remains, and earlier references do not change. When an observation is revised, someone reviewing an older decision should be able to see that its evidence has changed.

## 7. Export, import, and continue locally

Export the workspace to a signed JSON file. The bundle contains the record history and details of the node, workspace, export time, hash-chain head, public key, and signature. It does not contain the node's private key. The signature covers the node's export envelope, not personal signatures from participants.

Import the file without changing its content or formatting. The recipient checks the format, public key, fingerprint, Ed25519 signature, record hash chain, and references. A successful import creates a separate read-only branch containing the received history.

Compare the key's fingerprint with the sender through a separate, known channel if you need to establish who the sender is. A valid signature means that the corresponding key signed the bundle. It does not mean the content is true, the organisation has a mandate, or the review was independent. The workspace owner can document recognised and revoked keys with a domain and rationale.

Create a local continuation of the import when you want to work further. It gets its own access permissions and a local working rule. Imported permissions are not carried over. Register local assessments before new decisions; previously imported assessments do not automatically satisfy the new branch's local review requirement. Try making a decision before local review exists and check that it is rejected.

Exports contain records, not attachment files, membership permissions, or node trust registers. An imported source may therefore show an attachment reference even when the file is absent from the new node. Share necessary files separately, compare their SHA-256 digests, and record their local availability. The export is not a complete operational backup.

The branches remain separate. CivOS does not synchronise them automatically or determine which branch is right. New information, conflicts, and continued cooperation require local review and further transfers.

## Record types in this installation

| Record | Purpose |
| --- | --- |
| `case` | Define the question, context, and affected groups. |
| `actor` | Describe participants, responsibilities, groups, and interests. |
| `source` | Record a source, method, origin, limitations, and attachment reference. |
| `observation` | State a claim with its category, evidence, perspective, and uncertainty. |
| `frame` | Describe a perspective's method, assumptions, and limitations. |
| `concept` | Define a concept within a perspective. |
| `mapping` | Relate two concepts with scope, translation loss, and rationale. |
| `assessment` | Review an observation, concept mapping, option, or outcome. |
| `option` | Describe an action option's basis, benefits, costs, and reversibility. |
| `argument` | Document support, opposition, or conditions for an option. |
| `decision` | Record the choice, responsibility, mandate, uncertainty, target, and rule version. |
| `task` | Track implementation, owner, deadline, and status. |
| `outcome` | Record a measured value, evidence, limitations, and next step. |
| `policy` | Define the working rule and its procedural requirements. |
| `rule_change` | Propose a rule change based on specific experience. |
| `rule_resolution` | Accept or reject the change proposal with a rationale. |

Fields and validation are defined in `web/lib/model.ts`. Storage, access checks, and local branches are in `web/lib/store.ts`; bundle signing and verification are in `web/lib/bundles.ts`.

## What the trial demonstrates

The trial shows whether the complete workflow can be carried out and whether its intended constraints work. It does not show that CivOS improves decisions in a real organisation. That requires comparison with the way you already work.

Ask someone who did not write the decisions to find their evidence, objections, responsible person, latest revision, target, and outcome. Measure both accuracy and time. Also count the cost of entering and reviewing records. Document whether participants could object and whether any affected group was absent.

A legitimate mandate, factual truth, and decentralised consensus do not arise automatically in a database. CivOS makes it possible to document and examine such claims. The people and organisations using the system are responsible for what those claims mean in practice.

Operational limits: at most 1,900 entries and 1.5 MB of canonical record history per workspace, 2 MB per transfer file, and 5 MB per attachment. Cases have stable IDs and cannot be revised. Re-exporting a read-only import preserves the original envelope and signature. A local continuation exports signed lineage metadata: the base head and sequence, source node, key fingerprint, and original envelope hash. The original receipt is retained locally.
