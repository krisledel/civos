import assert from 'node:assert/strict';
import { runRecordRegressions } from './record-regressions';
import {
  analyze,
  parseModel,
  modelInputs,
  expression,
  bounds,
  summarize,
  KERNEL_VERSION,
  type Model,
} from '../lib/kernel';
import { energyModel } from '../lib/kernel-example-data';
import { rational, compareQ } from '../lib/rational';
let checks = 0;
const equal = (actual: unknown, expected: unknown) => {
  assert.deepEqual(actual, expected);
  checks++;
};
const rejects = (fn: () => unknown) => {
  assert.throws(fn);
  checks++;
};
const make = (a: string, b: string): Model => ({
  version: KERNEL_VERSION,
  variables: [
    {
      id: 'x',
      label: 'X',
      unit: 'units',
      kind: 'fact',
      low: 0,
      value: 5,
      high: 10,
    },
  ],
  options: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  perspectives: [
    {
      id: 'p',
      label: 'P',
      rules: [
        { optionId: 'a', score: a, constraints: [] },
        { optionId: 'b', score: b, constraints: [] },
      ],
    },
  ],
});
const m = energyModel(),
  initial = analyze(m, modelInputs(m));
equal(
  initial.perspectives.map((p) => p.winners),
  [['flex'], ['reserve']],
);
equal(initial.sharedPreferred, []);
equal(initial.sharedFeasible, ['flex', 'balanced', 'reserve']);
equal(
  initial.perspectives[0].slices[0].boundaries.find((b) => b.exact === '4')
    ?.winners,
  ['flex', 'reserve'],
);
const narrowed = {
  ...modelInputs(m),
  price: { low: 4.2, value: 4.5, high: 4.8 },
};
equal(analyze(m, narrowed).sharedPreferred, ['reserve']);
equal(
  analyze(m, { ...narrowed, stress: { low: 3, value: 3.5, high: 4 } })
    .perspectives[1].rules[2].impossible,
  true,
);
equal(
  analyze(m, {
    ...narrowed,
    stress: { low: 3, value: 3.5, high: 4 },
  }).perspectives.map((p) => p.winners),
  [['balanced'], ['balanced']],
);
const signed = bounds(expression('5+2*x-3*y', ['x', 'y']), {
  x: { low: 1, value: 2, high: 3 },
  y: { low: -2, value: 1, high: 4 },
});
equal(signed.exact, { low: '-5', value: '6', high: '17' });
const cancel = make('x+1', 'x');
equal(
  analyze(cancel, modelInputs(cancel)).perspectives[0].pairs[0].range.exact,
  { low: '1', value: '1', high: '1' },
);
equal(analyze(cancel, modelInputs(cancel)).sharedPreferred, ['a']);
const maximin = make('x', '4');
equal(analyze(maximin, modelInputs(maximin)).sharedPreferred, []);
const multi = make('x', '6');
multi.perspectives.push({
  id: 'p2',
  label: 'P2',
  rules: [
    { optionId: 'a', score: '2*x', constraints: [] },
    { optionId: 'b', score: '8', constraints: [] },
  ],
});
const regions = analyze(multi, modelInputs(multi)).resolving[0].certificates;
equal(
  regions.map((c) => [c.optionId, c.lowExact, c.highExact]),
  [
    ['a', '6', '10'],
    ['b', '0', '4'],
  ],
);
const scaled = structuredClone(multi);
scaled.perspectives[1].rules[0].score = '200*x';
scaled.perspectives[1].rules[1].score = '800';
equal(
  analyze(scaled, modelInputs(scaled)).resolving,
  analyze(multi, modelInputs(multi)).resolving,
);
const constrained = make('2', '1');
constrained.perspectives[0].rules[0].constraints = [
  { label: 'Cap', expression: 'x', operator: '<=', limit: 5 },
];
const constraintResult = analyze(constrained, modelInputs(constrained));
equal(constraintResult.perspectives[0].rules[0].robust, false);
equal(constraintResult.perspectives[0].rules[0].impossible, false);
equal(constraintResult.measurements[0].constraints[0].label, 'Cap');
equal(
  constraintResult.perspectives[0].slices[0].boundaries.find(
    (b) => b.exact === '5',
  )?.winners,
  ['a'],
);
equal(constraintResult.perspectives[0].slices[0].segments.at(-1)?.winners, [
  'b',
]);
const impossible = make('2', '1');
impossible.variables[0] = {
  ...impossible.variables[0],
  low: 0,
  value: 0.5,
  high: 1,
};
impossible.perspectives[0].rules[0].constraints = [
  { label: 'Upper', expression: 'x', operator: '<=', limit: 0.25 },
  { label: 'Lower', expression: 'x', operator: '>=', limit: 0.75 },
];
const impossibleResult = analyze(impossible, modelInputs(impossible));
equal(impossibleResult.perspectives[0].rules[0].feasible, false);
equal(impossibleResult.perspectives[0].rules[0].robust, false);
equal(impossibleResult.perspectives[0].rules[0].impossible, false); // No joint LP proof is claimed.
const measurement = make('x+0.2*y-0.6', '0');
measurement.variables[0] = {
  ...measurement.variables[0],
  low: 0,
  value: 0.5,
  high: 1,
};
measurement.variables.push({
  id: 'y',
  label: 'Y',
  unit: 'units',
  kind: 'fact',
  low: 0,
  value: 0.5,
  high: 1,
});
equal(
  analyze(measurement, modelInputs(measurement)).resolving[0].certificates.map(
    (c) => [c.optionId, c.lowExact, c.highExact],
  ),
  [
    ['a', '3/5', '1'],
    ['b', '0', '2/5'],
  ],
);
equal(
  analyze(measurement, modelInputs(measurement)).resolving[1].certificates,
  [],
);
const huge = make('1', '0');
huge.variables = [
  {
    id: 'x',
    label: 'X',
    unit: 'u',
    kind: 'fact',
    low: 1e12,
    value: 1e12,
    high: 1e12,
  },
  {
    id: 'y',
    label: 'Y',
    unit: 'u',
    kind: 'fact',
    low: 1e12,
    value: 1e12,
    high: 1e12,
  },
];
huge.perspectives[0].rules[0].constraints = [
  {
    label: 'Cancellation',
    expression: '1000000000000*x - 1000000000000*y + 1',
    operator: '<=',
    limit: 0,
  },
];
equal(
  analyze(huge, modelInputs(huge)).perspectives[0].rules[0].constraints[0]
    .margin.exact.value,
  '-1',
);
equal(analyze(huge, modelInputs(huge)).sharedPreferred, ['b']);
const thirds = make('3*x', '1');
thirds.variables[0] = { ...thirds.variables[0], low: 0, value: 1 / 3, high: 1 };
equal(
  analyze(thirds, modelInputs(thirds)).resolving[0].certificates[0].lowExact,
  '1/3',
);
equal(analyze(thirds, modelInputs(thirds)).perspectives[0].winners, ['b']); // Canonical decimal 0.3333333333333333 is below 1/3.
equal(
  analyze(
    thirds,
    modelInputs(thirds),
  ).perspectives[0].slices[0].boundaries.find((b) => b.exact === '1/3')
    ?.winners,
  ['a', 'b'],
);
equal(bounds(expression('0.1+0.2-0.3', []), {}).exact.value, '0');
for (const text of [
  'x*x',
  '1/x',
  '1/0',
  'fetch(x)',
  'x;1',
  'Math.random()',
  '1e-1000000000',
  'unknown',
  '('.repeat(25) + '1' + ')'.repeat(25),
])
  rejects(() => expression(text, ['x']));
