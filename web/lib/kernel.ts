import {
  rational as q,
  addQ,
  mulQ,
  negQ,
  divQ,
  compareQ,
  textQ,
  numberQ,
  type Rational,
} from './rational';
export const KERNEL_VERSION = 'civos.affine.v1';
export type Variable = {
  id: string;
  label: string;
  unit: string;
  kind: 'fact' | 'assumption' | 'value';
  low: number;
  value: number;
  high: number;
};
export type Constraint = {
  label: string;
  expression: string;
  operator: '<=' | '>=';
  limit: number;
};
export type Rule = {
  optionId: string;
  score: string;
  constraints: Constraint[];
};
export type Perspective = { id: string; label: string; rules: Rule[] };
export type Model = {
  version: typeof KERNEL_VERSION;
  variables: Variable[];
  options: { id: string; label: string }[];
  perspectives: Perspective[];
};
export type Inputs = Record<
  string,
  { low: number; value: number; high: number }
>;
export type Affine = {
  constant: number;
  terms: Record<string, number>;
  exact?: { constant: string; terms: Record<string, string> };
};
const fail = (message: string): never => {
  throw Error(message);
};
const finite = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e12;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => {
  if (Object.keys(v).some((k) => !allowed.includes(k)))
    fail('Unknown model field.');
};
const label = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= 150;
const array = (v: unknown, max: number, min = 1): v is unknown[] =>
  Array.isArray(v) && v.length >= min && v.length <= max;
const constantQ = (a: Affine) => q(a.exact?.constant ?? a.constant);
const termsQ = (a: Affine): Record<string, Rational> =>
  Object.fromEntries(
    Object.entries(a.exact?.terms ?? a.terms).map(([k, n]) => [k, q(n)]),
  );
function affine(constant: Rational, terms: Record<string, Rational>): Affine {
  terms = Object.fromEntries(
    Object.entries(terms).filter(([, n]) => n.n !== 0n),
  );
  return {
    constant: numberQ(constant),
    terms: Object.fromEntries(
      Object.entries(terms).map(([k, n]) => [k, numberQ(n)]),
    ),
    exact: {
      constant: textQ(constant),
      terms: Object.fromEntries(
        Object.entries(terms).map(([k, n]) => [k, textQ(n)]),
      ),
    },
  };
}
export function combine(a: Affine, b: Affine, sign = 1): Affine {
  const terms = termsQ(a);
  for (const [k, n] of Object.entries(termsQ(b)))
    terms[k] = addQ(terms[k] || q(0), mulQ(q(sign), n));
  return affine(addQ(constantQ(a), mulQ(q(sign), constantQ(b))), terms);
}
const scale = (a: Affine, n: number | Rational): Affine =>
  affine(
    mulQ(constantQ(a), q(n)),
    Object.fromEntries(
      Object.entries(termsQ(a)).map(([k, v]) => [k, mulQ(v, q(n))]),
    ),
  );

// A bounded arithmetic parser, never JavaScript evaluation. Products must have a constant operand.
export function expression(text: string, variableIds: string[]): Affine {
  if (typeof text !== 'string' || text.length > 300 || !text.trim())
    return fail('Enter an arithmetic expression (maximum 300 characters).');
  const tokens: string[] = [];
  let rest = text.trim();
  while (rest) {
    const match =
      /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|^[A-Za-z][A-Za-z0-9_]*|^[()+*/-]/.exec(
        rest,
      );
    if (!match || tokens.length >= 120)
      return fail(
        'Unsupported expression. Use numbers, input names, +, −, *, / and parentheses.',
      );
    tokens.push(match[0]);
    rest = rest.slice(match[0].length).trimStart();
  }
  let cursor = 0,
    depth = 0;
  const atom = (): Affine => {
    if (++depth > 24) return fail('Expression nesting is too deep.');
    const t = tokens[cursor++];
    let result: Affine;
    if (t === '+' || t === '-') result = scale(atom(), t === '-' ? -1 : 1);
    else if (t === '(') {
      result = sum();
      if (tokens[cursor++] !== ')')
        return fail('Unclosed expression parentheses.');
    } else if (t && /^[A-Za-z]/.test(t)) {
      if (!variableIds.includes(t)) return fail('Unknown input: ' + t);
      result = { constant: 0, terms: { [t]: 1 } };
    } else if (t && finite(Number(t))) result = affine(q(t), {});
    else return fail('Expected a number or input name.');
    depth--;
    return result;
  };
  const product = (): Affine => {
    let result = atom();
    while (tokens[cursor] === '*' || tokens[cursor] === '/') {
      const op = tokens[cursor++],
        right = atom();
      if (op === '/') {
        if (Object.keys(right.terms).length || constantQ(right).n === 0n)
          return fail('Division requires a nonzero constant denominator.');
        result = scale(result, divQ(q(1), constantQ(right)));
      } else if (!Object.keys(right.terms).length)
        result = scale(result, constantQ(right));
      else if (!Object.keys(result.terms).length)
        result = scale(right, constantQ(result));
      else
        return fail(
          'Nonlinear products are not supported. Multiply an input by a constant.',
        );
    }
    return result;
  };
  const sum = (): Affine => {
    let result = product();
    while (tokens[cursor] === '+' || tokens[cursor] === '-') {
      const sign = tokens[cursor++] === '+' ? 1 : -1;
      result = combine(result, product(), sign);
    }
    return result;
  };
  const result = sum();
  if (cursor !== tokens.length) return fail('Unexpected expression token.');
  if (
    [constantQ(result), ...Object.values(termsQ(result))].some(
      (n) => compareQ(n, q(1e12)) > 0 || compareQ(n, q(-1e12)) < 0,
    )
  )
    return fail('Expression coefficients exceed the supported range.');
  return result;
}

