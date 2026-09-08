import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
if (fs.existsSync('.dev.vars')) {
  console.log('.dev.vars finns redan. Befintliga nycklar har bevarats.');
  process.exit(0);
}
const pair = await webcrypto.subtle.generateKey('Ed25519', true, [
  'sign',
  'verify',
]);
const jwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
delete jwk.alg;
fs.writeFileSync(
  '.dev.vars',
  "CIVOS_SIGNING_KEY='" + JSON.stringify(jwk) + "'\n",
  { mode: 0o600, flag: 'wx' },
);
console.log(
  'Lokal signeringsnyckel skapad i .dev.vars. Filen ska inte delas eller versionshanteras.',
);
