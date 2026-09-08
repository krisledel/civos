# CivOS web application

Kris Ledel

Case workspace for evidence, perspectives, explicit affine models, review, decisions, outcomes, and working-rule revisions. The Models view supports live scenarios, exact thresholds, hard constraints, measurements, and saved analyses linked to decision history. See the [model guide](public/articles/civos-models.html).

## Local development

Use Node.js 22.13 or later:

```sh
npm ci
npm run setup:key
npm run db:migrate
npm run dev
```

Open the printed localhost URL and choose Sign in. Development provides a local test identity. Production requires an authenticating ingress that supplies stable identities and strips client-supplied identity headers; the private hosting platform provides it.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` runs kernel, record-replay and API integration checks against an existing localhost server. `npm run test:ci` starts and stops the server itself. Tests create synthetic workspaces and cover the computational workflow, exact arithmetic, evidence changes, decision checks, history, signatures, imports, concurrency, and attachments.

## Runtime

`DB` binds D1; `ATTACHMENTS` binds R2. Apply migrations in `drizzle/` before use. `CIVOS_SIGNING_KEY` is a private Ed25519 JWK configured as a runtime secret. The local `.dev.vars` file is ignored. Back up the database, attachments, and key separately; record exports are not complete operational backups.

Limits: 1,900 records and 1.5 MB of history per workspace, 2 MB per import, and 5 MB per attachment. Models have separate expression, coefficient-precision, and input limits described in the guide. Further accounts need installation access and a workspace invitation.
