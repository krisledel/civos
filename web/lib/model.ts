export type Data = Record<string, string | number | boolean | string[]>;
export type Field = {
  key: string;
  label: string;
  type?:
    | 'long'
    | 'list'
    | 'number'
    | 'date'
    | 'boolean'
    | 'ref'
    | 'refs'
    | 'select';
  required?: boolean;
  options?: string[];
  targets?: string[];
  hint?: string;
};
export type Kind = {
  label: string;
  plural: string;
  layer: string;
  fields: Field[];
  global?: boolean;
};
const f = (key: string, label: string, extra: Partial<Field> = {}): Field => ({
  key,
  label,
  required: true,
  ...extra,
});
const ref = (
  key: string,
  label: string,
  targets: string[],
  multiple = false,
  required = true,
): Field =>
  f(key, label, { type: multiple ? 'refs' : 'ref', targets, required });
export const kinds: Record<string, Kind> = {
  case: {
    label: 'Ärende',
    plural: 'Ärenden',
    layer: 'overview',
    global: true,
    fields: [
      f('title', 'Rubrik'),
      f('question', 'Frågan som ska avgöras', { type: 'long' }),
      f('domain', 'Sakområde'),
      f('place', 'Plats eller sammanhang'),
      f('groups', 'Berörda grupper', { type: 'list' }),
      f('timeframe', 'Tidshorisont'),
    ],
  },
  actor: {
    label: 'Deltagare',
    plural: 'Deltagare',
    layer: 'trust',
    global: true,
    fields: [
      f('title', 'Namn'),
      f('role', 'Roll eller uppdrag'),
      f('groups', 'Grupper som personen företräder', { type: 'list' }),
      f('domains', 'Kunskapsområden', { type: 'list' }),
      f('interests', 'Intressen och anknytningar', { type: 'long' }),
    ],
  },
  source: {
    label: 'Källa',
    plural: 'Källor',
    layer: 'observe',
    fields: [
      f('title', 'Källans namn'),
      f('uri', 'Källadress', { hint: 'https://… eller urn:civos:…' }),
      f('method', 'Hur uppgifterna samlades in', { type: 'long' }),
      f('capturedAt', 'Källans datum', { type: 'date' }),
      f('originGroup', 'Gemensamt ursprung', {
        hint: 'Samma ursprung för kopior. Skriv okänt om det inte är fastställt.',
      }),
      f('limitations', 'Begränsningar', { type: 'long' }),
      f('artifactId', 'Bilagans ID', { required: false }),
      f('artifactDigest', 'Bilagans SHA-256', { required: false }),
    ],
  },
  observation: {
    label: 'Observation',
    plural: 'Observationer',
    layer: 'observe',
    fields: [
      f('title', 'Kort rubrik'),
      f('statement', 'Uppgift eller påstående', { type: 'long' }),
      f('category', 'Typ av uppgift', {
        type: 'select',
        options: ['observation', 'tolkning', 'prognos', 'värdering'],
      }),
      ref('sourceIds', 'Underlag', ['source'], true),
      ref('frameId', 'Tolkningsram', ['frame'], false, false),
      f('observedAt', 'Tidpunkt', { type: 'date' }),
      f('place', 'Plats och sammanhang'),
      f('uncertainty', 'Osäkerhet och antaganden', { type: 'long' }),
      ref(
        'contradicts',
        'Motsäger eller begränsar',
        ['observation'],
        true,
        false,
      ),
    ],
  },
  frame: {
    label: 'Perspektiv',
    plural: 'Perspektiv',
    layer: 'frames',
    fields: [
      f('title', 'Perspektivets namn'),
      f('description', 'Vad perspektivet uppmärksammar', { type: 'long' }),
      f('method', 'Sätt att undersöka och bedöma', { type: 'long' }),
      f('assumptions', 'Antaganden', { type: 'list' }),
      f('scope', 'Giltighetsområde'),
      f('limitations', 'Vad perspektivet inte fångar', { type: 'long' }),
      f('groups', 'Företrädda grupper', { type: 'list' }),
    ],
  },
  concept: {
    label: 'Begrepp',
    plural: 'Begrepp',
    layer: 'frames',
    fields: [
      f('title', 'Begrepp'),
      ref('frameId', 'Tillhör perspektivet', ['frame']),
      f('definition', 'Betydelse i detta perspektiv', { type: 'long' }),
      f('examples', 'Exempel och avgränsningar', { type: 'long' }),
    ],
  },
  mapping: {
    label: 'Begreppsrelation',
    plural: 'Begreppsrelationer',
    layer: 'frames',
    fields: [
      f('title', 'Relationens rubrik'),
      ref('fromId', 'Från begrepp', ['concept']),
      ref('toId', 'Till begrepp', ['concept']),
      f('relation', 'Relation', {
        type: 'select',
        options: [
          'överlappande',
          'snävare',
          'bredare',
          'oförenliga',
          'likvärdiga inom angivet område',
        ],
      }),
      f('scope', 'När jämförelsen gäller'),
      f('loss', 'Vad som går förlorat i översättningen', { type: 'long' }),
      f('rationale', 'Skäl och motexempel', { type: 'long' }),
    ],
  },
  assessment: {
    label: 'Bedömning',
    plural: 'Bedömningar',
    layer: 'trust',
    fields: [
      f('title', 'Bedömningens rubrik'),
      ref('targetId', 'Bedömer', [
        'observation',
        'mapping',
        'option',
        'outcome',
      ]),
      ref('actorId', 'Angiven granskare', ['actor']),
      ref('frameId', 'Granskarens perspektiv', ['frame'], false, false),
      f('verdict', 'Slutsats', {
        type: 'select',
        options: ['stödjer', 'invänder', 'osäkert'],
      }),
      f('rationale', 'Skäl', { type: 'long' }),
      f('method', 'Granskningsmetod'),
      f('independence', 'Oberoende', {
        type: 'select',
        options: [
          'inte fastställt',
          'gemensamt ursprung',
          'självständigt granskat',
        ],
      }),
      f('interests', 'Reservationer och intressen', { type: 'long' }),
      ref('evidenceIds', 'Granskat underlag', ['source', 'observation'], true),
    ],
  },
  option: {
    label: 'Handlingsalternativ',
    plural: 'Alternativ',
    layer: 'decide',
    fields: [
      f('title', 'Alternativ'),
      f('action', 'Vad alternativet innebär', { type: 'long' }),
      ref('basisIds', 'Kunskapsgrund', ['observation'], true),
      f('benefits', 'Förväntad nytta', { type: 'long' }),
      f('costs', 'Kostnader och nackdelar', { type: 'long' }),
      f('reversibility', 'Möjlighet att ångra eller avbryta'),
    ],
  },
  argument: {
    label: 'Argument',
    plural: 'Argument',
    layer: 'decide',
    fields: [
      f('title', 'Rubrik'),
      ref('optionId', 'Gäller alternativ', ['option']),
      ref('actorId', 'Framfört av', ['actor']),
      ref('frameId', 'Perspektiv', ['frame'], false, false),
      f('position', 'Ställning', {
        type: 'select',
        options: ['för', 'emot', 'villkor'],
      }),
      f('reason', 'Argument och konsekvenser', { type: 'long' }),
      ref(
        'referenceIds',
        'Hänvisningar',
        ['observation', 'source', 'assessment'],
        true,
        false,
      ),
    ],
  },
  decision: {
    label: 'Beslut',
    plural: 'Beslut',
    layer: 'decide',
    fields: [
      f('title', 'Beslutets rubrik'),
      ref('optionId', 'Valt alternativ', ['option']),
      ref('ownerId', 'Ansvarig', ['actor']),
      f('authority', 'Mandat att fatta beslutet', { type: 'long' }),
      f('rationale', 'Motivering och accepterad osäkerhet', { type: 'long' }),
      f('dissent', 'Kvarstående invändningar', { type: 'long' }),
      f('reviewAt', 'Senast uppföljning', { type: 'date' }),
      f('metric', 'Indikator för uppföljning'),
      f('operator', 'Målvillkor', {
        type: 'select',
        options: ['minst', 'högst', 'exakt'],
      }),
      f('target', 'Målvärde', { type: 'number' }),
      f('unit', 'Enhet'),
      f('stopCondition', 'Stoppvillkor', { type: 'long' }),
      ref('policyId', 'Arbetsregel', ['policy']),
    ],
  },
  task: {
    label: 'Åtgärd',
    plural: 'Åtgärder',
    layer: 'decide',
    fields: [
      f('title', 'Åtgärd'),
      ref('decisionId', 'Tillhör beslut', ['decision']),
      ref('ownerId', 'Ansvarig', ['actor']),
      f('dueAt', 'Sista datum', { type: 'date' }),
      f('status', 'Status', {
        type: 'select',
        options: ['planerad', 'pågår', 'klar', 'avbruten'],
      }),
      f('note', 'Genomförande och belägg', { type: 'long' }),
    ],
  },
  outcome: {
    label: 'Utfall',
    plural: 'Utfall',
    layer: 'outcomes',
    fields: [
      f('title', 'Uppföljning'),
      ref('decisionId', 'Följer upp beslut', ['decision']),
      f('measuredAt', 'Mättidpunkt', { type: 'date' }),
      f('value', 'Observerat värde', { type: 'number' }),
      f('unit', 'Enhet'),
      f('method', 'Mätmetod'),
      ref('sourceIds', 'Underlag för utfallet', ['source'], true),
      f('observation', 'Vad som hände', { type: 'long' }),
      f('limitations', 'Begränsningar och andra möjliga orsaker', {
        type: 'long',
      }),
      f('nextAction', 'Nästa steg', { type: 'long' }),
    ],
  },
  policy: {
    label: 'Arbetsregel',
    plural: 'Arbetsregler',
    layer: 'coordinate',
    global: true,
    fields: [
      f('title', 'Regelns namn'),
      f('rule', 'Arbetsregel', { type: 'long' }),
      f(
        'minReviews',
        'Minsta antal separata konton som granskat beslutsgrunden',
        { type: 'number' },
      ),
      f('requiredGroups', 'Grupper som ska finnas representerade', {
        type: 'list',
        required: false,
      }),
      f('reviewDays', 'Normal uppföljning inom dagar', { type: 'number' }),
    ],
  },
  rule_change: {
    label: 'Ändringsförslag',
    plural: 'Regelförslag',
    layer: 'coordinate',
    global: true,
    fields: [
      f('title', 'Förslagets namn'),
      ref('policyId', 'Nuvarande arbetsregel', ['policy']),
      f('problem', 'Problem i arbetssättet', { type: 'long' }),
      f('proposal', 'Föreslagen arbetsregel', { type: 'long' }),
      f('minReviews', 'Föreslaget minsta antal granskarkonton', {
        type: 'number',
      }),
      f('requiredGroups', 'Grupper som ska finnas representerade', {
        type: 'list',
        required: false,
      }),
      f('reviewDays', 'Föreslagen uppföljning inom dagar', { type: 'number' }),
      ref(
        'basisIds',
        'Berörda poster',
        ['decision', 'assessment', 'outcome', 'case'],
        true,
      ),
    ],
  },
  rule_resolution: {
    label: 'Regelbeslut',
    plural: 'Regelbeslut',
    layer: 'coordinate',
    global: true,
    fields: [
      f('title', 'Beslutets rubrik'),
      ref('changeId', 'Ändringsförslag', ['rule_change']),
      f('verdict', 'Beslut', { type: 'select', options: ['antas', 'avslås'] }),
      f('rationale', 'Motivering', { type: 'long' }),
    ],
  },
};
export type Entry = {
  id: string;
  kind: string;
  caseId: string | null;
  actor: string;
  actorName: string;
  createdAt: string;
  supersedes: string | null;
  data: Data;
  seq: number;
  prevHash: string;
  hash: string;
};
export type Proposal = {
  kind: string;
  caseId?: string | null;
  supersedes?: string | null;
  data: Data;
};
export type Person = { id: string; name: string };
export const ZERO = '0'.repeat(64);
export class Problem extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function active(entries: Entry[]) {
  const old = new Set(entries.map((e) => e.supersedes).filter(Boolean));
  return entries.filter((e) => !old.has(e.id));
}
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Problem('Ogiltigt tal.');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    if (
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
        value,
      )
    )
      throw new Problem('Ogiltig Unicode.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map(
          (k) =>
            canonical(k) +
            ':' +
            canonical((value as Record<string, unknown>)[k]),
        )
        .join(',') +
      '}'
    );
  throw new Problem('Ogiltig JSON.');
}
export async function digest(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export function references(e: Entry) {
  return kinds[e.kind].fields
    .filter((f) => f.type === 'ref' || f.type === 'refs')
    .flatMap((f) => {
      const v = e.data[f.key];
      return Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [];
    })
    .concat(e.caseId ? [e.caseId] : [], e.supersedes ? [e.supersedes] : []);
}
const str = (d: Data, k: string) =>
  typeof d[k] === 'string' ? (d[k] as string) : '';
export function validate(
  p: Proposal,
  prior: Entry[],
  role = 'owner',
  restoring = false,
  localStart = 0,
): void {
  if (
    !p ||
    typeof p !== 'object' ||
    Array.isArray(p) ||
    Object.keys(p).some(
      (k) => !['kind', 'caseId', 'supersedes', 'data'].includes(k),
    )
  )
    throw new Problem('Ogiltig post.');
  if (typeof p.kind !== 'string' || !Object.hasOwn(kinds, p.kind))
    throw new Problem('Okänd posttyp.');
  const schema = kinds[p.kind];
  if (
    (p.caseId !== undefined &&
      p.caseId !== null &&
      typeof p.caseId !== 'string') ||
    (p.supersedes !== undefined &&
      p.supersedes !== null &&
      typeof p.supersedes !== 'string')
  )
    throw new Problem('Ogiltig hänvisning.');
  if (p.kind === 'case' && p.supersedes)
    throw new Problem(
      'Ärenden har beständiga ID:n. Skapa ett nytt ärende om avgränsningen behöver ändras.',
    );
  if (!p.data || typeof p.data !== 'object' || Array.isArray(p.data))
    throw new Problem('Postens innehåll saknas.');
  if (Object.keys(p.data).some((k) => !schema.fields.some((f) => f.key === k)))
    throw new Problem('Posten innehåller ett okänt fält.');
  if (
    !restoring &&
    ['policy', 'rule_resolution'].includes(p.kind) &&
    role !== 'owner'
  )
    throw new Problem('Endast arbetsytans ägare får ändra arbetsregler.', 403);
  const byId = new Map(prior.map((e) => [e.id, e]));
  if (!schema.global && (!p.caseId || byId.get(p.caseId)?.kind !== 'case'))
    throw new Problem('Välj ett befintligt ärende.');
  if (schema.global && p.caseId)
    throw new Problem('Den här posten hör till arbetsytan.');
  for (const field of schema.fields) {
    const v = p.data[field.key];
    const empty =
      v === undefined || v === '' || (Array.isArray(v) && !v.length);
    if (empty) {
      if (field.required) throw new Problem(`${field.label} behöver fyllas i.`);
      continue;
    }
    if (field.type === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e15)
        throw new Problem(`${field.label}: ange ett giltigt tal.`);
    } else if (field.type === 'boolean') {
      if (typeof v !== 'boolean')
        throw new Problem(`${field.label}: ogiltigt värde.`);
    } else if (field.type === 'list' || field.type === 'refs') {
      if (
        !Array.isArray(v) ||
        v.length > 50 ||
        v.some((s) => typeof s !== 'string' || !s.trim() || s.length > 1000) ||
        new Set(v).size !== v.length
      )
        throw new Problem(`${field.label}: ange högst 50 olika värden.`);
    } else if (typeof v !== 'string' || !v.trim() || v.length > 8000)
      throw new Problem(`${field.label}: ogiltig eller för lång text.`);
    if (field.type === 'select' && !field.options?.includes(v as string))
      throw new Problem(`${field.label}: välj ett alternativ.`);
    if (
      field.type === 'date' &&
      (typeof v !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) ||
        !Number.isFinite(Date.parse(v)) ||
        new Date(v).toISOString() !== v)
    )
      throw new Problem(`${field.label}: ogiltigt datum.`);
    if (field.type === 'ref' || field.type === 'refs')
      for (const id of Array.isArray(v) ? v : [v]) {
        const target = byId.get(String(id));
        if (!target || !field.targets?.includes(target.kind))
          throw new Problem(
            `${field.label}: hänvisningen saknas eller har fel typ.`,
          );
        if (target.caseId && p.caseId && target.caseId !== p.caseId)
          throw new Problem(
            `${field.label}: hänvisningen hör till ett annat ärende.`,
          );
      }
  }
  canonical(p.data);
  if (p.supersedes) {
    const old = byId.get(p.supersedes);
    if (
      !old ||
      old.kind !== p.kind ||
      old.caseId !== (p.caseId || null) ||
      prior.some((e) => e.supersedes === old.id)
    )
      throw new Problem('Revidera den senaste versionen av samma post.', 409);
  }
  if (p.kind === 'source') {
    try {
      const uri = str(p.data, 'uri'),
        u = new URL(uri);
      if (
        !['http:', 'https:', 'urn:'].includes(u.protocol) ||
        u.username ||
        u.password ||
        /[\s\\]/.test(uri)
      )
        throw Error();
    } catch {
      throw new Problem(
        'Källadressen måste vara https, http eller urn utan inloggningsuppgifter.',
      );
    }
    if (Boolean(p.data.artifactId) !== Boolean(p.data.artifactDigest))
      throw new Problem('Bilagans ID och hash måste anges tillsammans.');
  }
  if (p.kind === 'mapping' && p.data.fromId === p.data.toId)
    throw new Problem('Välj två olika begrepp.');
  if (p.kind === 'policy' || p.kind === 'rule_change') {
    if (
      !Number.isInteger(p.data.minReviews) ||
      Number(p.data.minReviews) < 1 ||
      Number(p.data.minReviews) > 20
    )
      throw new Problem('Antalet granskarkonton måste vara 1–20.');
    if (
      !Number.isInteger(p.data.reviewDays) ||
      Number(p.data.reviewDays) < 1 ||
      Number(p.data.reviewDays) > 3650
    )
      throw new Problem('Uppföljningstiden måste vara 1–3650 dagar.');
  }
  if (p.kind === 'outcome') {
    const d = byId.get(str(p.data, 'decisionId'))!;
    if (p.data.unit !== d.data.unit)
      throw new Problem('Utfallet måste använda samma enhet som beslutet.');
    if (Date.parse(str(p.data, 'measuredAt')) < Date.parse(d.createdAt))
      throw new Problem('Mätningen kan inte föregå beslutet.');
  }
  if (p.kind === 'decision' && !restoring) {
    if (Date.parse(str(p.data, 'reviewAt')) <= Date.now())
      throw new Problem('Välj ett kommande uppföljningsdatum.');
    const policy = byId.get(str(p.data, 'policyId'))!;
    const latest = active(prior)
      .filter((e) => e.kind === 'policy')
      .at(-1);
    if (latest?.id !== policy.id)
      throw new Problem('Använd arbetsytans gällande regelversion.', 409);
    const option = byId.get(str(p.data, 'optionId'))!;
    const basis = option.data.basisIds as string[];
    if (
      Date.parse(str(p.data, 'reviewAt')) >
      Date.now() + Number(policy.data.reviewDays) * 86400000
    )
      throw new Problem(
        `Arbetsregeln kräver uppföljning inom ${String(policy.data.reviewDays)} dagar.`,
      );
    for (const id of basis) {
      const reviewers = new Set(
        active(prior)
          .filter(
            (e) =>
              e.kind === 'assessment' &&
              e.seq >= localStart &&
              e.data.targetId === id,
          )
          .map((e) => e.actor),
      );
      if (reviewers.size < Number(policy.data.minReviews))
        throw new Problem(
          `Kunskapsgrunden behöver ${String(policy.data.minReviews)} separat registrerande lokalt granskarkonto per observation innan beslut.`,
        );
    }
    const represented = new Set(
      active(prior)
        .filter((e) => e.kind === 'argument' && e.data.optionId === option.id)
        .flatMap(
          (e) =>
            (byId.get(str(e.data, 'actorId'))?.data.groups || []) as string[],
        ),
    );
    const missing = ((policy.data.requiredGroups || []) as string[]).filter(
      (g) => !represented.has(g),
    );
    if (missing.length)
      throw new Problem('Argument saknas från: ' + missing.join(', '));
  }
  if (p.kind === 'rule_resolution') {
    if (
      prior.some(
        (e) =>
          e.kind === 'rule_resolution' && e.data.changeId === p.data.changeId,
      )
    )
      throw new Problem('Förslaget har redan behandlats.', 409);
  }
}
export async function makeEntry(
  p: Proposal,
  prior: Entry[],
  person: Person,
  role: string,
  restoring = false,
  localStart = 0,
): Promise<Entry> {
  validate(p, prior, role, restoring, localStart);
  const body = {
    id: crypto.randomUUID(),
    kind: p.kind,
    caseId: p.caseId || null,
    actor: person.id,
    actorName: person.name,
    createdAt: new Date().toISOString(),
    supersedes: p.supersedes || null,
    data: p.data,
    seq: prior.length + 1,
    prevHash: prior.at(-1)?.hash || ZERO,
  };
  return { ...body, hash: await digest(canonical(body)) };
}
export async function verifyEntries(entries: Entry[], head: string) {
  if (!Array.isArray(entries) || entries.length > 2000)
    throw new Problem('Högst 2 000 poster kan ingå i en överföring.');
  const seen: Entry[] = [];
  const ids = new Set<string>();
  for (const e of entries) {
    if (
      !e ||
      Object.keys(e).sort().join() !==
        [
          'id',
          'kind',
          'caseId',
          'actor',
          'actorName',
          'createdAt',
          'supersedes',
          'data',
          'seq',
          'prevHash',
          'hash',
        ]
          .sort()
          .join() ||
      typeof e.id !== 'string' ||
      !e.id ||
      e.id.length > 150 ||
      ids.has(e.id) ||
      typeof e.actor !== 'string' ||
      !e.actor ||
      typeof e.actorName !== 'string' ||
      !e.actorName ||
      !Number.isFinite(Date.parse(e.createdAt)) ||
      e.seq !== seen.length + 1 ||
      e.prevHash !== (seen.at(-1)?.hash || ZERO)
    )
      throw new Problem(
        'Överföringen innehåller en bruten eller ogiltig historik.',
      );
    if (
      typeof e.createdAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.createdAt) ||
      new Date(e.createdAt).toISOString() !== e.createdAt ||
      e.actor.length > 200 ||
      e.actorName.length > 150 ||
      (e.caseId !== null && typeof e.caseId !== 'string') ||
      (e.supersedes !== null && typeof e.supersedes !== 'string')
    )
      throw new Problem('Ogiltig postmetadata.');
    validate(
      {
        kind: e.kind,
        caseId: e.caseId,
        supersedes: e.supersedes,
        data: e.data,
      },
      seen,
      'owner',
      true,
    );
    const { hash, ...body } = e;
    if ((await digest(canonical(body))) !== hash)
      throw new Problem('En posts innehåll stämmer inte med dess hash.');
    ids.add(e.id);
    seen.push(e);
  }
  if ((seen.at(-1)?.hash || ZERO) !== head)
    throw new Problem('Historikens slutvärde stämmer inte.');
}
export type Finding = {
  title: string;
  detail: string;
  ids: string[];
  severity: 'warning' | 'info';
  type: string;
};
export function diagnose(entries: Entry[], clock = Date.now()): Finding[] {
  const current = active(entries),
    all = new Map(entries.map((e) => [e.id, e])),
    old = new Set(entries.map((e) => e.supersedes).filter(Boolean)),
    out: Finding[] = [];
  for (const e of current) {
    if (e.kind === 'observation') {
      if (
        !current.some(
          (a) => a.kind === 'assessment' && a.data.targetId === e.id,
        )
      )
        out.push({
          type: 'unreviewed',
          title: 'Observation saknar granskning',
          detail: String(e.data.title),
          ids: [e.id],
          severity: 'warning',
        });
      if ((e.data.contradicts as string[] | undefined)?.length)
        out.push({
          type: 'contradiction',
          title: 'Motsägelse behöver hanteras',
          detail: String(e.data.title),
          ids: [e.id, ...(e.data.contradicts as string[])],
          severity: 'warning',
        });
    }
    if (e.kind === 'assessment' && e.data.verdict !== 'stödjer')
      out.push({
        type: 'dispute',
        title:
          e.data.verdict === 'invänder'
            ? 'Invändning kvarstår'
            : 'Bedömningen är osäker',
        detail: String(e.data.title),
        ids: [e.id, String(e.data.targetId)],
        severity: 'warning',
      });
    if (e.kind === 'decision') {
      const outcomes = current.filter(
        (o) => o.kind === 'outcome' && o.data.decisionId === e.id,
      );
      if (Date.parse(String(e.data.reviewAt)) < clock && !outcomes.length)
        out.push({
          type: 'overdue',
          title: 'Uppföljning saknas',
          detail: String(e.data.title),
          ids: [e.id],
          severity: 'warning',
        });
    }
    if (
      e.kind === 'task' &&
      !['klar', 'avbruten'].includes(String(e.data.status)) &&
      Date.parse(String(e.data.dueAt)) < clock
    )
      out.push({
        type: 'task',
        title: 'Försenad åtgärd',
        detail: String(e.data.title),
        ids: [e.id],
        severity: 'warning',
      });
    if (e.kind === 'outcome') {
      const d = all.get(String(e.data.decisionId));
      if (d && !meetsTarget(e, d))
        out.push({
          type: 'target',
          title: 'Målet är inte uppnått',
          detail: String(e.data.title),
          ids: [e.id, d.id],
          severity: 'warning',
        });
    }
    const stale = references(e).filter(
      (id) => old.has(id) && id !== e.supersedes,
    );
    if (stale.length)
      out.push({
        type: 'revision',
        title: 'Underlaget har reviderats',
        detail: String(e.data.title),
        ids: [e.id, ...stale],
        severity: 'warning',
      });
    if (e.kind === 'case') {
      const represented = new Set(
        current
          .filter((x) => x.caseId === e.id && x.kind === 'argument')
          .flatMap(
            (x) =>
              (all.get(String(x.data.actorId))?.data.groups || []) as string[],
          ),
      );
      const missing = (e.data.groups as string[]).filter(
        (g) => !represented.has(g),
      );
      if (missing.length)
        out.push({
          type: 'representation',
          title: 'Grupper saknas i överläggningen',
          detail: missing.join(', '),
          ids: [e.id],
          severity: 'info',
        });
    }
  }
  return out;
}
export function meetsTarget(outcome: Entry, decision: Entry) {
  const v = Number(outcome.data.value),
    t = Number(decision.data.target);
  return decision.data.operator === 'minst'
    ? v >= t
    : decision.data.operator === 'högst'
      ? v <= t
      : v === t;
}
export function statistics(entries: Entry[], clock = Date.now()) {
  const c = active(entries),
    observations = c.filter((e) => e.kind === 'observation'),
    reviewed = observations.filter((e) =>
      c.some((a) => a.kind === 'assessment' && a.data.targetId === e.id),
    );
  const due = c.filter(
      (e) =>
        e.kind === 'decision' && Date.parse(String(e.data.reviewAt)) <= clock,
    ),
    followed = due.filter((e) =>
      c.some((o) => o.kind === 'outcome' && o.data.decisionId === e.id),
    );
  const sources = c.filter((e) => e.kind === 'source'),
    known = sources.filter(
      (e) =>
        !['okänt', 'unknown', ''].includes(
          String(e.data.originGroup).toLowerCase(),
        ),
    );
  return {
    observations: observations.length,
    reviewed: reviewed.length,
    due: due.length,
    followed: followed.length,
    sources: sources.length,
    originGroups: new Set(known.map((e) => e.data.originGroup)).size,
    unknownOrigins: sources.length - known.length,
  };
}
