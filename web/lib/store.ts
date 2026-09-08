import { env } from 'cloudflare:workers';
import {
  active,
  canonical,
  makeEntry,
  Problem,
  ZERO,
  verifyEntries,
  type Entry,
  type Person,
  type Proposal,
} from './model';
export type Space = {
  id: string;
  title: string;
  purpose: string;
  owner: string;
  head: string;
  sequence: number;
  created_at: string;
  origin: string | null;
  read_only: number;
  local_start: number;
  role: string;
};
export const db = () => env.DB;
export async function getSpace(id: string, person: Person): Promise<Space> {
  const s = await db()
    .prepare(
      'SELECT s.*,m.role FROM spaces s JOIN members m ON m.space_id=s.id WHERE s.id=? AND m.principal=?',
    )
    .bind(id, person.id)
    .first<Space>();
  if (!s)
    throw new Problem('Arbetsytan finns inte eller du saknar åtkomst.', 404);
  return s;
}
export function writable(s: Space, kind?: string) {
  if (s.read_only)
    throw new Problem(
      'Importerade grenar är skrivskyddade. Skapa en lokal fortsättning först.',
      403,
    );
  if (s.role === 'viewer') throw new Problem('Du har läsbehörighet.', 403);
  if (
    s.role === 'reviewer' &&
    kind &&
    !['assessment', 'argument', 'outcome'].includes(kind)
  )
    throw new Problem(
      'Granskarrollen får lämna bedömningar, argument och utfall.',
      403,
    );
}
export async function records(s: Space) {
  const snapshot = await db().batch([
    db().prepare('SELECT head,sequence FROM spaces WHERE id=?').bind(s.id),
    db()
      .prepare('SELECT record FROM entries WHERE space_id=? ORDER BY sequence')
      .bind(s.id),
  ]);
  const state = snapshot[0].results[0] as { head: string; sequence: number };
  const e = snapshot[1].results.map(
    (row) => JSON.parse(String((row as { record: string }).record)) as Entry,
  );
  await verifyEntries(e, state.head);
  s.head = state.head;
  s.sequence = state.sequence;
  return e;
}
export async function listSpaces(person: Person) {
  return (
    await db()
      .prepare(
        'SELECT s.*,m.role FROM spaces s JOIN members m ON m.space_id=s.id WHERE m.principal=? ORDER BY s.created_at DESC',
      )
      .bind(person.id)
      .all<Space>()
  ).results;
}
export async function createSpace(
  title: string,
  purpose: string,
  person: Person,
) {
  if (
    !title?.trim() ||
    title.length > 150 ||
    !purpose?.trim() ||
    purpose.length > 3000
  )
    throw new Problem('Ange arbetsytans namn och syfte.');
  const id = crypto.randomUUID(),
    createdAt = new Date().toISOString();
  const policy = await makeEntry(
    {
      kind: 'policy',
      data: {
        title: 'Arbetsregel 1',
        rule: 'Underlag ska granskas, invändningar redovisas och beslut följas upp. Registrerande konton räknas separat från angivna deltagare.',
        minReviews: 1,
        requiredGroups: [],
        reviewDays: 30,
      },
    },
    [],
    person,
    'owner',
  );
  await db().batch([
    db()
      .prepare(
        'INSERT INTO spaces(id,title,purpose,owner,head,sequence,created_at) VALUES(?,?,?,?,?,?,?)',
      )
      .bind(
        id,
        title.trim(),
        purpose.trim(),
        person.id,
        policy.hash,
        1,
        createdAt,
      ),
    db()
      .prepare(
        'INSERT INTO members(space_id,principal,name,role) VALUES(?,?,?,?)',
      )
      .bind(id, person.id, person.name, 'owner'),
    insertEntry(id, policy),
  ]);
  return id;
}
function insertEntry(
  spaceId: string,
  e: Entry,
  expectedHead?: string,
  principal?: string,
  role?: string,
) {
  const sql =
    expectedHead === undefined
      ? 'INSERT INTO entries(space_id,id,sequence,kind,case_id,record,hash) VALUES(?,?,?,?,?,?,?)'
      : 'INSERT INTO entries(space_id,id,sequence,kind,case_id,record,hash) SELECT ?,?,?,?,?,?,? FROM spaces WHERE id=? AND head=? AND EXISTS(SELECT 1 FROM members WHERE space_id=spaces.id AND principal=? AND role=?)';
  const values = [spaceId, e.id, e.seq, e.kind, e.caseId, canonical(e), e.hash];
  return db()
    .prepare(sql)
    .bind(
      ...(expectedHead === undefined
        ? values
        : [...values, spaceId, expectedHead, principal!, role!]),
    );
}
function insertEntries(spaceId: string, entries: Entry[]) {
  const commands: D1PreparedStatement[] = [];
  for (let i = 0; i < entries.length; i += 10) {
    const group = entries.slice(i, i + 10);
    commands.push(
      db()
        .prepare(
          'INSERT INTO entries(space_id,id,sequence,kind,case_id,record,hash) VALUES ' +
            group.map(() => '(?,?,?,?,?,?,?)').join(','),
        )
        .bind(
          ...group.flatMap((e) => [
            spaceId,
            e.id,
            e.seq,
            e.kind,
            e.caseId,
            canonical(e),
            e.hash,
          ]),
        ),
    );
  }
  return commands;
}
export async function append(
  s: Space,
  proposal: Proposal,
  expectedHead: string,
  person: Person,
) {
  writable(s, proposal.kind);
  if (proposal.kind === 'policy')
    throw new Problem('Ändra arbetsregler genom förslag och regelbeslut.');
  if (s.head !== expectedHead)
    throw new Problem(
      'Någon har ändrat arbetsytan. Läs in den senaste versionen.',
      409,
    );
  const previous = await records(s);
  if (s.head !== expectedHead)
    throw new Problem('Arbetsytan ändrades. Läs in senaste versionen.', 409);
  if (previous.length >= 1900)
    throw new Problem(
      'Arbetsytan har nått gränsen 1 900 poster. Exportera och påbörja en ny arbetsyta.',
    );
  if (proposal.supersedes) {
    const old = previous.find((e) => e.id === proposal.supersedes);
    if (old && old.actor !== person.id && s.role !== 'owner')
      throw new Problem('Du kan bara revidera egna poster.', 403);
  }
  if (proposal.kind === 'source' && proposal.data?.artifactId) {
    const a = await db()
      .prepare('SELECT digest FROM attachments WHERE id=? AND space_id=?')
      .bind(proposal.data.artifactId, s.id)
      .first<{ digest: string }>();
    if (!a || a.digest !== proposal.data.artifactDigest)
      throw new Problem('Bilagan finns inte i den här arbetsytan.');
  }
  const entry = await makeEntry(
    proposal,
    previous,
    person,
    s.role,
    false,
    s.local_start,
  );
  const added = [entry];
  if (
    proposal.kind === 'rule_resolution' &&
    proposal.data.verdict === 'antas'
  ) {
    const change = previous.find((e) => e.id === proposal.data.changeId)!;
    const old = active(previous)
      .filter((e) => e.kind === 'policy')
      .at(-1)!;
    if (change.data.policyId !== old.id)
      throw new Problem(
        'Förslaget gäller en äldre arbetsregel. Revidera förslaget först.',
        409,
      );
    added.push(
      await makeEntry(
        {
          kind: 'policy',
          supersedes: old.id,
          data: {
            title: String(change.data.title),
            rule: change.data.proposal,
            minReviews: change.data.minReviews,
            requiredGroups: change.data.requiredGroups || [],
            reviewDays: change.data.reviewDays,
          },
        },
        [...previous, entry],
        person,
        'owner',
      ),
    );
  }
  if (
    new TextEncoder().encode(canonical([...previous, ...added])).length >
    1_500_000
  )
    throw new Problem(
      'Historiken får vara högst 1,5 MB för att säkert kunna exporteras och återläsas.',
    );
  if (previous.length + added.length > 1900)
    throw new Problem('Arbetsytan får innehålla högst 1 900 poster.');
  const result = await db().batch([
    ...added.map((e) => insertEntry(s.id, e, expectedHead, person.id, s.role)),
    db()
      .prepare(
        'UPDATE spaces SET head=?,sequence=? WHERE id=? AND head=? AND EXISTS(SELECT 1 FROM members WHERE space_id=spaces.id AND principal=? AND role=?)',
      )
      .bind(
        added.at(-1)!.hash,
        previous.length + added.length,
        s.id,
        expectedHead,
        person.id,
        s.role,
      ),
  ]);
  if (result.at(-1)?.meta.changes !== 1)
    throw new Problem(
      'Arbetsytan ändrades medan du skrev. Läs in senaste versionen.',
      409,
    );
  return added;
}
export async function importSpace(
  title: string,
  envelope: string,
  fingerprint: string,
  sourceEntries: Entry[],
  sourceHead: string,
  origin: string,
  person: Person,
) {
  const id = crypto.randomUUID(),
    now = new Date().toISOString();
  await verifyEntries(sourceEntries, sourceHead);
  if (new TextEncoder().encode(canonical(sourceEntries)).length > 1_500_000)
    throw new Problem('Historiken får vara högst 1,5 MB.');
  const commands = [
    db()
      .prepare(
        'INSERT INTO spaces(id,title,purpose,owner,head,sequence,created_at,origin,read_only) VALUES(?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        id,
        title.slice(0, 150),
        'Signerad importerad gren. Innehållet bevaras för granskning.',
        person.id,
        sourceHead,
        sourceEntries.length,
        now,
        origin,
        1,
      ),
    db()
      .prepare(
        'INSERT INTO members(space_id,principal,name,role) VALUES(?,?,?,?)',
      )
      .bind(id, person.id, person.name, 'owner'),
    ...insertEntries(id, sourceEntries),
    db()
      .prepare(
        'INSERT INTO imports(id,space_id,fingerprint,envelope,received_at,receiver) VALUES(?,?,?,?,?,?)',
      )
      .bind(crypto.randomUUID(), id, fingerprint, envelope, now, person.id),
  ];
  await db().batch(commands);
  return id;
}
export async function forkSpace(s: Space, person: Person) {
  if (!s.read_only)
    throw new Problem(
      'Lokal fortsättning skapas från en importerad signerad gren.',
    );
  const receipt = await db()
    .prepare('SELECT fingerprint,envelope FROM imports WHERE space_id=?')
    .bind(s.id)
    .first<{ fingerprint: string; envelope: string }>();
  if (!receipt) throw new Problem('Importkvittot saknas.');
  const prior = await records(s);
  if (prior.length >= 1900)
    throw new Problem(
      'Grenen är för stor för lokal fortsättning (max 1 899 poster).',
    );
  const id = crypto.randomUUID(),
    now = new Date().toISOString();
  const old = active(prior)
    .filter((e) => e.kind === 'policy')
    .at(-1);
  const policy = await makeEntry(
    {
      kind: 'policy',
      supersedes: old?.id || null,
      data: {
        title: 'Lokal arbetsregel',
        rule: 'Denna lokala gren granskar importerade uppgifter på nytt. Importerade roller eller tillitsanspråk ger ingen lokal behörighet.',
        minReviews: 1,
        requiredGroups: [],
        reviewDays: 30,
      },
    },
    prior,
    person,
    'owner',
    true,
  );
  if (
    new TextEncoder().encode(canonical([...prior, policy])).length > 1_500_000
  )
    throw new Problem('Grenen saknar plats för en lokal fortsättning.');
  await db().batch([
    db()
      .prepare(
        'INSERT INTO spaces(id,title,purpose,owner,head,sequence,created_at,origin,local_start) VALUES(?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        id,
        (s.title + ' · lokal gren').slice(0, 150),
        s.purpose,
        person.id,
        policy.hash,
        prior.length + 1,
        now,
        s.id,
        prior.length + 1,
      ),
    db()
      .prepare(
        'INSERT INTO members(space_id,principal,name,role) VALUES(?,?,?,?)',
      )
      .bind(id, person.id, person.name, 'owner'),
    ...insertEntries(id, prior),
    insertEntry(id, policy),
    db()
      .prepare(
        'INSERT INTO imports(id,space_id,fingerprint,envelope,received_at,receiver) VALUES(?,?,?,?,?,?)',
      )
      .bind(
        crypto.randomUUID(),
        id,
        receipt.fingerprint,
        receipt.envelope,
        now,
        person.id,
      ),
  ]);
  return id;
}
export { ZERO };
