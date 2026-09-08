import type { Entry, Proposal, Finding } from './model';
import {
  analyze,
  parseModel,
  modelInputs,
  summarize,
  KERNEL_VERSION,
  type Model,
  type Inputs,
} from './kernel';
const active = (entries: Entry[]) => {
  const old = new Set(entries.map((e) => e.supersedes));
  return entries.filter((e) => !old.has(e.id));
};
const ids = (value: unknown): string[] =>
  Array.isArray(value) ? (value as string[]) : [];
const fail = (message: string): never => {
  throw Error(message);
};
export function readModel(entry: Entry) {
  return parseModel(String(entry.data.definition));
}
export function inputsFor(
  modelEntry: Entry,
  measurements: Entry[],
  scenarioText = '{}',
) {
  const model = readModel(modelEntry),
    inputs = modelInputs(model),
    seen = new Set<string>();
  for (const e of measurements) {
    const key = String(e.data.variable),
      v = model.variables.find((v) => v.id === key);
    if (
      e.kind !== 'model_measurement' ||
      e.data.modelId !== modelEntry.id ||
      !v ||
      seen.has(key) ||
      v.unit !== e.data.unit
    )
      fail(
        'Choose at most one measurement per input from this exact model version.',
      );
    seen.add(key);
    inputs[key] = {
      low: Number(e.data.low),
      value: Number(e.data.value),
      high: Number(e.data.high),
    };
  }
  let scenario: unknown;
  try {
    scenario = JSON.parse(scenarioText);
  } catch {
    fail('Scenario must be valid JSON.');
  }
  if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario))
    fail('Scenario must map input names to reference values.');
  for (const [key, value] of Object.entries(scenario as object)) {
    if (
      !Object.hasOwn(inputs, key) ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < inputs[key].low ||
      value > inputs[key].high
    )
      fail('Scenario values must lie inside their evidence intervals.');
    inputs[key] = { ...inputs[key], value };
  }
  return { model, inputs };
}
export function runAnalysis(run: Entry, entries: Entry[]) {
  const m = entries.find(
    (e) => e.id === run.data.modelId && e.kind === 'model',
  );
  if (!m) return fail('The model version is missing.');
  const measurements = ids(run.data.measurementIds).map(
    (id) => entries.find((e) => e.id === id) || fail('Measurement is missing.'),
  );
  const { model, inputs } = inputsFor(
    m,
    measurements,
    String(run.data.scenario || '{}'),
  );
  return analyze(model, inputs, false);
}
export function runProposal(
  entries: Entry[],
  modelId: string,
  measurementIds: string[],
  scenario: string,
  title: string,
): Proposal {
  const model =
    entries.find((e) => e.id === modelId && e.kind === 'model') ||
    fail('Choose a model.');
  const measurements = measurementIds.map(
    (id) => entries.find((e) => e.id === id) || fail('Measurement is missing.'),
  );
  const basis = inputsFor(model, measurements, scenario),
    result = analyze(basis.model, basis.inputs, false);
  return {
    kind: 'model_run',
    caseId: model.caseId,
    data: {
      title,
      modelId,
      measurementIds,
      scenario,
      kernelVersion: KERNEL_VERSION,
      baseSequence: entries.length,
      baseHead: entries.at(-1)?.hash || '0'.repeat(64),
      result: JSON.stringify(summarize(result)),
    },
  };
}
export function validateKernel(
  p: Proposal,
  prior: Entry[],
  restoring: boolean,
  localStart: number,
) {
  if (p.kind === 'model') {
    const m = parseModel(String(p.data.definition));
    for (const [objects, field] of [
      [m.options, 'optionIds'],
      [m.perspectives, 'frameIds'],
    ] as const) {
      if (
        JSON.stringify(objects.map((o) => o.id).sort()) !==
        JSON.stringify(ids(p.data[field]).slice().sort())
      )
        fail('Model options and perspectives must match the linked records.');
      for (const item of objects)
        if (prior.find((e) => e.id === item.id)?.data.title !== item.label)
          fail(
            'Use the exact titles of the linked option and perspective records.',
          );
    }
    analyze(m, modelInputs(m));
  }
  if (p.kind === 'model_measurement') {
    const parent = prior.find((e) => e.id === p.data.modelId)!;
    const variable = readModel(parent).variables.find(
      (v) => v.id === p.data.variable,
    );
    if (!variable || variable.kind !== 'fact' || variable.unit !== p.data.unit)
      fail('Measurements require a factual input and its exact declared unit.');
    if (
      Number(p.data.low) > Number(p.data.value) ||
      Number(p.data.value) > Number(p.data.high)
    )
      fail('Measurements require low ≤ value ≤ high.');
    if (
      [p.data.low, p.data.value, p.data.high].some(
        (n) => Math.abs(Number(n)) > 1e12,
      )
    )
      fail('Measurement exceeds the supported range.');
    if (p.supersedes) {
      const old = prior.find((e) => e.id === p.supersedes)!;
      if (
        old.data.modelId !== p.data.modelId ||
        old.data.variable !== p.data.variable
      )
        fail('A measurement revision must keep its model version and input.');
    }
  }
  if (p.kind === 'model_run') {
    if (p.supersedes)
      fail('Saved analyses are immutable. Save a new analysis.');
    if (
      p.data.kernelVersion !== KERNEL_VERSION ||
      p.data.baseSequence !== prior.length ||
      p.data.baseHead !== (prior.at(-1)?.hash || '0'.repeat(64))
    )
      fail(
        'Analysis must identify its exact history prefix and supported kernel.',
      );
    const generated = runProposal(
      prior,
      String(p.data.modelId),
      ids(p.data.measurementIds),
      String(p.data.scenario),
      String(p.data.title),
    );
    if (p.data.result !== generated.data.result)
      fail('Stored analysis does not match the reproducible calculation.');
  }
  if (p.kind === 'decision' && p.data.modelRunId) {
    const run = prior.find((e) => e.id === p.data.modelRunId)!;
    const model = prior.find((e) => e.id === run.data.modelId)!;
    if (!ids(model.data.optionIds).includes(String(p.data.optionId)))
      fail('The analysis does not contain the selected decision option.');
    if (!restoring) {
      if (run.seq < localStart)
        fail(
          'Create a local analysis before attaching it to a local decision.',
        );
      const status = runStatus(run, prior);
      if (status.state !== 'current')
        fail(
          'The analysis basis changed. Save a new analysis before deciding.',
        );
    }
    if (
      runAnalysis(run, prior).perspectives.some(
        (perspective) =>
          !perspective.rules.find((r) => r.optionId === p.data.optionId)
            ?.feasible,
      )
    )
      fail(
        'The selected option violates a modeled hard constraint at the saved reference inputs.',
      );
  }
}
export function currentMeasurements(modelId: string, entries: Entry[]) {
  return active(entries).filter(
    (e) => e.kind === 'model_measurement' && e.data.modelId === modelId,
  );
}
export function runStatus(
  run: Entry,
  entries: Entry[],
): {
  state: 'current' | 'changed' | 'blocked';
  detail: string;
  live?: ReturnType<typeof analyze>;
} {
  const model = entries.find((e) => e.id === run.data.modelId);
  if (!model) return { state: 'blocked', detail: 'Model missing' };
  const selected = ids(run.data.measurementIds).map((id) =>
    entries.find((e) => e.id === id)!,
  );
  const dependencyIds = [
    model.id,
    ...ids(model.data.optionIds),
    ...ids(model.data.frameIds),
    ...ids(model.data.sourceIds),
    ...selected.flatMap((e) => ids(e?.data.sourceIds)),
  ];
  if (dependencyIds.some((id) => entries.some((e) => e.supersedes === id)))
    return {
      state: 'blocked',
      detail:
        'A linked model, option, perspective or source was revised. Review the exact versions.',
    };
  const latest = currentMeasurements(model.id, entries);
  let changed = false;
  const revised: Entry[] = [];
  for (const v of readModel(model).variables) {
    const old = selected.find((e) => e.data.variable === v.id),
      candidates = latest.filter((e) => e.data.variable === v.id);
    if (
      candidates.some((e) => e.seq > run.seq) ||
      (old && !candidates.some((e) => e.id === old.id))
    ) {
      changed = true;
      if (candidates.length !== 1)
        return {
          state: 'blocked',
          detail:
            'New conflicting measurements require an explicit choice of evidence.',
        };
      revised.push(candidates[0]);
    } else if (old) revised.push(old);
  }
  if (
    revised.some((measurement) =>
      ids(measurement.data.sourceIds).some((id) =>
        entries.some((e) => e.supersedes === id),
      ),
    )
  )
    return {
      state: 'blocked',
      detail:
        'A source supporting the new measurement was revised. Review its exact version.',
    };
  if (!changed) return { state: 'current', detail: 'Exact basis unchanged' };
  try {
    const basis = inputsFor(model, revised, String(run.data.scenario)),
      live = analyze(basis.model, basis.inputs, false),
      old = runAnalysis(run, entries);
    const choice = (a: ReturnType<typeof analyze>) =>
      JSON.stringify({
        p: a.perspectives.map((p) => ({
          id: p.id,
          w: p.winners,
          g: p.guaranteed,
          f: p.rules.map((r) => ({
            feasible: r.feasible,
            robust: r.robust,
            impossible: r.impossible,
          })),
        })),
        f: a.sharedFeasible,
        g: a.sharedPreferred,
      });
    return {
      state: 'changed',
      detail:
        choice(old) === choice(live)
          ? 'Evidence changed; preferred options and feasibility are unchanged.'
          : 'Evidence changed; preference or feasibility changed.',
      live,
    };
  } catch {
    return {
      state: 'blocked',
      detail:
        'New measurements invalidate the saved scenario. Recalculate with explicit inputs.',
    };
  }
}
export function kernelFindings(entries: Entry[]): Finding[] {
  const runs = new Map<string, ReturnType<typeof runStatus>>();
  const result: Finding[] = [];
  for (const e of active(entries)) {
    const run =
      e.kind === 'model_run'
        ? e
        : e.kind === 'decision' && e.data.modelRunId
          ? entries.find((r) => r.id === e.data.modelRunId)
          : null;
    if (!run) continue;
    let status = runs.get(run.id);
    if (!status) {
      status = runStatus(run, entries);
      runs.set(run.id, status);
    }
    if (status.state !== 'current')
      result.push({
        type: 'model',
        title:
          e.kind === 'decision'
            ? 'Decision analysis needs review'
            : 'Analysis basis changed',
        detail: String(e.data.title) + ': ' + status.detail,
        ids: [e.id, run.id],
        severity: 'warning',
      });
  }
  return result;
}
export function draftModel(options: Entry[], frames: Entry[]): Model {
  return {
    version: KERNEL_VERSION,
    variables: [
      {
        id: 'x',
        label: 'Measured input',
        unit: 'units',
        kind: 'fact',
        low: 0,
        value: 5,
        high: 10,
      },
    ],
    options: options.map((e) => ({ id: e.id, label: String(e.data.title) })),
    perspectives: frames.map((e) => ({
      id: e.id,
      label: String(e.data.title),
      rules: options.map((o, i) => ({
        optionId: o.id,
        score: i === 0 ? 'x' : String(4 + i),
        constraints: [],
      })),
    })),
  };
}
export type { Model, Inputs };
