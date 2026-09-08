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
    label: 'Case',
    plural: 'Cases',
    layer: 'overview',
    global: true,
    fields: [
      f('title', 'Title'),
      f('question', 'Question to resolve', { type: 'long' }),
      f('domain', 'Domain'),
      f('place', 'Place or context'),
      f('groups', 'Affected groups', { type: 'list' }),
      f('timeframe', 'Time horizon'),
    ],
  },
  actor: {
    label: 'Participant',
    plural: 'Participants',
    layer: 'trust',
    global: true,
    fields: [
      f('title', 'Name'),
      f('role', 'Role or responsibility'),
      f('groups', 'Groups represented by this participant', { type: 'list' }),
      f('domains', 'Areas of knowledge', { type: 'list' }),
      f('interests', 'Interests and affiliations', { type: 'long' }),
    ],
  },
  source: {
    label: 'Source',
    plural: 'Sources',
    layer: 'observe',
    fields: [
      f('title', 'Source name'),
      f('uri', 'Source reference', { hint: 'https://… or urn:civos:…' }),
      f('method', 'How the information was collected', { type: 'long' }),
      f('capturedAt', 'Source date', { type: 'date' }),
      f('originGroup', 'Shared origin', {
        hint: 'Use the same origin for copies. Enter unknown if the origin has not been established.',
      }),
      f('limitations', 'Limitations', { type: 'long' }),
      f('artifactId', 'Attachment ID', { required: false }),
      f('artifactDigest', 'Attachment SHA-256', { required: false }),
    ],
  },
  observation: {
    label: 'Observation',
    plural: 'Observations',
    layer: 'observe',
    fields: [
      f('title', 'Short title'),
      f('statement', 'Information or claim', { type: 'long' }),
      f('category', 'Type of information', {
        type: 'select',
        options: ['observation', 'tolkning', 'prognos', 'värdering'],
      }),
      ref('sourceIds', 'Evidence', ['source'], true),
      ref('frameId', 'Perspective', ['frame'], false, false),
      f('observedAt', 'Time', { type: 'date' }),
      f('place', 'Place and context'),
      f('uncertainty', 'Uncertainty and assumptions', { type: 'long' }),
      ref(
        'contradicts',
        'Contradicts or qualifies',
        ['observation'],
        true,
        false,
      ),
    ],
  },
  frame: {
    label: 'Perspective',
    plural: 'Perspectives',
    layer: 'frames',
    fields: [
      f('title', 'Perspective name'),
      f('description', 'What this perspective considers', { type: 'long' }),
      f('method', 'Method of inquiry and assessment', { type: 'long' }),
      f('assumptions', 'Assumptions', { type: 'list' }),
      f('scope', 'Scope of validity'),
      f('limitations', 'What this perspective leaves out', { type: 'long' }),
      f('groups', 'Represented groups', { type: 'list' }),
    ],
  },
  concept: {
    label: 'Concept',
    plural: 'Concepts',
    layer: 'frames',
    fields: [
      f('title', 'Concept'),
      ref('frameId', 'Belongs to perspective', ['frame']),
      f('definition', 'Meaning in this perspective', { type: 'long' }),
      f('examples', 'Examples and boundaries', { type: 'long' }),
    ],
  },
  mapping: {
    label: 'Concept relation',
    plural: 'Concept relations',
    layer: 'frames',
    fields: [
      f('title', 'Relation title'),
      ref('fromId', 'From concept', ['concept']),
      ref('toId', 'To concept', ['concept']),
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
      f('scope', 'When the comparison applies'),
      f('loss', 'What is lost in translation', { type: 'long' }),
      f('rationale', 'Reasoning and counterexamples', { type: 'long' }),
    ],
  },
  assessment: {
    label: 'Assessment',
    plural: 'Assessments',
    layer: 'trust',
    fields: [
      f('title', 'Assessment title'),
      ref('targetId', 'Assesses', [
        'observation',
        'mapping',
        'option',
        'outcome',
      ]),
      ref('actorId', 'Named reviewer', ['actor']),
      ref('frameId', 'Reviewer perspective', ['frame'], false, false),
      f('verdict', 'Conclusion', {
        type: 'select',
        options: ['stödjer', 'invänder', 'osäkert'],
      }),
      f('rationale', 'Reasoning', { type: 'long' }),
      f('method', 'Review method'),
      f('independence', 'Independence', {
        type: 'select',
        options: [
          'inte fastställt',
          'gemensamt ursprung',
          'självständigt granskat',
        ],
      }),
      f('interests', 'Reservations and interests', { type: 'long' }),
      ref('evidenceIds', 'Reviewed evidence', ['source', 'observation'], true),
    ],
  },
  option: {
    label: 'Option',
    plural: 'Options',
    layer: 'decide',
    fields: [
      f('title', 'Option'),
      f('action', 'What the option involves', { type: 'long' }),
      ref('basisIds', 'Decision basis', ['observation'], true),
      f('benefits', 'Expected benefits', { type: 'long' }),
      f('costs', 'Costs and drawbacks', { type: 'long' }),
      f('reversibility', 'How the action can be reversed or stopped'),
    ],
  },
  argument: {
    label: 'Argument',
    plural: 'Arguments',
    layer: 'decide',
    fields: [
      f('title', 'Title'),
      ref('optionId', 'Applies to option', ['option']),
      ref('actorId', 'Put forward by', ['actor']),
      ref('frameId', 'Perspective', ['frame'], false, false),
      f('position', 'Position', {
        type: 'select',
        options: ['för', 'emot', 'villkor'],
      }),
      f('reason', 'Argument and consequences', { type: 'long' }),
      ref(
        'referenceIds',
        'References',
        ['observation', 'source', 'assessment'],
        true,
        false,
      ),
    ],
  },
  decision: {
    label: 'Decision',
    plural: 'Decisions',
    layer: 'decide',
    fields: [
      f('title', 'Decision title'),
      ref('optionId', 'Chosen option', ['option']),
      ref('ownerId', 'Responsible participant', ['actor']),
      f('authority', 'Authority to make the decision', { type: 'long' }),
      f('rationale', 'Rationale and accepted uncertainty', { type: 'long' }),
      f('dissent', 'Remaining objections', { type: 'long' }),
      f('reviewAt', 'Follow-up deadline', { type: 'date' }),
      f('metric', 'Follow-up indicator'),
      f('operator', 'Target condition', {
        type: 'select',
        options: ['minst', 'högst', 'exakt'],
      }),
      f('target', 'Target value', { type: 'number' }),
      f('unit', 'Unit'),
      f('stopCondition', 'Stop condition', { type: 'long' }),
      ref('policyId', 'Working rule', ['policy']),
    ],
  },
  task: {
    label: 'Action',
    plural: 'Actions',
    layer: 'decide',
    fields: [
      f('title', 'Action'),
      ref('decisionId', 'Belongs to decision', ['decision']),
      ref('ownerId', 'Responsible participant', ['actor']),
      f('dueAt', 'Due date', { type: 'date' }),
      f('status', 'Status', {
        type: 'select',
        options: ['planerad', 'pågår', 'klar', 'avbruten'],
      }),
      f('note', 'Implementation and evidence', { type: 'long' }),
    ],
  },
  outcome: {
    label: 'Outcome',
    plural: 'Outcomes',
    layer: 'outcomes',
    fields: [
      f('title', 'Follow-up'),
      ref('decisionId', 'Follows up decision', ['decision']),
      f('measuredAt', 'Measurement time', { type: 'date' }),
      f('value', 'Observed value', { type: 'number' }),
      f('unit', 'Unit'),
      f('method', 'Measurement method'),
      ref('sourceIds', 'Outcome evidence', ['source'], true),
      f('observation', 'What happened', { type: 'long' }),
      f('limitations', 'Limitations and other possible causes', {
        type: 'long',
      }),
      f('nextAction', 'Next step', { type: 'long' }),
    ],
  },
  policy: {
    label: 'Working rule',
    plural: 'Working rules',
    layer: 'coordinate',
    global: true,
    fields: [
      f('title', 'Rule name'),
      f('rule', 'Working rule', { type: 'long' }),
      f(
        'minReviews',
        'Minimum distinct accounts reviewing the decision basis',
        { type: 'number' },
      ),
      f('requiredGroups', 'Groups that must be represented', {
        type: 'list',
        required: false,
      }),
      f('reviewDays', 'Follow-up deadline (days)', { type: 'number' }),
    ],
  },
  rule_change: {
    label: 'Rule proposal',
    plural: 'Rule proposals',
    layer: 'coordinate',
    global: true,
    fields: [
      f('title', 'Proposal title'),
      ref('policyId', 'Current working rule', ['policy']),
      f('problem', 'Problem with the working process', { type: 'long' }),
      f('proposal', 'Proposed working rule', { type: 'long' }),
      f('minReviews', 'Proposed minimum reviewer accounts', {
        type: 'number',
      }),
      f('requiredGroups', 'Groups that must be represented', {
        type: 'list',
        required: false,
      }),
      f('reviewDays', 'Proposed follow-up deadline (days)', { type: 'number' }),
      ref(
        'basisIds',
        'Relevant records',
        ['decision', 'assessment', 'outcome', 'case'],
        true,
      ),
    ],
  },
  rule_resolution: {
    label: 'Rule decision',
    plural: 'Rule decisions',
    layer: 'coordinate',
    global: true,
    fields: [
      f('title', 'Decision title'),
      ref('changeId', 'Rule proposal', ['rule_change']),
      f('verdict', 'Decision', {
        type: 'select',
        options: ['antas', 'avslås'],
      }),
      f('rationale', 'Rationale', { type: 'long' }),
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
    if (!Number.isFinite(value)) throw new Problem('Invalid number.');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    if (
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
        value,
      )
    )
      throw new Problem('Invalid Unicode.');
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
  throw new Problem('Invalid JSON.');
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
    throw new Problem('Invalid record.');
  if (typeof p.kind !== 'string' || !Object.hasOwn(kinds, p.kind))
    throw new Problem('Unknown record type.');
  const schema = kinds[p.kind];
  if (
    (p.caseId !== undefined &&
      p.caseId !== null &&
      typeof p.caseId !== 'string') ||
    (p.supersedes !== undefined &&
      p.supersedes !== null &&
      typeof p.supersedes !== 'string')
  )
    throw new Problem('Invalid reference.');
  if (p.kind === 'case' && p.supersedes)
    throw new Problem(
      'Case IDs are permanent. Create a new case if its scope needs to change.',
    );
  if (!p.data || typeof p.data !== 'object' || Array.isArray(p.data))
    throw new Problem('Record content is missing.');
  if (Object.keys(p.data).some((k) => !schema.fields.some((f) => f.key === k)))
    throw new Problem('The record contains an unknown field.');
  if (
    !restoring &&
    ['policy', 'rule_resolution'].includes(p.kind) &&
    role !== 'owner'
  )
    throw new Problem(
      'Only the workspace owner can change working rules.',
      403,
    );
  const byId = new Map(prior.map((e) => [e.id, e]));
  if (!schema.global && (!p.caseId || byId.get(p.caseId)?.kind !== 'case'))
    throw new Problem('Select an existing case.');
  if (schema.global && p.caseId)
    throw new Problem('This record belongs to the workspace as a whole.');
  for (const field of schema.fields) {
    const v = p.data[field.key];
    const empty =
      v === undefined || v === '' || (Array.isArray(v) && !v.length);
    if (empty) {
      if (field.required) throw new Problem(`${field.label} is required.`);
      continue;
    }
    if (field.type === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e15)
        throw new Problem(`${field.label}: enter a valid number.`);
    } else if (field.type === 'boolean') {
      if (typeof v !== 'boolean')
        throw new Problem(`${field.label}: invalid value.`);
    } else if (field.type === 'list' || field.type === 'refs') {
      if (
        !Array.isArray(v) ||
        v.length > 50 ||
        v.some((s) => typeof s !== 'string' || !s.trim() || s.length > 1000) ||
        new Set(v).size !== v.length
      )
        throw new Problem(
          `${field.label}: enter no more than 50 distinct values.`,
        );
    } else if (typeof v !== 'string' || !v.trim() || v.length > 8000)
      throw new Problem(`${field.label}: invalid or excessively long text.`);
    if (field.type === 'select' && !field.options?.includes(v as string))
      throw new Problem(`${field.label}: select an option.`);
    if (
      field.type === 'date' &&
      (typeof v !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) ||
        !Number.isFinite(Date.parse(v)) ||
        new Date(v).toISOString() !== v)
    )
      throw new Problem(`${field.label}: invalid date.`);
    if (field.type === 'ref' || field.type === 'refs')
      for (const id of Array.isArray(v) ? v : [v]) {
        const target = byId.get(String(id));
        if (!target || !field.targets?.includes(target.kind))
          throw new Problem(
            `${field.label}: the reference is missing or has the wrong type.`,
          );
        if (target.caseId && p.caseId && target.caseId !== p.caseId)
          throw new Problem(
            `${field.label}: the reference belongs to another case.`,
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
      throw new Problem('Revise the latest version of the same record.', 409);
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
        'The source reference must use https, http or urn without login credentials.',
      );
    }
    if (Boolean(p.data.artifactId) !== Boolean(p.data.artifactDigest))
      throw new Problem('Provide the attachment ID and hash together.');
  }
  if (p.kind === 'mapping' && p.data.fromId === p.data.toId)
    throw new Problem('Select two different concepts.');
  if (p.kind === 'policy' || p.kind === 'rule_change') {
    if (
      !Number.isInteger(p.data.minReviews) ||
      Number(p.data.minReviews) < 1 ||
      Number(p.data.minReviews) > 20
    )
      throw new Problem(
        'The number of reviewer accounts must be between 1 and 20.',
      );
    if (
      !Number.isInteger(p.data.reviewDays) ||
      Number(p.data.reviewDays) < 1 ||
      Number(p.data.reviewDays) > 3650
    )
      throw new Problem('The follow-up period must be between 1 and 3,650 days.');
  }
  if (p.kind === 'outcome') {
    const d = byId.get(str(p.data, 'decisionId'))!;
    if (p.data.unit !== d.data.unit)
      throw new Problem('The outcome must use the same unit as the decision.');
    if (Date.parse(str(p.data, 'measuredAt')) < Date.parse(d.createdAt))
      throw new Problem('The measurement cannot precede the decision.');
  }
  if (p.kind === 'decision' && !restoring) {
    if (Date.parse(str(p.data, 'reviewAt')) <= Date.now())
      throw new Problem('Choose a future follow-up deadline.');
    const policy = byId.get(str(p.data, 'policyId'))!;
    const latest = active(prior)
      .filter((e) => e.kind === 'policy')
      .at(-1);
    if (latest?.id !== policy.id)
      throw new Problem(
        'Use the current working rule for this workspace.',
        409,
      );
    const option = byId.get(str(p.data, 'optionId'))!;
    const basis = option.data.basisIds as string[];
    if (
      Date.parse(str(p.data, 'reviewAt')) >
      Date.now() + Number(policy.data.reviewDays) * 86400000
    )
      throw new Problem(
        `The working rule requires follow-up within ${String(policy.data.reviewDays)} days.`,
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
          `Before a decision, each observation in the decision basis needs reviews submitted by at least ${String(policy.data.minReviews)} distinct local accounts.`,
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
      throw new Problem('Arguments are missing from: ' + missing.join(', '));
  }
  if (p.kind === 'rule_resolution') {
    if (
      prior.some(
        (e) =>
          e.kind === 'rule_resolution' && e.data.changeId === p.data.changeId,
      )
    )
      throw new Problem('This proposal has already been resolved.', 409);
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
    throw new Problem('A transfer can contain at most 2,000 records.');
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
      throw new Problem('The transfer contains a broken or invalid history.');
    if (
      typeof e.createdAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.createdAt) ||
      new Date(e.createdAt).toISOString() !== e.createdAt ||
      e.actor.length > 200 ||
      e.actorName.length > 150 ||
      (e.caseId !== null && typeof e.caseId !== 'string') ||
      (e.supersedes !== null && typeof e.supersedes !== 'string')
    )
      throw new Problem('Invalid record metadata.');
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
      throw new Problem('The content of a record does not match its hash.');
    ids.add(e.id);
    seen.push(e);
  }
  if ((seen.at(-1)?.hash || ZERO) !== head)
    throw new Problem('The history head does not match.');
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
          title: 'Observation has not been reviewed',
          detail: String(e.data.title),
          ids: [e.id],
          severity: 'warning',
        });
      if ((e.data.contradicts as string[] | undefined)?.length)
        out.push({
          type: 'contradiction',
          title: 'Contradiction needs review',
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
            ? 'Objection remains'
            : 'Assessment is uncertain',
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
          title: 'Follow-up is missing',
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
        title: 'Overdue action',
        detail: String(e.data.title),
        ids: [e.id],
        severity: 'warning',
      });
    if (e.kind === 'outcome') {
      const d = all.get(String(e.data.decisionId));
      if (d && !meetsTarget(e, d))
        out.push({
          type: 'target',
          title: 'Target has not been met',
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
        title: 'Referenced evidence has been revised',
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
          title: 'Groups are missing from the deliberation',
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
