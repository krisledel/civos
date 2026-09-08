/* oxlint-disable typescript/no-explicit-any -- test assertions intentionally exercise malformed external JSON. */
import assert from 'node:assert/strict';
import {
  canonical,
  validate,
  verifyEntries,
  digest,
  type Entry,
  kinds,
} from '../lib/model';
import { verifyBundle, signBundle } from '../lib/bundles';
import { runProposal, runStatus } from '../lib/kernel-records';
import {
  fieldDisplay,
  optionLabel,
  recordSearch,
  recordStatus,
} from '../lib/presentation';
const base = process.env.CIVOS_TEST_URL || 'http://localhost:3000';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))
  throw Error('Integration tests require a local server.');
const headers = {
  'Content-Type': 'application/json',
  Origin: base,
  Cookie: '__sites_local_auth=1',
};
let checks = 0;
const ok = (condition: unknown, message: string) => {
  assert.ok(condition, message);
  checks++;
};
async function post(data: unknown, status = 201) {
  const r = await fetch(base + '/api/civos', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const b = (await r.json()) as any;
  assert.equal(r.status, status, JSON.stringify(b));
  checks++;
  return b;
}
async function state(space: string) {
  const r = await fetch(base + '/api/civos?space=' + space, { headers });
  assert.equal(r.status, 200);
  return (await r.json()) as any;
}
const unauth = await fetch(base + '/api/civos');
ok(unauth.status === 401, 'Unauthenticated reads must fail');
ok(
  ((await unauth.json()) as { error: string }).error ===
    'Sign in to open the workspace.',
  'Authentication errors are English',
);
const csrf = await fetch(base + '/api/civos', {
  method: 'POST',
  headers: { ...headers, Origin: 'https://foreign.test' },
  body: '{}',
});
ok(csrf.status === 403, 'Cross-origin writes must fail');
const created = await post({
  action: 'create',
  title: 'Syntetiskt test · föreningsverkstad',
  purpose:
    'Verifiering av hela arbetsflödet. Samtliga personer, uppgifter och utfall är konstruerade testdata.',
});
let sid = created.id,
  head = (await state(sid)).space.head;
const policy = (await state(sid)).entries[0];
async function add(
  kind: string,
  data: unknown,
  caseId: string | null = null,
  supersedes: string | null = null,
) {
  const b = await post({
    action: 'append',
    space: sid,
    head,
    proposal: { kind, data, caseId, supersedes },
  });
  head = b.added.at(-1).hash;
  return b.added[0];
}
const c = await add('case', {
  title: 'Extra öppenkväll — testärende',
  question: 'Ska verkstaden pröva en extra kväll?',
  domain: 'Föreningsverksamhet',
  place: 'Fiktiva Verkstadshuset',
  groups: ['Medlemmar', 'Volontärer'],
  timeframe: 'Ett provtillfälle',
});
const a = await add('actor', {
  title: 'Alva — testperson',
  role: 'Medlemsrepresentant',
  groups: ['Medlemmar'],
  domains: ['Behov'],
  interests: 'Vill ha fler öppettider.',
});
const frame = await add(
  'frame',
  {
    title: 'Tillgång',
    description: 'När lokalen kan användas.',
    method: 'Enkät',
    assumptions: ['Önskemål är inte åtaganden'],
    scope: 'Testveckan',
    limitations: 'Förutsäger inte närvaro.',
    groups: ['Medlemmar'],
  },
  c.id,
);
const frame2 = await add(
  'frame',
  {
    ...frame.data,
    title: 'Bemanning',
    description: 'När volontärer kan närvara.',
    groups: ['Volontärer'],
  },
  c.id,
);
const con = await add(
  'concept',
  {
    title: 'Önskad tid',
    frameId: frame.id,
    definition: 'Angivet önskemål.',
    examples: 'Tisdag 18–20.',
  },
  c.id,
);
const con2 = await add(
  'concept',
  {
    title: 'Bemanningsbar tid',
    frameId: frame2.id,
    definition: 'Två volontärer kan närvara.',
    examples: 'Ett bekräftat åtagande.',
  },
  c.id,
);
await add(
  'mapping',
  {
    title: 'Tid och åtagande',
    fromId: con.id,
    toId: con2.id,
    relation: 'överlappande',
    scope: 'Samma vecka',
    loss: 'Önskemål och åtagande är olika.',
    rationale: 'Tider kan sammanfalla.',
  },
  c.id,
);
const now = () => new Date().toISOString();
const source = await add(
  'source',
  {
    title: 'Syntetisk enkät',
    uri: 'urn:civos:test:enkat',
    method: 'Konstruerade svar',
    capturedAt: now(),
    originGroup: 'test-enkat',
    limitations: 'Fiktiva uppgifter.',
  },
  c.id,
);
const observation = await add(
  'observation',
  {
    title: '14 önskar öppet',
    statement: '14 av 20 svarande önskar en extra kväll.',
    category: 'observation',
    sourceIds: [source.id],
    frameId: frame.id,
    observedAt: now(),
    place: 'Fiktiva verkstaden',
    uncertainty: 'Intresse innebär inte närvaro.',
  },
  c.id,
);
const option = await add(
  'option',
  {
    title: 'Prova en kväll',
    action: 'Öppna 18–20 och räkna besökare.',
    basisIds: [observation.id],
    benefits: 'Lärande om närvaro.',
    costs: 'Fyra volontärtimmar.',
    reversibility: 'Upphör efter tillfället.',
  },
  c.id,
);
const decisionData = {
  title: 'Godkänn försöket',
  optionId: option.id,
  ownerId: a.id,
  authority: 'Fiktivt mandat i testet.',
  rationale: 'Begränsat reversibelt försök.',
  dissent: 'Ingen fortsatt drift utan nytt beslut.',
  reviewAt: new Date(Date.now() + 86400000 * 2).toISOString(),
  metric: 'Unika besökare',
  operator: 'minst',
  target: 12,
  unit: 'personer',
  stopCondition: 'Avbryt utan bemanning.',
  policyId: policy.id,
};
await post(
  {
    action: 'append',
    space: sid,
    head,
    proposal: { kind: 'decision', caseId: c.id, data: decisionData },
  },
  400,
);
const assessment = await add(
  'assessment',
  {
    title: 'Pröva enkätens slutsats',
    targetId: observation.id,
    actorId: a.id,
    frameId: frame.id,
    verdict: 'osäkert',
    rationale: 'Svar anger önskemål.',
    method: 'Jämförelse med enkät',
    independence: 'inte fastställt',
    interests: 'Deltagarens intresse redovisat.',
    evidenceIds: [source.id],
  },
  c.id,
);
await add(
  'argument',
  {
    title: 'Pröva efterfrågan',
    optionId: option.id,
    actorId: a.id,
    position: 'för',
    reason: 'Ett tillfälle ger mätdata.',
    referenceIds: [observation.id],
  },
  c.id,
);
const decision = await add('decision', decisionData, c.id);
const task = await add(
  'task',
  {
    title: 'Genomför och räkna',
    decisionId: decision.id,
    ownerId: a.id,
    dueAt: decisionData.reviewAt,
    status: 'pågår',
    note: 'Syntetiskt försök.',
  },
  c.id,
);
const outcomeData = {
  title: 'Åtta besökare',
  decisionId: decision.id,
  measuredAt: now(),
  value: 8,
  unit: 'personer',
  method: 'Konstruerat räkneunderlag',
  sourceIds: [source.id],
  observation: 'Målet uppnåddes inte.',
  limitations: 'Ett fiktivt tillfälle.',
  nextAction: 'Begär bekräftade anmälningar.',
};
await post(
  {
    action: 'append',
    space: sid,
    head,
    proposal: {
      kind: 'outcome',
      caseId: c.id,
      data: { ...outcomeData, unit: 'timmar' },
    },
  },
  400,
);
const outcome = await add('outcome', outcomeData, c.id);
await add(
  'task',
  { ...task.data, status: 'klar', note: 'Resultatet har registrerats.' },
  c.id,
  task.id,
);
const change = await add('rule_change', {
  title: 'Skärp uppföljning',
  policyId: policy.id,
  problem: 'Enkätsvar blev inte närvaro.',
  proposal: 'Redovisa anmälningar separat från intresse.',
  minReviews: 1,
  requiredGroups: [],
  reviewDays: 3,
  basisIds: [decision.id, outcome.id],
});
await add('rule_resolution', {
  title: 'Anta förslaget',
  changeId: change.id,
  verdict: 'antas',
  rationale: 'Bevara lärdomen.',
});
let s = await state(sid);
ok(
  s.entries.filter((e: Entry) => e.kind === 'policy').length === 2,
  'Adoption must append new policy atomically',
);
ok(
  s.findings.some((f: any) => f.type === 'target'),
  'Missed target must be visible',
);
ok(
  s.entries.some((e: Entry) => e.id === task.id),
  'Original task version must remain',
);
await post(
  {
    action: 'append',
    space: sid,
    head,
    proposal: { kind: 'decision', caseId: c.id, data: decisionData },
  },
  409,
);
await post(
  {
    action: 'append',
    space: sid,
    head,
    proposal: { kind: 'case', supersedes: c.id, data: c.data },
  },
  400,
);
await post(
  {
    action: 'append',
    space: sid,
    head,
    proposal: { kind: 'constructor', data: {} },
  },
  400,
);
const good = {
  action: 'append',
  space: sid,
  head,
  proposal: { kind: 'actor', data: { ...a.data, title: 'Samtidighetstest' } },
};
const parallel = await Promise.all([
  fetch(base + '/api/civos', {
    method: 'POST',
    headers,
    body: JSON.stringify(good),
  }),
  fetch(base + '/api/civos', {
    method: 'POST',
    headers,
    body: JSON.stringify(good),
  }),
]);
ok(
  parallel
    .map((r) => r.status)
    .sort((a, b) => a - b)
    .join(',') === '201,409',
  'Exactly one concurrent writer must succeed',
);
s = await state(sid);
await verifyEntries(s.entries, s.space.head);
checks++;
const exportResponse = await fetch(
  base + '/api/civos?space=' + sid + '&export=1',
  { headers },
);
ok(exportResponse.status === 200, 'Export must succeed');
const original = await exportResponse.text();
await verifyBundle(original);
checks++;
const bad = JSON.parse(original);
bad.payload.title = 'Changed';
await assert.rejects(() => verifyBundle(canonical(bad)));
checks++;
const imported = await post({ action: 'import', envelope: original });
const importedState = await state(imported.id);
ok(importedState.space.read_only === 1, 'Imports are read-only');
ok(
  importedState.members.length === 1,
  'Imported bundle must not grant remote roles',
);
await post(
  {
    action: 'append',
    space: imported.id,
    head: importedState.space.head,
    proposal: { kind: 'actor', data: a.data },
  },
  403,
);
const forked = await post({ action: 'fork', space: imported.id });
sid = forked.id;
s = await state(sid);
head = s.space.head;
const localPolicy = s.entries.at(-1);
await post(
  {
    action: 'append',
    space: sid,
    head,
    proposal: {
      kind: 'decision',
      caseId: c.id,
      data: { ...decisionData, policyId: localPolicy.id },
    },
  },
  400,
);
await add(
  'assessment',
  { ...assessment.data, title: 'Lokal omgranskning' },
  c.id,
);
await add('decision', { ...decisionData, policyId: localPolicy.id }, c.id);
const f = new FormData();
f.set(
  'file',
  new File(['syntetiskt underlag'], 'underlag.txt', { type: 'text/plain' }),
);
const upload = await fetch(base + '/api/civos?space=' + sid, {
  method: 'POST',
  headers: { Origin: base, Cookie: headers.Cookie },
  body: f,
});
const att = (await upload.json()) as any;
ok(upload.status === 200, 'Attachment upload');
const download = await fetch(
  base + '/api/civos?space=' + sid + '&attachment=' + att.id,
  { headers },
);
ok((await download.text()) === 'syntetiskt underlag', 'Attachment round trip');
await add(
  'source',
  {
    ...source.data,
    title: 'Källa med bilaga',
    artifactId: att.id,
    artifactDigest: att.digest,
  },
  c.id,
);
await post(
  {
    action: 'append',
    space: sid,
    head,
    proposal: {
      kind: 'source',
      caseId: c.id,
      data: { ...source.data, artifactId: att.id, artifactDigest: 'wrong' },
    },
  },
  400,
);
const fake = structuredClone(s.entries[0]);
fake.createdAt = 0;
const { hash: _hash, ...body } = fake;
fake.hash = await digest(canonical(body));
await assert.rejects(() => verifyEntries([fake], fake.hash));
checks++;
assert.throws(() =>
  validate(
    {
      kind: 'source',
      caseId: c.id,
      data: { ...source.data, capturedAt: '2026-02-31T00:00:00.000Z' },
    },
    [c],
  ),
);
checks++;
const emptyBefore = (await state(sid)).entries.length;
await post(
  {
    action: 'append',
    space: sid,
    head,
    proposal: {
      kind: 'source',
      caseId: c.id,
      data: { ...source.data, uri: ' https://example.com' },
    },
  },
  400,
);
ok(
  (await state(sid)).entries.length === emptyBefore,
  'Rejected writes cannot alter history',
);
const pair = (await crypto.subtle.generateKey('Ed25519', true, [
  'sign',
  'verify',
])) as CryptoKeyPair;
const testKey = await crypto.subtle.exportKey('jwk', pair.privateKey);
for (const alg of ['EdDSA', 'Ed25519']) {
  testKey.alg = alg;
  await verifyBundle(
    canonical(
      await signBundle(JSON.stringify(testKey), {
        node: 'test',
        workspace: 'test',
        title: 'Key compatibility',
        exportedAt: now(),
        head: '0'.repeat(64),
        records: [],
        lineage: null,
      }),
    ),
  );
  checks++;
}
const storedBeforeDisplay = canonical(s.entries);
for (const entry of s.entries as Entry[]) {
  for (const field of kinds[entry.kind].fields)
    fieldDisplay(entry.kind, field.key, entry.data[field.key]);
  recordStatus(entry);
  recordSearch(entry);
}
ok(
  canonical(s.entries) === storedBeforeDisplay,
  'English presentation must not mutate signed record data',
);
ok(
  fieldDisplay('task', 'status', 'pågår') === 'In progress',
  'Historical status uses its English display label',
);
ok(
  fieldDisplay('source', 'title', 'pågår') === 'pågår',
  'User text that matches a protocol value must remain untouched',
);
ok(
  recordSearch({
    ...assessment,
    data: { ...assessment.data, verdict: 'invänder' },
  }).includes('objects'),
  'English status labels are searchable',
);
ok(
  Object.values(kinds).every((kind) =>
    kind.fields.every(
      (field) =>
        field.type !== 'select' ||
        field.options!.every((value) => optionLabel(field, value) !== value),
    ),
  ),
  'Every stored enum has an English display label',
);
await verifyEntries(s.entries, s.space.head);
const originalAgain = await fetch(
  base + '/api/civos?space=' + imported.id + '&export=1',
  { headers },
);
ok(
  (await originalAgain.text()) === original,
  'Forwarding an import must preserve the original envelope',
);
const example = await post({ action: 'model_example' });
sid = example.id;
s = await state(sid);
head = s.space.head;
const modelRecord = s.entries.find(
  (e: Entry) => e.id === example.modelId,
) as Entry;
const exampleSource = s.entries.find(
  (e: Entry) => e.kind === 'source',
) as Entry;
const exampleObservation = s.entries.find(
  (e: Entry) => e.kind === 'observation',
) as Entry;
const examplePolicy = s.entries.find(
  (e: Entry) => e.kind === 'policy',
) as Entry;
const optionIds = modelRecord.data.optionIds as string[];
const frameIds = modelRecord.data.frameIds as string[];
const saveRun = async (measurementIds: string[], scenario = '{}') => {
  const response = await post({
    action: 'model_run',
    space: sid,
    head,
    modelId: modelRecord.id,
    measurementIds,
    scenario,
    title: 'Integration analysis',
  });
  head = response.added[0].hash;
  return response.added[0] as Entry;
};
const initialHead = head;
const firstRun = await saveRun([]);
const firstResult = JSON.parse(String(firstRun.data.result));
ok(
  firstResult.perspectives[0].winners[0] === optionIds[0] &&
    firstResult.perspectives[1].winners[0] === optionIds[2],
  'Synthetic perspectives initially disagree',
);
ok(
  firstRun.data.baseHead === initialHead &&
    firstRun.data.baseSequence === firstRun.seq - 1,
  'Saved run identifies its exact history prefix',
);
await post(
  {
    action: 'model_run',
    space: sid,
    head: initialHead,
    modelId: modelRecord.id,
    measurementIds: [],
    scenario: '{}',
    title: 'Stale head',
  },
  409,
);
s = await state(sid);
const forged = runProposal(
  s.entries,
  modelRecord.id,
  [],
  '{}',
  'Forged analysis',
);
forged.data.result = '{}';
await post({ action: 'append', space: sid, head, proposal: forged }, 400);
const measurementData = {
  title: 'Synthetic narrow price measurement',
  modelId: modelRecord.id,
  variable: 'price',
  unit: 'synthetic index',
  low: 4.2,
  value: 4.5,
  high: 4.8,
  sourceIds: [exampleSource.id],
  method: 'Constructed interval for integration test; no empirical claim.',
};
await post(
  {
    action: 'append',
    space: sid,
    head,
    proposal: {
      kind: 'model_measurement',
      caseId: example.caseId,
      data: { ...measurementData, variable: 'stress' },
    },
  },
  400,
);
await post(
  {
    action: 'append',
    space: sid,
    head,
    proposal: {
      kind: 'model_measurement',
      caseId: example.caseId,
      data: { ...measurementData, unit: 'wrong unit' },
    },
  },
  400,
);
const measurement = await add(
  'model_measurement',
  measurementData,
  example.caseId,
);
s = await state(sid);
ok(
  runStatus(firstRun, s.entries).live?.sharedPreferred[0] === optionIds[2],
  'New measurement establishes a shared guaranteed option',
);
ok(
  s.entries.find((e: Entry) => e.id === firstRun.id).data.result ===
    firstRun.data.result,
  'New evidence preserves the historical calculation',
);
ok(
  s.findings.some(
    (f: any) => f.ids.includes(firstRun.id) && f.type === 'model',
  ),
  'Saved analysis is marked stale',
);
const measuredRun = await saveRun([measurement.id]);
const exampleActor = await add('actor', {
  ...a.data,
  title: 'Synthetic model reviewer',
});
await add(
  'assessment',
  {
    ...assessment.data,
    title: 'Review synthetic input provenance',
    targetId: exampleObservation.id,
    actorId: exampleActor.id,
    frameId: frameIds[0],
    evidenceIds: [exampleSource.id],
  },
  example.caseId,
);
const modeledDecisionData = {
  ...decisionData,
  title: 'Synthetic modeled decision',
  optionId: optionIds[2],
  ownerId: exampleActor.id,
  policyId: examplePolicy.id,
  modelRunId: measuredRun.id,
};
await post(
  {
    action: 'append',
    space: sid,
    head,
    proposal: {
      kind: 'decision',
      caseId: example.caseId,
      data: { ...modeledDecisionData, modelRunId: firstRun.id },
    },
  },
  400,
);
const modeledDecision = await add(
  'decision',
  modeledDecisionData,
  example.caseId,
);
await add(
  'model_measurement',
  {
    ...measurementData,
    title: 'Revised synthetic measurement',
    low: 2,
    value: 3,
    high: 3.8,
  },
  example.caseId,
  measurement.id,
);
s = await state(sid);
ok(
  s.findings.some(
    (f: any) => f.ids.includes(modeledDecision.id) && f.type === 'model',
  ),
  'A decision is flagged when its calculation basis changes',
);
ok(
  runStatus(measuredRun, s.entries).state === 'changed',
  'A revised measurement produces an explicit current comparison',
);
await add(
  'model_measurement',
  { ...measurementData, title: 'Conflicting synthetic price estimate' },
  example.caseId,
);
s = await state(sid);
ok(
  runStatus(measuredRun, s.entries).state === 'blocked',
  'Conflicting new evidence requires an explicit choice',
);
await verifyEntries(s.entries, s.space.head);
checks++;
const modelExport = await fetch(
  base + '/api/civos?space=' + sid + '&export=1',
  { headers },
);
const modelEnvelope = await modelExport.text();
await verifyBundle(modelEnvelope);
checks++;
const importedModel = await post({ action: 'import', envelope: modelEnvelope });
const modelImportedState = await state(importedModel.id);
ok(
  modelImportedState.entries.length === s.entries.length,
  'Models, measurements, analyses and modeled decisions survive signed import',
);
ok(
  modelImportedState.entries.find((e: Entry) => e.id === firstRun.id).data
    .result === firstRun.data.result,
  'Imported historical results remain exact',
);
console.log(
  JSON.stringify(
    {
      checks,
      fullWorkflow: 'passed',
      signedExportImport: 'passed',
      localReReview: 'passed',
      concurrentAppend: 'passed',
      attachments: 'passed',
      computationalWorkflow: 'passed',
      workspace: created.id,
    },
    null,
    2,
  ),
);