const malformed = JSON.parse(JSON.stringify(constrained));
malformed.perspectives[0].rules[0].constraints[0].operator = ['<='];
rejects(() => parseModel(JSON.stringify(malformed)));
const malformedKind = JSON.parse(JSON.stringify(constrained));
malformedKind.variables[0].kind = ['fact'];
rejects(() => parseModel(JSON.stringify(malformedKind)));
const wrongOrder = make('x', '0');
wrongOrder.variables[0].low = 11;
rejects(() => parseModel(JSON.stringify(wrongOrder)));
const missing = make('x', '0');
missing.perspectives[0].rules.pop();
rejects(() => parseModel(JSON.stringify(missing)));
const duplicate = make('x', '0');
duplicate.variables.push({ ...duplicate.variables[0] });
rejects(() => parseModel(JSON.stringify(duplicate)));
equal(bounds(expression('1.9+1e-308', []), {}).value, 1.9);
equal(bounds(expression('1e-309', []), {}).value, 1e-309);
const extremes = make('1000000000000', '-1000000000000');
equal(
  analyze(parseModel(JSON.stringify(extremes)), modelInputs(extremes))
    .sharedPreferred,
  ['a'],
);
rejects(() => expression('1000000000000+1', []));
equal(bounds(expression('5e-324', []), {}).value, 5e-324);
equal(summarize(analyze(m, narrowed, false)), summarize(analyze(m, narrowed)));
const complex = make('x', '0');
complex.variables = Array.from({ length: 8 }, (_, i) => ({
  id: 'x' + i,
  label: 'Input ' + i,
  kind: 'fact',
  unit: 'u',
  low: -1,
  value: 0,
  high: 1,
}));
complex.options = Array.from({ length: 6 }, (_, i) => ({
  id: 'o' + i,
  label: 'Option ' + i,
}));
const precise = (offset: number) =>
  complex.variables
    .map((v, i) => `${v.id}/(1+${i + offset + 1}e-150)`)
    .join('+');
complex.perspectives = [
  {
    id: 'p',
    label: 'Perspective',
    rules: complex.options.map((o, i) => ({
      optionId: o.id,
      score: precise(i * 9),
      constraints: Array.from({ length: 4 }, (_, j) => ({
        label: 'Constraint ' + j,
        expression: precise(i * 9 + j + 100),
        operator: '<=',
        limit: 0,
      })),
    })),
  },
];
assert.throws(
  () => analyze(parseModel(JSON.stringify(complex)), modelInputs(complex)),
  /complexity budget/,
);
checks++;
// A deterministic set of sign/cancellation cases checks extrema against every box corner.
for (let a = -3; a <= 3; a++)
  for (let b = -3; b <= 3; b++) {
    const expr = expression(`${a}*x+${b}*y+1`, ['x', 'y']);
    const range = bounds(expr, {
      x: { low: -2, value: 0, high: 3 },
      y: { low: -4, value: 0, high: 1 },
    });
    const corners = [-2, 3].flatMap((x) =>
      [-4, 1].map((y) => a * x + b * y + 1),
    );
    equal(range.low, Math.min(...corners));
    equal(range.high, Math.max(...corners));
    equal(
      compareQ(rational(range.exact.low), rational(range.exact.high)) <= 0,
      true,
    );
  }
console.log(
  JSON.stringify({
    kernelChecks: checks,
    recordChecks: await runRecordRegressions(),
    exactArithmetic: 'passed',
    boundsAndCertificates: 'passed',
    parserLimits: 'passed',
  }),
);
