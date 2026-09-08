import { canonical, Problem, verifyEntries, type Entry } from './model';
export type Bundle = {
  format: 'civos.bundle.v1';
  algorithm: 'Ed25519';
  publicKey: string;
  fingerprint: string;
  payload: {
    node: string;
    workspace: string;
    title: string;
    exportedAt: string;
    head: string;
    records: Entry[];
    lineage: null | {
      baseHead: string;
      baseSequence: number;
      node: string;
      fingerprint: string;
      envelopeHash: string;
    };
  };
  signature: string;
};
const keyFingerprint = async (data: ArrayBuffer) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
const base64 = (data: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(data)));
const bytes = (text: string) => {
  try {
    const data = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
    if (base64(data.buffer) !== text) throw Error();
    return data;
  } catch {
    throw new Problem('Ogiltig nyckel eller signatur.');
  }
};
export async function signBundle(
  privateKey: string,
  payload: Bundle['payload'],
): Promise<Bundle> {
  const jwk = JSON.parse(privateKey) as JsonWebKey;
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'Ed25519' },
    false,
    ['sign'],
  );
  const pub = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, ext: true },
    { name: 'Ed25519' },
    true,
    ['verify'],
  );
  const raw = await crypto.subtle.exportKey('raw', pub);
  const publicKey = base64(raw),
    fingerprint = await keyFingerprint(raw);
  const body = {
    format: 'civos.bundle.v1' as const,
    algorithm: 'Ed25519' as const,
    publicKey,
    fingerprint,
    payload,
  };
  return {
    ...body,
    signature: base64(
      await crypto.subtle.sign(
        'Ed25519',
        key,
        new TextEncoder().encode('CivOS bundle v1\n' + canonical(body)),
      ),
    ),
  };
}
export async function verifyBundle(text: string): Promise<Bundle> {
  if (new TextEncoder().encode(text).length > 2_000_000)
    throw new Problem('Överföringen får vara högst 2 MB.');
  let b: Bundle;
  try {
    b = JSON.parse(text);
  } catch {
    throw new Problem('Filen innehåller inte giltig JSON.');
  }
  if (canonical(b) !== text.trim())
    throw new Problem(
      'Överföringen måste ha CivOS kanoniska JSON-format. Ändra inte exportfilens formatering.',
    );
  if (
    !b ||
    b.format !== 'civos.bundle.v1' ||
    b.algorithm !== 'Ed25519' ||
    Object.keys(b).sort().join() !==
      [
        'format',
        'algorithm',
        'publicKey',
        'fingerprint',
        'payload',
        'signature',
      ]
        .sort()
        .join() ||
    typeof b.publicKey !== 'string' ||
    typeof b.signature !== 'string' ||
    typeof b.fingerprint !== 'string' ||
    !b.payload ||
    Object.keys(b.payload).sort().join() !==
      ['node', 'workspace', 'title', 'exportedAt', 'head', 'records', 'lineage']
        .sort()
        .join()
  )
    throw new Problem('Okänt överföringsformat.');
  for (const k of ['node', 'workspace', 'title', 'exportedAt', 'head'] as const)
    if (
      typeof b.payload[k] !== 'string' ||
      !b.payload[k] ||
      b.payload[k].length > 500
    )
      throw new Problem('Ofullständig överföringsmetadata.');
  if (b.payload.lineage !== null) {
    const l = b.payload.lineage;
    if (
      !l ||
      Object.keys(l).sort().join() !==
        ['baseHead', 'baseSequence', 'node', 'fingerprint', 'envelopeHash']
          .sort()
          .join() ||
      !Number.isInteger(l.baseSequence) ||
      l.baseSequence < 0 ||
      l.baseSequence > b.payload.records.length ||
      typeof l.node !== 'string' ||
      l.node.length > 500 ||
      ![l.baseHead, l.fingerprint, l.envelopeHash].every(
        (x) => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x),
      ) ||
      (l.baseSequence
        ? b.payload.records[l.baseSequence - 1]?.hash
        : '0'.repeat(64)) !== l.baseHead
    )
      throw new Problem('Ogiltigt ursprung för grenen.');
  }
  if (
    bytes(b.publicKey).length !== 32 ||
    bytes(b.signature).length !== 64 ||
    (await keyFingerprint(bytes(b.publicKey).buffer)) !== b.fingerprint
  )
    throw new Problem(
      'Nyckelns fingeravtryck eller signaturformat stämmer inte.',
    );
  const { signature, ...body } = b;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      bytes(b.publicKey),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    if (
      !(await crypto.subtle.verify(
        'Ed25519',
        key,
        bytes(signature),
        new TextEncoder().encode('CivOS bundle v1\n' + canonical(body)),
      ))
    )
      throw new Problem('Signaturen är ogiltig. Innehållet kan ha ändrats.');
  } catch (e) {
    if (e instanceof Problem) throw e;
    throw new Problem('Signaturen kunde inte verifieras.');
  }
  await verifyEntries(b.payload.records, b.payload.head);
  return b;
}
