import { env } from 'cloudflare:workers';
import {
  Problem,
  canonical,
  digest,
  diagnose,
  statistics,
  type Person,
  type Proposal,
} from '@/lib/model';
import {
  db,
  listSpaces,
  getSpace,
  records,
  createSpace,
  append,
  importSpace,
  forkSpace,
  writable,
} from '@/lib/store';
import { signBundle, verifyBundle } from '@/lib/bundles';
import hosting from '@/.openai/hosting.json';
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
function identity(req: Request): Person {
  const id = req.headers.get('oai-authenticated-user-id');
  if (!id) throw new Problem('Sign in to open the workspace.', 401);
  let name =
    req.headers.get('oai-authenticated-user-full-name') || 'Participant';
  try {
    if (
      req.headers.get('oai-authenticated-user-full-name-encoding') ===
      'percent-encoded-utf-8'
    )
      name = decodeURIComponent(name);
  } catch {}
  return { id, name: name.slice(0, 150) };
}
function csrf(req: Request) {
  const origin = req.headers.get('origin');
  if (
    !origin ||
    origin !== new URL(req.url).origin ||
    req.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new Problem(
      'The request must come from the same workspace origin.',
      403,
    );
}
async function rawBody(req: Request, max: number) {
  const reader = req.body?.getReader();
  if (!reader) throw new Problem('Request content is missing.');
  let n = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const x = await reader.read();
    if (x.done) break;
    n += x.value.length;
    if (n > max) {
      await reader.cancel();
      throw new Problem('The request content is too large.', 413);
    }
    chunks.push(x.value);
  }
  const bytes = new Uint8Array(n);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return bytes;
}
async function body(req: Request) {
  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        await rawBody(req, 4_100_000),
      ),
    );
  } catch (e) {
    if (e instanceof Problem) throw e;
    throw new Problem('Invalid JSON.');
  }
}
const text = (x: unknown, max = 1000) => {
  if (typeof x !== 'string' || !x.trim() || x.length > max)
    throw new Problem('Required text is missing or too long.');
  return x.trim();
};
async function guard(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Problem) return json({ error: e.message }, e.status);
    console.error(
      'CivOS request failed',
      e instanceof Error ? e.name + ': ' + e.message : 'Unknown',
    );
    return json(
      { error: 'The action could not be completed. Try again.' },
      500,
    );
  }
}
export async function GET(req: Request) {
  return guard(async () => {
    const person = identity(req),
      url = new URL(req.url),
      id = url.searchParams.get('space');
    if (!id) return json({ person, spaces: await listSpaces(person) });
    const s = await getSpace(id, person);
    if (url.searchParams.has('attachment')) {
      const a = await db()
        .prepare('SELECT * FROM attachments WHERE id=? AND space_id=?')
        .bind(url.searchParams.get('attachment'), id)
        .first<{ object_key: string; name: string; type: string }>();
      if (!a) throw new Problem('The attachment is missing.', 404);
      const object = await env.ATTACHMENTS.get(a.object_key);
      if (!object) throw new Problem('The attachment is missing.', 404);
      return new Response(object.body, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(a.name)}`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    const entries = await records(s);
    if (url.searchParams.has('export')) {
      const receipt = await db()
        .prepare('SELECT envelope FROM imports WHERE space_id=?')
        .bind(s.id)
        .first<{ envelope: string }>();
      if (s.read_only && receipt)
        return new Response(receipt.envelope, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="civos-original.json"',
            'Cache-Control': 'no-store',
          },
        });
      const origin = receipt ? await verifyBundle(receipt.envelope) : null;
      const lineage = origin
        ? {
            baseHead: origin.payload.head,
            baseSequence: origin.payload.records.length,
            node: origin.payload.node,
            fingerprint: origin.fingerprint,
            envelopeHash: await digest(receipt!.envelope),
          }
        : null;
      if (!env.CIVOS_SIGNING_KEY)
        throw new Problem('The node signing key is not configured.', 503);
      const bundle = await signBundle(env.CIVOS_SIGNING_KEY, {
        node: hosting.project_id,
        workspace: s.id,
        title: s.title,
        exportedAt: new Date().toISOString(),
        head: s.head,
        records: entries,
        lineage,
      });
      return new Response(canonical(bundle), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="civos-export.json"',
          'Cache-Control': 'no-store',
        },
      });
    }
    const [members, trust, attachments, imports] = await Promise.all([
      db()
        .prepare('SELECT principal,name,role FROM members WHERE space_id=?')
        .bind(id)
        .all(),
      db()
        .prepare('SELECT * FROM trusted_keys WHERE space_id=?')
        .bind(id)
        .all(),
      db()
        .prepare(
          'SELECT id,name,type,size,digest,created_at FROM attachments WHERE space_id=?',
        )
        .bind(id)
        .all(),
      db()
        .prepare(
          'SELECT id,fingerprint,received_at FROM imports WHERE space_id=?',
        )
        .bind(id)
        .all(),
    ]);
    return json({
      space: s,
      entries,
      findings: diagnose(entries),
      statistics: statistics(entries),
      members: members.results,
      trust: trust.results,
      attachments: attachments.results,
      imports: imports.results,
    });
  });
}
export async function POST(req: Request) {
  return guard(async () => {
    const person = identity(req);
    csrf(req);
    if (req.headers.get('content-type')?.startsWith('multipart/form-data')) {
      const id = new URL(req.url).searchParams.get('space') || '',
        s = await getSpace(id, person);
      writable(s, 'source');
      if (Number(req.headers.get('content-length')) > 5_500_000)
        throw new Problem('The attachment must not exceed 5 MB.', 413);
      const raw = await rawBody(req, 5_500_000);
      if (raw.byteLength > 5_500_000)
        throw new Problem('The attachment must not exceed 5 MB.', 413);
      const data = await new Response(raw, {
          headers: { 'content-type': req.headers.get('content-type')! },
        }).formData(),
        file = data.get('file');
      if (!(file instanceof File) || file.size > 5_000_000 || file.size === 0)
        throw new Problem('Choose a file no larger than 5 MB.');
      const bytes = await file.arrayBuffer(),
        hash = Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        )
          .map((x) => x.toString(16).padStart(2, '0'))
          .join(''),
        aid = crypto.randomUUID(),
        key = s.id + '/' + aid;
      await env.ATTACHMENTS.put(key, bytes);
      try {
        const stored = await db()
          .prepare(
            "INSERT INTO attachments(id,space_id,name,type,size,digest,object_key,uploader,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM members m JOIN spaces s ON s.id=m.space_id WHERE m.space_id=? AND m.principal=? AND m.role IN ('owner','editor') AND s.read_only=0)",
          )
          .bind(
            aid,
            s.id,
            file.name.slice(0, 200),
            file.type,
            file.size,
            hash,
            key,
            person.id,
            new Date().toISOString(),
            s.id,
            person.id,
          )
          .run();
        if (stored.meta.changes !== 1)
          throw new Problem('Your access to the workspace has changed.', 403);
      } catch (e) {
        await env.ATTACHMENTS.delete(key);
        throw e;
      }
      return json({ id: aid, digest: hash, name: file.name });
    }
    if (!req.headers.get('content-type')?.startsWith('application/json'))
      throw new Problem('Use JSON.', 415);
    const b = await body(req);
    if (!b || typeof b !== 'object' || Array.isArray(b))
      throw new Problem('Invalid request.');
    if (b.action === 'create')
      return json(
        {
          id: await createSpace(
            text(b.title, 150),
            text(b.purpose, 3000),
            person,
          ),
        },
        201,
      );
    if (b.action === 'import') {
      const original = text(b.envelope, 2_000_000),
        bundle = await verifyBundle(original);
      return json(
        {
          id: await importSpace(
            bundle.payload.title,
            original,
            bundle.fingerprint,
            bundle.payload.records,
            bundle.payload.head,
            bundle.payload.node + ':' + bundle.payload.workspace,
            person,
          ),
        },
        201,
      );
    }
    if (b.action === 'join') {
      const token = text(b.token, 200),
        hash = await digest(token);
      const inv = await db()
        .prepare(
          'SELECT * FROM invitations WHERE digest=? AND used_by IS NULL AND expires_at>?',
        )
        .bind(hash, new Date().toISOString())
        .first<{ space_id: string; role: string }>();
      if (!inv)
        throw new Problem(
          'The invitation has expired or has already been used.',
          404,
        );
      if (
        await db()
          .prepare(
            'SELECT principal FROM members WHERE space_id=? AND principal=?',
          )
          .bind(inv.space_id, person.id)
          .first()
      )
        throw new Problem('You are already a member of this workspace.');
      const result = await db().batch([
        db()
          .prepare(
            'INSERT INTO members(space_id,principal,name,role) SELECT space_id,?,?,role FROM invitations WHERE digest=? AND used_by IS NULL AND expires_at>?',
          )
          .bind(person.id, person.name, hash, new Date().toISOString()),
        db()
          .prepare(
            'UPDATE invitations SET used_by=? WHERE digest=? AND used_by IS NULL',
          )
          .bind(person.id, hash),
      ]);
      if (result[0].meta.changes !== 1)
        throw new Problem('The invitation has already been used.', 409);
      return json({ id: inv.space_id });
    }
    const s = await getSpace(text(b.space, 150), person);
    if (b.action === 'append') {
      if (!b.proposal || typeof b.proposal !== 'object')
        throw new Problem('The record is missing.');
      return json(
        {
          added: await append(
            s,
            b.proposal as Proposal,
            text(b.head, 64),
            person,
          ),
        },
        201,
      );
    }
    if (b.action === 'fork')
      return json({ id: await forkSpace(s, person) }, 201);
    if (s.role !== 'owner')
      throw new Problem(
        'Only the owner can change access and node trust.',
        403,
      );
    if (b.action === 'invite') {
      writable(s);
      if (!['editor', 'reviewer', 'viewer'].includes(b.role))
        throw new Problem('Invalid role.');
      const token = crypto.randomUUID() + crypto.randomUUID(),
        expires = new Date(Date.now() + 86400000).toISOString();
      await db()
        .prepare(
          'INSERT INTO invitations(digest,space_id,role,expires_at) VALUES(?,?,?,?)',
        )
        .bind(await digest(token), s.id, b.role, expires)
        .run();
      return json({ token, expires });
    }
    if (b.action === 'revoke') {
      if (b.principal === s.owner)
        throw new Problem('The workspace owner cannot be removed.');
      await db()
        .prepare('DELETE FROM members WHERE space_id=? AND principal=?')
        .bind(s.id, text(b.principal, 200))
        .run();
      return json({ ok: true });
    }
    if (b.action === 'trust') {
      const fingerprint = text(b.fingerprint, 64);
      if (
        !/^[a-f0-9]{64}$/.test(fingerprint) ||
        !['recognized', 'revoked'].includes(b.status)
      )
        throw new Problem('Invalid fingerprint or status.');
      await db()
        .prepare(
          'INSERT INTO trusted_keys(space_id,fingerprint,label,domain,status,reason,updated_at,issuer) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(space_id,fingerprint) DO UPDATE SET label=excluded.label,domain=excluded.domain,status=excluded.status,reason=excluded.reason,updated_at=excluded.updated_at,issuer=excluded.issuer',
        )
        .bind(
          s.id,
          fingerprint,
          text(b.label, 200),
          text(b.domain, 200),
          b.status,
          text(b.reason, 2000),
          new Date().toISOString(),
          person.id,
        )
        .run();
      return json({ ok: true });
    }
    throw new Problem('Unknown action.');
  });
}
