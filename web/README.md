# CivOS webbversion

Kris Ledel

Arbetsyta för observationer, perspektiv, granskning, beslut, uppföljning och förändring av arbetsregler.

Gränssnittet har dokumentträd, snabböppning med Ctrl+K, en beständig läspanel med bakåtlänkar och en klickbar sambandsgraf. Grafen visar högst 80 dokument åt gången och kan avgränsas till ett ärende eller en sökning.

## Lokal start

Node.js 22.13 eller senare.

```sh
npm ci
npm run setup:key
npm run db:migrate
npm run dev
```

Öppna http://localhost:3000 och välj Logga in. Utvecklingsläget använder en lokal testidentitet. Håll utvecklingsservern på din egen dator. Produktion kräver en autentiserande ingress som sätter stabila användaridentiteter och rensar klientskickade identitetsheaders; den privata värdplattformen tillhandahåller den ingressen.

## Kontrollera

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Integrationstestet kräver den lokala servern och skapar tydligt syntetiska testarbetsytor. Det provar hela postflödet, samtidighet, felaktiga hänvisningar, signaturer, importer, lokal omgranskning och bilagor.

## Drift

DB binder en D1-databas; ATTACHMENTS binder en R2-bucket. Drizzle-migrationerna i drizzle/ ska tillämpas innan start. CIVOS_SIGNING_KEY är en privat Ed25519 JWK som ska konfigureras som runtime-hemlighet. Lokal .dev.vars är ignorerad av Git. Säkerhetskopiera databas, bilagor och nyckel separat. Postexporten är ingen fullständig driftbackup.

Högst 1 900 poster och 1,5 MB historik per arbetsyta; importer högst 2 MB; bilagor högst 5 MB. Privat installation är avsedd för ägarens pilot. Fler konton behöver både åtkomst till installationen och en arbetsyteinbjudan.