export function parseModel(text: string): Model {
  if (typeof text !== 'string' || text.length > 24000)
    return fail('Model definition exceeds 24,000 characters.');
  let m: unknown;
  try {
    m = JSON.parse(text);
  } catch {
    return fail('Model definition must be valid JSON.');
  }
  if (!object(m)) return fail('Model definition must be an object.');
  keys(m, ['version', 'variables', 'options', 'perspectives']);
  if (
    m.version !== KERNEL_VERSION ||
    !array(m.variables, 8) ||
    !array(m.options, 6, 2) ||
    !array(m.perspectives, 4)
  )
    return fail(
      'Use affine v1 with 1–8 inputs, 2–6 options and 1–4 perspectives.',
    );
  const ids: string[] = [];
  for (const v of m.variables) {
    if (!object(v)) return fail('Invalid input.');
    keys(v, ['id', 'label', 'unit', 'kind', 'low', 'value', 'high']);
    if (
      typeof v.id !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9_]{0,23}$/.test(v.id) ||
      ids.includes(v.id) ||
      Object.hasOwn(Object.prototype, v.id) ||
      v.id === 'prototype' ||
      !label(v.label) ||
      !label(v.unit) ||
      typeof v.kind !== 'string' ||
      !['fact', 'assumption', 'value'].includes(v.kind) ||
      !finite(v.low) ||
      !finite(v.value) ||
      !finite(v.high) ||
      v.low > v.value ||
      v.value > v.high
    )
      return fail(
        'Each input needs a unique name, unit, category and low ≤ value ≤ high.',
      );
    ids.push(v.id);
  }
  const optionIds: string[] = [];
  for (const o of m.options) {
    if (!object(o)) return fail('Invalid option.');
    keys(o, ['id', 'label']);
    if (!label(o.id) || !label(o.label) || optionIds.includes(o.id))
      return fail('Options need unique IDs and labels.');
    optionIds.push(o.id);
  }
  const perspectiveIds: string[] = [];
  for (const p of m.perspectives) {
    if (!object(p)) return fail('Invalid perspective.');
    keys(p, ['id', 'label', 'rules']);
    if (
      !label(p.id) ||
      !label(p.label) ||
      perspectiveIds.includes(p.id) ||
      !array(p.rules, 6, optionIds.length) ||
      p.rules.length !== optionIds.length
    )
      return fail('Every perspective needs one rule per option.');
    perspectiveIds.push(p.id);
    const seen: string[] = [];
    for (const r of p.rules) {
      if (!object(r)) return fail('Invalid option rule.');
      keys(r, ['optionId', 'score', 'constraints']);
      if (
        typeof r.optionId !== 'string' ||
        !optionIds.includes(r.optionId) ||
        seen.includes(r.optionId) ||
        typeof r.score !== 'string' ||
        !array(r.constraints, 4, 0)
      )
        return fail('Invalid score rule or constraint list.');
      seen.push(r.optionId);
      expression(r.score, ids);
      for (const c of r.constraints) {
        if (!object(c)) return fail('Invalid constraint.');
        keys(c, ['label', 'expression', 'operator', 'limit']);
        if (
          !label(c.label) ||
          typeof c.expression !== 'string' ||
          typeof c.operator !== 'string' ||
          !['<=', '>='].includes(c.operator) ||
          !finite(c.limit)
        )
          return fail(
            'A constraint needs a label, expression, comparison and numeric limit.',
          );
        expression(c.expression, ids);
      }
    }
  }
  return m as unknown as Model;
}
export function modelInputs(model: Model): Inputs {
  return Object.fromEntries(
    model.variables.map((v) => [
      v.id,
      { low: v.low, value: v.value, high: v.high },
    ]),
  );
}
export function validateInputs(model: Model, inputs: Inputs) {
  if (
    !object(inputs) ||
    Object.keys(inputs).sort().join() !==
      model.variables
        .map((v) => v.id)
        .sort()
        .join()
  )
    fail('Inputs do not match the model.');
  for (const v of model.variables) {
    const x = inputs[v.id];
    if (!object(x)) fail('Invalid input interval.');
    keys(x, ['low', 'value', 'high']);
    if (
      !finite(x.low) ||
      !finite(x.value) ||
      !finite(x.high) ||
      x.low > x.value ||
      x.value > x.high
    )
      fail('Input intervals require low ≤ value ≤ high.');
  }
}
export function bounds(
  a: Affine,
  inputs: Inputs,
  pin?: { id: string; value: Rational },
) {
  let low = constantQ(a),
    value = constantQ(a),
    high = constantQ(a);
  for (const [id, n] of Object.entries(termsQ(a))) {
    const v = inputs[id];
    if (!v) return fail('Missing input: ' + id);
    const fixed = pin?.id === id ? pin.value : null;
    low = addQ(low, mulQ(n, fixed || q(n.n >= 0n ? v.low : v.high)));
    high = addQ(high, mulQ(n, fixed || q(n.n >= 0n ? v.high : v.low)));
    value = addQ(value, mulQ(n, fixed || q(v.value)));
  }
  const values = {
    low: numberQ(low),
    value: numberQ(value),
    high: numberQ(high),
  };
  if (!Object.values(values).every(Number.isFinite))
    return fail('Calculation overflow.');
  return {
    ...values,
    exact: { low: textQ(low), value: textQ(value), high: textQ(high) },
  };
}
const sign = (value: string) =>
  q(value).n < 0n ? -1 : q(value).n > 0n ? 1 : 0;
