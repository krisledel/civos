export type Rational = { n: bigint; d: bigint };
function normalized(n: bigint, d: bigint): Rational {
  if (d === 0n) throw Error('Division by zero.');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  let a = n < 0n ? -n : n,
    b = d;
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  n /= a || 1n;
  d /= a || 1n;
  if (n.toString().length > 2400 || d.toString().length > 2400)
    throw Error('Exact arithmetic exceeds the supported precision budget.');
  return { n, d };
}
export function rational(value: number | string | Rational): Rational {
  if (typeof value === 'object') return value;
  const s = String(value);
  if (/^-?\d+\/[1-9]\d*$/.test(s)) {
    const [n, d] = s.split('/');
    return normalized(BigInt(n), BigInt(d));
  }
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s);
  if (!m || !(m[2] || m[3])) throw Error('Invalid exact number.');
  const exponent = Number(m[4] || 0) - (m[3]?.length || 0);
  if (Math.abs(exponent) > 500)
    throw Error('Number exponent exceeds the supported range.');
  const n = BigInt((m[2] || '0') + (m[3] || '')) * (m[1] === '-' ? -1n : 1n);
  return exponent >= 0
    ? normalized(n * 10n ** BigInt(exponent), 1n)
    : normalized(n, 10n ** BigInt(-exponent));
}
export const addQ = (a: Rational, b: Rational) =>
  normalized(a.n * b.d + b.n * a.d, a.d * b.d);
export const mulQ = (a: Rational, b: Rational) =>
  normalized(a.n * b.n, a.d * b.d);
export const negQ = (a: Rational) => ({ n: -a.n, d: a.d });
export const divQ = (a: Rational, b: Rational) =>
  normalized(a.n * b.d, a.d * b.n);
export const compareQ = (a: Rational, b: Rational) => {
  const d = a.n * b.d - b.n * a.d;
  return d < 0n ? -1 : d > 0n ? 1 : 0;
};
export const textQ = (a: Rational) =>
  a.d === 1n ? String(a.n) : `${a.n}/${a.d}`;
export function numberQ(a: Rational): number {
  const numerator = Number(a.n),
    denominator = Number(a.d);
  if (Number.isFinite(numerator) && Number.isFinite(denominator))
    return numerator / denominator;
  const n = (a.n < 0n ? -a.n : a.n).toString(),
    d = a.d.toString();
  const significand =
    Number(n.slice(0, 16)) /
    10 ** (Math.min(n.length, 16) - 1) /
    (Number(d.slice(0, 16)) / 10 ** (Math.min(d.length, 16) - 1));
  return Number(`${a.n < 0n ? '-' : ''}${significand}e${n.length - d.length}`);
}
