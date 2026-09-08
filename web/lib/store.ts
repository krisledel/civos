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
    throw new Problem(
      'The workspace does not exist or you do not have access.',
      404,
    );
  return s;
}
export function writable(s: Space, kind?: string) {
  if (s.read_only)
    throw new Problem(
      'Imported branches are read-only. Create a local continuation first.',
      403,
    );
  if (s.role === 'viewer') throw new Problem('You have read-only access.', 403);
  if (
    s.role === 'reviewer' &&
    kind &&
    !['assessment', 'argument', 'outcome'].includes(kind)
  )
    throw new Problem(
      'Reviewers can add assessments, arguments and outcomes.',
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
    throw new Problem('Enter the workspace name and purpose.');
  const id = crypto.randomUUID(),
    createdAt = new Date().toISOString();
  const policy = await makeEntry(
    {
      kind: 'policy',
      data: {
        title: 'Working rule 1',
        rule: 'Review evidence, record objections and follow up decisions. Accounts submitting records are counted separately from named participants.',
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
    throw new Problem(
      'Change working rules through proposals and rule decisions.',
    );
  if (s.head !== expectedHead)
    throw new Problem(
      'Someone has changed the workspace. Reload the latest version.',
      409,
    );
  const previous = await records(s);
  if (s.head !== expectedHead)
    throw new Problem('The workspace changed. Reload the latest version.', 409);
  if (previous.length >= 1900)
    throw new Problem(
      'The workspace has reached its limit of 1,900 records. Export it and start a new workspace.',
    );
  if (proposal.supersedes) {
    const old = previous.find((e) => e.id === proposal.supersedes);
    if (old && old.actor !== person.id && s.role !== 'owner')
      throw new Problem('You can only revise your own records.', 403);
  }
  if (proposal.kind === 'source' && proposal.data?.artifactId) {
    const a = await db()
      .prepare('SELECT digest FROM attachments WHERE id=? AND space_id=?')
      .bind(proposal.data.artifactId, s.id)
      .first<{ digest: string }>();
    if (!a || a.digest !== proposal.data.artifactDigest)
      throw new Problem('The attachment does not exist in this workspace.');
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
        'The proposal refers to an older working rule. Revise the proposal first.',
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
      'The history must not exceed 1.5 MB so it can be exported and restored reliably.',
    );
  if (previous.length + added.length > 1900)
    throw new Problem('The workspace can contain at most 1,900 records.');
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
      'The workspace changed while you were writing. Reload the latest version.',
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
    throw new Problem('The history must not exceed 1.5 MB.');
  const commands = [
    db()
      .prepare(
        'INSERT INTO spaces(id,title,purpose,owner,head,sequence,created_at,origin,read_only) VALUES(?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        id,
        title.slice(0, 150),
        'Signed imported branch. Its content is preserved for review.',
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
      'Create a local continuation from a signed imported branch.',
    );
  const receipt = await db()
    .prepare('SELECT fingerprint,envelope FROM imports WHERE space_id=?')
    .bind(s.id)
    .first<{ fingerprint: string; envelope: string }>();
  if (!receipt) throw new Problem('The import receipt is missing.');
  const prior = await records(s);
  if (prior.length >= 1900)
    throw new Problem(
      'The branch is too large for a local continuation (maximum 1,899 records).',
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
        title: 'Local working rule',
        rule: 'This local branch reviews imported information again. Imported roles or trust claims do not grant local permissions.',
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
    throw new Problem('The branch has no room for a local continuation.');
  await db().batch([
    db()
      .prepare(
        'INSERT INTO spaces(id,title,purpose,owner,head,sequence,created_at,origin,local_start) VALUES(?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        id,
        (s.title + ' · local branch').slice(0, 150),
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