export type Certificate = {
  optionId: string;
  low: number;
  high: number;
  lowExact: string;
  highExact: string;
};
function restrict(
  interval: { low: Rational; high: Rational },
  a: Rational,
  b: Rational,
) {
  if (a.n === 0n) return b.n >= 0n ? interval : null;
  const boundary = divQ(negQ(b), a);
  const next =
    a.n > 0n
      ? {
          low: compareQ(interval.low, boundary) > 0 ? interval.low : boundary,
          high: interval.high,
        }
      : {
          low: interval.low,
          high:
            compareQ(interval.high, boundary) < 0 ? interval.high : boundary,
        };
  return compareQ(next.low, next.high) <= 0 ? next : null;
}
const certificate = (
  optionId: string,
  x: { low: Rational; high: Rational },
): Certificate => ({
  optionId,
  low: numberQ(x.low),
  high: numberQ(x.high),
  lowExact: textQ(x.low),
  highExact: textQ(x.high),
});
export function analyze(model: Model, inputs: Inputs, detailed = true) {
  validateInputs(model, inputs);
  const ids = model.variables.map((v) => v.id);
  let coefficientSize = 0;
  const compile = (text: string) => {
    const result = expression(text, ids);
    coefficientSize +=
      textQ(constantQ(result)).length +
      Object.values(termsQ(result)).reduce(
        (total, value) => total + textQ(value).length,
        0,
      );
    if (coefficientSize > 24000)
      fail(
        'Model exceeds the exact-arithmetic complexity budget. Simplify equations or reduce coefficient precision.',
      );
    return result;
  };
  const compiled = model.perspectives.map((p) =>
    p.rules.map((r) => ({
      score: compile(r.score),
      margins: r.constraints.map((c) =>
        scale(
          combine({ constant: c.limit, terms: {} }, compile(c.expression), -1),
          c.operator === '<=' ? 1 : -1,
        ),
      ),
    })),
  );
  const differences = new Map<Affine, Map<Affine, Affine>>();
  const difference = (a: Affine, b: Affine) => {
    let row = differences.get(a);
    if (!row) {
      row = new Map();
      differences.set(a, row);
    }
    let result = row.get(b);
    if (!result) {
      result = combine(a, b, -1);
      row.set(b, result);
    }
    return result;
  };
  const evaluations = new Map<
    Affine,
    { value: Rational; terms: Record<string, Rational> }
  >();
  const at = (a: Affine, pin?: { id: string; value: Rational }) => {
    let cached = evaluations.get(a);
    if (!cached) {
      const terms = termsQ(a);
      let value = constantQ(a);
      for (const [id, coefficient] of Object.entries(terms))
        value = addQ(value, mulQ(coefficient, q(inputs[id].value)));
      cached = { value, terms };
      evaluations.set(a, cached);
    }
    return pin && cached.terms[pin.id]
      ? addQ(
          cached.value,
          mulQ(
            cached.terms[pin.id],
            addQ(pin.value, negQ(q(inputs[pin.id].value))),
          ),
        )
      : cached.value;
  };
  const perspectives = model.perspectives.map((p, pi) => {
    const rules = p.rules.map((rule, ri) => {
      const score = compiled[pi][ri].score,
        range = bounds(score, inputs);
      const constraints = rule.constraints.map((c, ci) => {
        const marginExpression = compiled[pi][ri].margins[ci];
        return {
          ...c,
          compiled: marginExpression,
          margin: bounds(marginExpression, inputs),
        };
      });
      return {
        optionId: rule.optionId,
        score,
        range,
        constraints,
        feasible: constraints.every((c) => sign(c.margin.exact.value) >= 0),
        robust: constraints.every((c) => sign(c.margin.exact.low) >= 0),
        impossible: constraints.some((c) => sign(c.margin.exact.high) < 0),
      };
    });
    const preferred = (pin?: { id: string; value: Rational }) => {
      const available = rules.filter((r) =>
        r.constraints.every((c) => at(c.compiled, pin).n >= 0n),
      );
      const scores = new Map(
        available.map((r) => [r.optionId, at(r.score, pin)]),
      );
      return available
        .filter((r) =>
          available.every(
            (other) =>
              compareQ(scores.get(r.optionId)!, scores.get(other.optionId)!) >=
              0,
          ),
        )
        .map((r) => r.optionId);
    };
    const winners = preferred();
    const guaranteed = rules
      .filter(
        (r) =>
          r.robust &&
          rules.every(
            (other) =>
              other === r ||
              other.impossible ||
              sign(
                bounds(difference(r.score, other.score), inputs).exact.low,
              ) >= 0,
          ),
      )
      .map((r) => r.optionId);
    const pairs = (detailed ? rules : []).flatMap((a, i) =>
      rules.slice(i + 1).map((b) => {
        const gap = difference(a.score, b.score),
          range = bounds(gap, inputs),
          terms = termsQ(gap);
        const contributions = model.variables.map((v) => {
          const coefficient = terms[v.id] || q(0),
            width = mulQ(
              addQ(q(inputs[v.id].high), negQ(q(inputs[v.id].low))),
              coefficient.n < 0n ? negQ(coefficient) : coefficient,
            );
          return {
            id: v.id,
            kind: v.kind,
            label: v.label,
            coefficient: numberQ(coefficient),
            coefficientExact: textQ(coefficient),
            atValue: numberQ(mulQ(coefficient, q(inputs[v.id].value))),
            width: numberQ(width),
            widthExact: textQ(width),
          };
        });
        return {
          a: a.optionId,
          b: b.optionId,
          constant: gap.constant,
          constantExact: textQ(constantQ(gap)),
          range,
          contributions,
        };
      }),
    );
    const slices = (detailed ? model.variables : []).map((v) => {
      const interval = inputs[v.id],
        points = new Map<string, Rational>();
      for (const n of [interval.low, interval.high])
        points.set(textQ(q(n)), q(n));
      const addRoot = (a: Affine) => {
        const n = termsQ(a)[v.id] || q(0);
        if (n.n === 0n) return;
        const intercept = addQ(at(a), negQ(mulQ(n, q(interval.value)))),
          root = divQ(negQ(intercept), n);
        if (
          compareQ(root, q(interval.low)) > 0 &&
          compareQ(root, q(interval.high)) < 0
        )
          points.set(textQ(root), root);
      };
      for (const a of rules) {
        for (const b of rules)
          if (a !== b) addRoot(difference(a.score, b.score));
        for (const c of a.constraints) addRoot(c.compiled);
      }
      const cuts = [...points.values()].sort(compareQ);
      const segments = cuts.slice(0, -1).map((low, i) => ({
        low: numberQ(low),
        high: numberQ(cuts[i + 1]),
        lowExact: textQ(low),
        highExact: textQ(cuts[i + 1]),
        winners: preferred({
          id: v.id,
          value: divQ(addQ(low, cuts[i + 1]), q(2)),
        }),
      }));
      const certificates: Certificate[] = [];
      for (const rule of rules) {
        let valid: { low: Rational; high: Rational } | null = {
          low: q(interval.low),
          high: q(interval.high),
        };
        const requirements = [
          ...rule.constraints.map((c) => c.compiled),
          ...rules
            .filter((r) => r !== rule && !r.impossible)
            .map((r) => difference(rule.score, r.score)),
        ];
        for (const req of requirements) {
          const terms = termsQ(req),
            n = terms[v.id] || q(0);
          delete terms[v.id];
          if (valid)
            valid = restrict(
              valid,
              n,
              q(bounds(affine(constantQ(req), terms), inputs).exact.low),
            );
        }
        if (valid) certificates.push(certificate(rule.optionId, valid));
      }
      return {
        variableId: v.id,
        segments,
        certificates,
        boundaries: cuts.map((value) => ({
          value: numberQ(value),
          exact: textQ(value),
          winners: preferred({ id: v.id, value }),
        })),
      };
    });
    return {
      id: p.id,
      label: p.label,
      rules,
      winners,
      guaranteed,
      pairs,
      slices,
    };
  });
  const sharedFeasible = model.options
    .filter((o) =>
      perspectives.every(
        (p) => p.rules.find((r) => r.optionId === o.id)!.robust,
      ),
    )
    .map((o) => o.id);
  const sharedPreferred = model.options
    .filter((o) => perspectives.every((p) => p.guaranteed.includes(o.id)))
    .map((o) => o.id);
  const resolving = (detailed ? model.variables : []).map((v) => ({
    variableId: v.id,
    certificates: model.options.flatMap((o) => {
      let low = q(inputs[v.id].low),
        high = q(inputs[v.id].high);
      for (const p of perspectives) {
        const c = p.slices
          .find((s) => s.variableId === v.id)!
          .certificates.find((c) => c.optionId === o.id);
        if (!c) return [];
        if (compareQ(q(c.lowExact), low) > 0) low = q(c.lowExact);
        if (compareQ(q(c.highExact), high) < 0) high = q(c.highExact);
      }
      return compareQ(low, high) <= 0 ? [certificate(o.id, { low, high })] : [];
    }),
  }));
  const measurements = (detailed ? model.variables : [])
    .filter((v) => v.kind === 'fact' && inputs[v.id].high > inputs[v.id].low)
    .map((v) => {
      const comparisons = perspectives.flatMap((p) =>
        p.pairs
          .filter(
            (pair) =>
              sign(pair.range.exact.low) < 0 &&
              sign(pair.range.exact.high) > 0 &&
              pair.contributions.some(
                (c) => c.id === v.id && q(c.widthExact).n > 0n,
              ),
          )
          .map((pair) => {
            const width = q(
                pair.contributions.find((c) => c.id === v.id)!.widthExact,
              ),
              total = addQ(
                q(pair.range.exact.high),
                negQ(q(pair.range.exact.low)),
              );
            return {
              perspectiveId: p.id,
              a: pair.a,
              b: pair.b,
              widthRemoved: numberQ(width),
              fractionRemoved: numberQ(divQ(width, total)),
            };
          }),
      );
      const constraints = perspectives.flatMap((p) =>
        p.rules.flatMap((r) =>
          r.constraints
            .filter(
              (c) =>
                sign(c.margin.exact.low) < 0 &&
                sign(c.margin.exact.high) >= 0 &&
                (termsQ(c.compiled)[v.id]?.n || 0n) !== 0n,
            )
            .map((c) => ({
              perspectiveId: p.id,
              optionId: r.optionId,
              label: c.label,
            })),
        ),
      );
      return { variableId: v.id, comparisons, constraints };
    })
    .filter((m) => m.comparisons.length || m.constraints.length)
    .sort(
      (a, b) =>
        b.comparisons.length +
          b.constraints.length -
          (a.comparisons.length + a.constraints.length) ||
        (a.variableId < b.variableId
          ? -1
          : a.variableId > b.variableId
            ? 1
            : 0),
    );
  return {
    version: KERNEL_VERSION,
    inputs,
    perspectives,
    sharedFeasible,
    sharedPreferred,
    measurements,
    resolving,
  };
}
export type Analysis = ReturnType<typeof analyze>;
export function summarize(a: Analysis) {
  return {
    version: a.version,
    inputs: a.inputs,
    perspectives: a.perspectives.map((p) => ({
      id: p.id,
      winners: p.winners,
      guaranteed: p.guaranteed,
      options: p.rules.map((r) => ({
        id: r.optionId,
        range: r.range,
        feasible: r.feasible,
        robust: r.robust,
        impossible: r.impossible,
      })),
    })),
    sharedFeasible: a.sharedFeasible,
    sharedPreferred: a.sharedPreferred,
  };
}
