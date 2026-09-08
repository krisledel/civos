'use client';
import { useId, useState } from 'react';
import {
  Plus,
  ArrowUpRight,
  RotateCcw,
  Save,
  FlaskConical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Picker, request, date, type Snapshot } from './forms';
import { active, type Entry, type Data } from '@/lib/model';
import { analyze, parseModel, type Model } from '@/lib/kernel';
import {
  readModel,
  inputsFor,
  currentMeasurements,
  runStatus,
  runAnalysis,
  draftModel,
} from '@/lib/kernel-records';
const number = (n: number) =>
  n.toLocaleString('en-GB', { maximumSignificantDigits: 6 });
const exact = (n: string) => n;
const colours = [
  '#e3b66d',
  '#82b7bb',
  '#b6a3ce',
  '#c58b87',
  '#a4b58b',
  '#aeb9c6',
];
type Props = {
  snapshot: Snapshot;
  caseId: string;
  canCreate: (kind: string) => boolean;
  onOpen: (entry: Entry) => void;
  onCreate: (kind: string, initial: Data, caseId: string) => void;
  onRefresh: () => Promise<void>;
  onExample: () => Promise<void>;
  onNavigate: (layer: string) => void;
};
export function ModelWorkbench({
  snapshot,
  caseId,
  canCreate,
  onOpen,
  onCreate,
  onRefresh,
  onExample,
  onNavigate,
}: Props) {
  const { entries, space } = snapshot;
  const current = active(entries),
    models = current.filter(
      (e) => e.kind === 'model' && (caseId === 'all' || e.caseId === caseId),
    );
  const [modelId, setModelId] = useState(models[0]?.id || ''),
    [selections, setSelections] = useState<Record<string, string>>({}),
    [scenario, setScenario] = useState<Record<string, number>>({});
  const [editor, setEditor] = useState<{ entry?: Entry } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [axis, setAxis] = useState('');
  let selectedModelId = modelId;
  for (const record of entries)
    if (record.kind === 'model' && record.supersedes === selectedModelId)
      selectedModelId = record.id;
  const chosen = models.find((m) => m.id === selectedModelId) || models[0];
  if (!modelId && chosen) setModelId(chosen.id);
  const [inputModelId, setInputModelId] = useState(chosen?.id || '');
  if (inputModelId !== (chosen?.id || '')) {
    setInputModelId(chosen?.id || '');
    setSelections({});
    setScenario({});
    setAxis('');
  }
  const perform = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The action failed.');
    } finally {
      setBusy(false);
    }
  };
  const evaluation = (() => {
    if (!chosen) return null;
    try {
      const model = readModel(chosen),
        measurements = currentMeasurements(chosen.id, entries),
        selected: Entry[] = [];
      for (const v of model.variables) {
        const candidates = measurements.filter((e) => e.data.variable === v.id),
          selection = selections[v.id];
        if (selection === undefined && candidates.length > 1)
          throw Error(
            'Conflicting measurements for ' +
              v.label +
              '. Choose the evidence explicitly.',
          );
        const id = selection === undefined ? candidates[0]?.id : selection;
        if (id) {
          const e = candidates.find((e) => e.id === id);
          if (!e)
            throw Error(
              'A selected measurement was revised. Choose its replacement or reset the inputs.',
            );
          selected.push(e);
        }
      }
      const { inputs } = inputsFor(chosen, selected, JSON.stringify(scenario));
      return {
        model,
        measurements,
        selected,
        analysis: analyze(model, inputs),
        error: '',
      };
    } catch (e) {
      return {
        model: readModel(chosen),
        measurements: currentMeasurements(chosen.id, entries),
        selected: [],
        analysis: null,
        error: e instanceof Error ? e.message : 'Cannot evaluate model.',
      };
    }
  })();
  const model = evaluation?.model,
    analysis = evaluation?.analysis;
  const optionName = (id: string) =>
    model?.options.find((o) => o.id === id)?.label || id;
  const names = (ids: string[]) =>
    ids.length ? ids.map(optionName).join(' / ') : 'Not established';
  const selectedAxis =
    model?.variables.find((v) => v.id === axis) || model?.variables[0];
  const runs = current
    .filter((e) => e.kind === 'model_run' && e.data.modelId === chosen?.id)
    .reverse();
  const modelCase =
    chosen?.caseId ||
    (caseId !== 'all' ? caseId : current.find((e) => e.kind === 'case')?.id) ||
    '';
  return (
    <section className="model-workbench">
      <div className="model-toolbar">
        <div>
          <span className="small-label">COMPUTATIONAL MODELS</span>
          <h2>Where do the perspectives diverge?</h2>
        </div>
        <div className="button-row">
          <a
            className="text-button"
            href="/articles/civos-models.html"
            target="_blank"
            rel="noreferrer"
          >
            Model guide ↗
          </a>
          {models.length > 0 && (
            <Picker
              label="Choose model"
              value={chosen.id}
              change={(id) => {
                setModelId(id);
                setSelections({});
                setScenario({});
              }}
              options={models.map((e) => ({
                id: e.id,
                label: String(e.data.title),
              }))}
            />
          )}
          {canCreate('model') && (
            <Button variant="outline" onClick={() => setEditor({})}>
              <Plus size={15} /> New model
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => perform(onExample)}
          >
            <FlaskConical size={15} /> Open synthetic example
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="message error">
          {error}
        </p>
      )}
      {notice && <output className="message success">{notice}</output>}
      {!chosen ? (
        <div className="model-empty">
          <h3>Make the assumptions executable.</h3>
          <p>
            Connect options and perspectives to explicit score equations and
            hard constraints. Vary the inputs, inspect uncertainty and save a
            reproducible analysis.
          </p>
          <p>
            The synthetic example opens a separate workspace with three energy
            packages, two perspectives and invented input ranges.
          </p>
          <div className="button-row">
            <Button onClick={() => perform(onExample)} disabled={busy}>
              Open the worked example <ArrowUpRight size={16} />
            </Button>
            <Button variant="ghost" onClick={() => onNavigate('decide')}>
              Register options
            </Button>
            <Button variant="ghost" onClick={() => onNavigate('frames')}>
              Register perspectives
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="model-heading">
            <div>
              <h3>{String(chosen.data.title)}</h3>
              <p>{String(chosen.data.limitations)}</p>
            </div>
            <div className="button-row">
              <Button variant="ghost" onClick={() => onOpen(chosen)}>
                Exact version <ArrowUpRight size={14} />
              </Button>
              {canCreate('model') && (
                <Button
                  variant="outline"
                  onClick={() => setEditor({ entry: chosen })}
                >
                  Edit model
                </Button>
              )}
            </div>
          </div>
          <div className="model-layout">
            <aside className="model-inputs">
              <div className="model-section-label">
                <h3>Inputs</h3>
                <Button
                  variant="ghost"
                  aria-label="Reset reference values and evidence choices"
                  onClick={() => {
                    setScenario({});
                    setSelections({});
                  }}
                >
                  <RotateCcw size={15} />
                </Button>
              </div>
              <p className="help">
                Reference values drive the current comparison. Bounds describe
                the full uncertainty set.
              </p>
              {model!.variables.map((v) => {
                const input = analysis?.inputs[v.id] || v,
                  candidates = evaluation!.measurements.filter(
                    (e) => e.data.variable === v.id,
                  ),
                  selected =
                    selections[v.id] ??
                    (candidates.length === 1
                      ? candidates[0].id
                      : candidates.length > 1
                        ? 'conflict'
                        : '');
                return (
                  <div className="model-input" key={v.id}>
                    <div className="model-input-label">
                      <strong>{v.label}</strong>
                      <span>
                        {v.kind === 'fact'
                          ? 'Evidence'
                          : v.kind === 'value'
                            ? 'Value judgement'
                            : 'Assumption'}
                      </span>
                    </div>
                    <div className="model-input-value">
                      <code>{v.id}</code>
                      <Input
                        type="number"
                        step="any"
                        aria-label={v.label + ' reference value'}
                        min={input.low}
                        max={input.high}
                        value={scenario[v.id] ?? input.value}
                        onChange={(e) => {
                          if (
                            e.target.value !== '' &&
                            Number.isFinite(Number(e.target.value))
                          )
                            setScenario((old) => ({
                              ...old,
                              [v.id]: Number(e.target.value),
                            }));
                        }}
                      />
                      <span>{v.unit}</span>
                    </div>
                    <Slider
                      aria-label={v.label + ' reference value'}
                      min={input.low}
                      max={
                        input.high === input.low ? input.low + 1 : input.high
                      }
                      step={(input.high - input.low) / 200 || 1}
                      value={[
                        Math.min(
                          input.high,
                          Math.max(input.low, scenario[v.id] ?? input.value),
                        ),
                      ]}
                      disabled={input.low === input.high}
                      onValueChange={(value) =>
                        setScenario((old) => ({
                          ...old,
                          [v.id]: Array.isArray(value) ? value[0] : value,
                        }))
                      }
                    />
                    <div className="input-bounds">
                      <span>{number(input.low)}</span>
                      <span>{number(input.high)}</span>
                    </div>
                    {v.kind === 'fact' && (
                      <>
                        <Picker
                          label={'Evidence for ' + v.label}
                          value={selected}
                          change={(id) => {
                            setSelections((old) => ({ ...old, [v.id]: id }));
                            setScenario((old) => {
                              const next = { ...old };
                              delete next[v.id];
                              return next;
                            });
                          }}
                          options={[
                            { id: '', label: 'Use declared model bounds' },
                            ...(candidates.length > 1
                              ? [
                                  {
                                    id: 'conflict',
                                    label:
                                      'Choose between conflicting measurements',
                                  },
                                ]
                              : []),
                            ...candidates.map((e) => ({
                              id: e.id,
                              label: String(e.data.title),
                            })),
                          ]}
                        />
                        {selected && selected !== 'conflict' && (
                          <button
                            className="text-button"
                            onClick={() =>
                              onOpen(entries.find((e) => e.id === selected)!)
                            }
                          >
                            Inspect selected evidence ↗
                          </button>
                        )}
                        {canCreate('model_measurement') && (
                          <button
                            className="text-button"
                            onClick={() =>
                              onCreate(
                                'model_measurement',
                                {
                                  modelId: chosen.id,
                                  variable: v.id,
                                  unit: v.unit,
                                  low: input.low,
                                  value: input.value,
                                  high: input.high,
                                  sourceIds: [],
                                },
                                chosen.caseId!,
                              )
                            }
                          >
                            Record measurement +
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              <p className="help">
                Changing a reference value is a what-if scenario. It does not
                change a measurement or narrow its interval. Edit the model to
                change assumptions or declared bounds.
              </p>
            </aside>
            <div className="model-results">
              {evaluation?.error ? (
                <div role="alert" className="message error">
                  {evaluation.error}
                </div>
              ) : (
                analysis && (
                  <>
                    <div className="model-common">
                      <div>
                        <span className="small-label">
                          FEASIBLE FOR EVERY PERSPECTIVE · ALL BOUNDS
                        </span>
                        <strong>{names(analysis.sharedFeasible)}</strong>
                      </div>
                      <div>
                        <span className="small-label">
                          SHARED GUARANTEED PREFERENCE
                        </span>
                        <strong>{names(analysis.sharedPreferred)}</strong>
                      </div>
                    </div>
                    <p className="help">
                      A guarantee applies only within the declared model and
                      simultaneous input bounds. Ties remain ties. “Not
                      established” does not prove that no workable choice
                      exists.
                    </p>
                    <div className="table-scroll model-matrix">
                      <table>
                        <thead>
                          <tr>
                            <th>Option</th>
                            {analysis.perspectives.map((p) => (
                              <th key={p.id}>
                                {p.label}
                                <small>Higher score is preferred</small>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {model!.options.map((o, i) => (
                            <tr key={o.id}>
                              <th>
                                <i style={{ background: colours[i] }} />
                                <button
                                  className="text-button"
                                  onClick={() => {
                                    const e = entries.find(
                                      (e) => e.id === o.id,
                                    );
                                    if (e) onOpen(e);
                                  }}
                                >
                                  {o.label}
                                </button>
                              </th>
                              {analysis.perspectives.map((p) => {
                                const r = p.rules.find(
                                  (r) => r.optionId === o.id,
                                )!;
                                return (
                                  <td
                                    key={p.id}
                                    className={
                                      p.winners.includes(o.id)
                                        ? 'model-preferred'
                                        : ''
                                    }
                                  >
                                    <strong title={r.range.exact.value}>
                                      {number(r.range.value)}
                                    </strong>
                                    <span
                                      className="score-range"
                                      title={
                                        r.range.exact.low +
                                        ' to ' +
                                        r.range.exact.high
                                      }
                                    >
                                      {number(r.range.low)} …{' '}
                                      {number(r.range.high)}
                                    </span>
                                    <small>
                                      {p.guaranteed.includes(o.id)
                                        ? 'Guaranteed preferred'
                                        : p.winners.includes(o.id)
                                          ? 'Preferred at reference values'
                                          : 'Alternative'}
                                    </small>
                                    <span
                                      className={
                                        r.feasible
                                          ? 'model-state'
                                          : 'model-state model-failed'
                                      }
                                    >
                                      {r.robust
                                        ? 'Constraints hold across bounds'
                                        : r.impossible
                                          ? 'A constraint fails across bounds'
                                          : r.feasible
                                            ? 'Constraints hold here; uncertain across bounds'
                                            : 'Constraint violated here'}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="help">
                      Scores are comparable within a perspective. They are never
                      averaged across perspectives.
                    </p>
                    <div className="model-section-label">
                      <h3>Where the choice changes</h3>
                      <Picker
                        label="Input to vary"
                        value={selectedAxis!.id}
                        change={setAxis}
                        options={model!.variables.map((v) => ({
                          id: v.id,
                          label: v.label,
                        }))}
                      />
                    </div>
                    <p className="help">
                      Vary {selectedAxis!.label.toLowerCase()} while holding
                      other inputs at their displayed reference values. Each
                      segment is bounded by calculated score ties or constraint
                      boundaries.
                    </p>
                    {analysis.perspectives.map((p) => {
                      const slice = p.slices.find(
                          (s) => s.variableId === selectedAxis!.id,
                        )!,
                        input = analysis.inputs[selectedAxis!.id],
                        width = input.high - input.low;
                      return (
                        <div className="model-slice" key={p.id}>
                          <strong>{p.label}</strong>
                          <figure
                            className="slice-track"
                            aria-label={
                              p.label +
                              ' preference regions; exact intervals listed below'
                            }
                          >
                            {slice.segments.map((s, i) => (
                              <span
                                key={i}
                                style={{
                                  left: width
                                    ? ((s.low - input.low) / width) * 100 + '%'
                                    : '0%',
                                  width: width
                                    ? ((s.high - s.low) / width) * 100 + '%'
                                    : '100%',
                                  background:
                                    s.winners.length === 1
                                      ? colours[
                                          model!.options.findIndex(
                                            (o) => o.id === s.winners[0],
                                          )
                                        ]
                                      : '#777',
                                }}
                                title={
                                  s.lowExact +
                                  ' < ' +
                                  selectedAxis!.id +
                                  ' < ' +
                                  s.highExact +
                                  ': ' +
                                  names(s.winners)
                                }
                              />
                            ))}
                            <i
                              style={{
                                left: width
                                  ? ((input.value - input.low) / width) * 100 +
                                    '%'
                                  : '0%',
                              }}
                            />
                          </figure>
                          <div className="slice-extents">
                            <span>{number(input.low)}</span>
                            <span>
                              {number(input.high)} {selectedAxis!.unit}
                            </span>
                          </div>
                          <details>
                            <summary>Exact intervals and boundaries</summary>
                            <ul>
                              {slice.segments.map((s, i) => (
                                <li key={i}>
                                  <code>
                                    {s.lowExact} &lt; {selectedAxis!.id} &lt;{' '}
                                    {s.highExact}
                                  </code>{' '}
                                  →{' '}
                                  {s.winners.length
                                    ? names(s.winners)
                                    : 'No feasible option'}
                                </li>
                              ))}
                              {slice.boundaries.map((b, i) => (
                                <li key={'b' + i}>
                                  <code>
                                    {selectedAxis!.id} = {b.exact}
                                  </code>{' '}
                                  →{' '}
                                  {b.winners.length
                                    ? names(b.winners)
                                    : 'No feasible option'}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </div>
                      );
                    })}
                    <div className="model-section-label">
                      <h3>What could a measurement resolve?</h3>
                    </div>
                    <p className="help">
                      These ranges retain all other input uncertainty. They
                      identify exact values that certify a shared weak
                      preference. The test is conservative; uncovered values
                      remain unresolved.
                    </p>
                    {analysis.resolving
                      .filter(
                        (r) =>
                          model!.variables.find((v) => v.id === r.variableId)!
                            .kind === 'fact',
                      )
                      .map((r) => (
                        <div
                          className="measurement-candidate"
                          key={r.variableId}
                        >
                          <strong>
                            {
                              model!.variables.find(
                                (v) => v.id === r.variableId,
                              )!.label
                            }
                          </strong>
                          {r.certificates.length ? (
                            r.certificates.map((c, i) => (
                              <p key={i}>
                                <code>
                                  {exact(c.lowExact)} ≤ {r.variableId} ≤{' '}
                                  {exact(c.highExact)}
                                </code>
                                <span> → {optionName(c.optionId)}</span>
                              </p>
                            ))
                          ) : (
                            <p>
                              No shared preference is established by this
                              one-input test.
                            </p>
                          )}
                        </div>
                      ))}
                    {analysis.measurements.map((m) => (
                      <details className="model-explanation" key={m.variableId}>
                        <summary>
                          Why measure{' '}
                          {model!.variables
                            .find((v) => v.id === m.variableId)!
                            .label.toLowerCase()}
                          ?
                        </summary>
                        {m.comparisons.map((c, i) => (
                          <p key={i}>
                            {
                              analysis.perspectives.find(
                                (p) => p.id === c.perspectiveId,
                              )!.label
                            }
                            : measuring this input exactly removes{' '}
                            {number(c.fractionRemoved * 100)}% of the
                            uncertainty width in {optionName(c.a)} minus{' '}
                            {optionName(c.b)}.
                          </p>
                        ))}
                        {m.constraints.map((c, i) => (
                          <p key={'c' + i}>
                            {
                              analysis.perspectives.find(
                                (p) => p.id === c.perspectiveId,
                              )!.label
                            }
                            : it can settle the constraint “{c.label}” for{' '}
                            {optionName(c.optionId)}.
                          </p>
                        ))}
                        <p>
                          Width reduction is not a probability or an estimate of
                          measurement value. A real measurement with error must
                          be entered as an interval.
                        </p>
                      </details>
                    ))}
                    <details className="model-explanation">
                      <summary>Explain the disagreement</summary>
                      <p>
                        Input categories are declared by the model author. The
                        arithmetic decomposes score differences; it does not
                        infer whether a claim is factual or a value judgement.
                      </p>
                      {analysis.perspectives.map((p) => (
                        <div key={p.id}>
                          <h4>{p.label}</h4>
                          {p.pairs.map((pair) => (
                            <div className="pair-trace" key={pair.a + pair.b}>
                              <strong>
                                {optionName(pair.a)} − {optionName(pair.b)}
                              </strong>
                              <p>
                                Difference at reference values:{' '}
                                <code>{pair.range.exact.value}</code>. Across
                                all bounds:{' '}
                                <code>
                                  [{pair.range.exact.low},{' '}
                                  {pair.range.exact.high}]
                                </code>
                                .
                              </p>
                              <p>
                                Constant contribution:{' '}
                                <code>{pair.constantExact}</code>
                              </p>
                              {pair.contributions
                                .filter((c) => c.coefficientExact !== '0')
                                .map((c) => (
                                  <p key={c.id}>
                                    <span>
                                      {c.kind} · {c.label}
                                    </span>{' '}
                                    <code>
                                      {c.coefficientExact} ×{' '}
                                      {number(analysis.inputs[c.id].value)} ={' '}
                                      {number(c.atValue)}
                                    </code>
                                  </p>
                                ))}
                            </div>
                          ))}
                        </div>
                      ))}
                    </details>
                    <details className="model-explanation">
                      <summary>Equations and hard constraints</summary>
                      {model!.perspectives.map((p) => (
                        <div key={p.id}>
                          <h4>{p.label}</h4>
                          {p.rules.map((r) => (
                            <div className="equation-row" key={r.optionId}>
                              <strong>{optionName(r.optionId)}</strong>
                              <code>score = {r.score}</code>
                              {r.constraints.map((c, i) => {
                                const check = analysis.perspectives
                                  .find((x) => x.id === p.id)!
                                  .rules.find((x) => x.optionId === r.optionId)!
                                  .constraints[i];
                                return (
                                  <p key={i}>
                                    {c.label}:{' '}
                                    <code>
                                      {c.expression} {c.operator} {c.limit}
                                    </code>
                                    <br />
                                    Slack across bounds:{' '}
                                    <code>
                                      [{check.margin.exact.low},{' '}
                                      {check.margin.exact.high}]
                                    </code>
                                    . Negative slack violates the constraint.
                                  </p>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      ))}
                    </details>
                    <div className="model-save">
                      <p>
                        Save the exact model, selected evidence, scenario and
                        computed result in the signed record history.
                      </p>
                      {canCreate('model_run') && (
                        <Button
                          disabled={busy}
                          onClick={() =>
                            perform(async () => {
                              await request('model_run', {
                                space: space.id,
                                head: space.head,
                                modelId: chosen.id,
                                measurementIds: evaluation!.selected.map(
                                  (e) => e.id,
                                ),
                                scenario: JSON.stringify(scenario),
                                title:
                                  String(chosen.data.title) + ' · analysis',
                              });
                              await onRefresh();
                              setNotice(
                                'Analysis saved. It can now be attached to a decision.',
                              );
                            })
                          }
                        >
                          <Save size={16} /> Save analysis
                        </Button>
                      )}
                    </div>
                  </>
                )
              )}
            </div>
          </div>
          <section className="saved-analyses">
            <h3>Saved analyses and affected decisions</h3>
            {runs.length ? (
              runs.map((run) => {
                const status = runStatus(run, entries),
                  decisions = current.filter(
                    (e) =>
                      e.kind === 'decision' && e.data.modelRunId === run.id,
                  );
                return (
                  <div className="saved-analysis" key={run.id}>
                    <button className="text-button" onClick={() => onOpen(run)}>
                      {String(run.data.title)} ↗
                    </button>
                    <span>{date(run.createdAt)}</span>
                    <strong
                      className={status.state === 'current' ? '' : 'attention'}
                    >
                      {status.detail}
                    </strong>
                    {status.live && (
                      <p>
                        Saved shared preference:{' '}
                        {names(runAnalysis(run, entries).sharedPreferred)}.
                        Current: {names(status.live.sharedPreferred)}.
                      </p>
                    )}
                    {decisions.map((d) => (
                      <button
                        className="reference"
                        key={d.id}
                        onClick={() => onOpen(d)}
                      >
                        Decision: {String(d.data.title)} ↗
                      </button>
                    ))}
                  </div>
                );
              })
            ) : (
              <p>
                No saved analyses yet. Live exploration does not write to the
                history.
              </p>
            )}
          </section>
          <p className="model-method">
            Kernel: {model!.version}. Affine expressions, exact rational
            comparisons and a box of simultaneous input bounds as an uncertainty
            set. Decimal displays are rounded. Scores encode declared
            preferences; they do not establish causality, authority or truth.
          </p>
        </>
      )}
      {editor && (
        <ModelEditor
          snapshot={snapshot}
          caseId={modelCase}
          entry={editor.entry}
          close={() => setEditor(null)}
          saved={async (id) => {
            setModelId(id);
            setEditor(null);
            setScenario({});
            setSelections({});
            await onRefresh();
          }}
          onNavigate={onNavigate}
        />
      )}
    </section>
  );
}

function ModelEditor({
  snapshot,
  caseId,
  entry,
  close,
  saved,
  onNavigate,
}: {
  snapshot: Snapshot;
  caseId: string;
  entry?: Entry;
  close: () => void;
  saved: (id: string) => Promise<void>;
  onNavigate: (layer: string) => void;
}) {
  const formId = useId();
  const current = active(snapshot.entries),
    availableOptions = current.filter(
      (e) => e.kind === 'option' && e.caseId === caseId,
    ),
    availableFrames = current.filter(
      (e) => e.kind === 'frame' && e.caseId === caseId,
    );
  const [model, setModel] = useState<Model>(() =>
    entry
      ? readModel(entry)
      : draftModel(availableOptions.slice(0, 6), availableFrames.slice(0, 4)),
  );
  const [title, setTitle] = useState(
      entry ? String(entry.data.title) : 'New model',
    ),
    [limitations, setLimitations] = useState(
      entry ? String(entry.data.limitations) : '',
    ),
    [sources, setSources] = useState<string[]>(
      entry ? (entry.data.sourceIds as string[]) || [] : [],
    ),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const change = (fn: (m: Model) => void) =>
    setModel((old) => {
      const next = structuredClone(old);
      fn(next);
      return next;
    });
  const numeric = (raw: string) => Number(raw);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent className="model-editor wide-dialog">
        <DialogHeader>
          <DialogTitle>{entry ? 'Revise model' : 'Build a model'}</DialogTitle>
          <DialogDescription>
            Each perspective defines its own score scale and hard constraints.
            Higher scores are preferred. Expressions support +, −,
            multiplication by constants and division by nonzero constants.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            void (async () => {
              try {
                parseModel(JSON.stringify(model));
                const response = await request('append', {
                  space: snapshot.space.id,
                  head: snapshot.space.head,
                  proposal: {
                    kind: 'model',
                    caseId,
                    supersedes: entry?.id || null,
                    data: {
                      title,
                      definition: JSON.stringify(model),
                      optionIds: model.options.map((o) => o.id),
                      frameIds: model.perspectives.map((p) => p.id),
                      sourceIds: sources,
                      limitations,
                    },
                  },
                });
                await saved(response.added[0].id);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : 'Could not save model.',
                );
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          {error && (
            <p role="alert" className="message error">
              {error}
            </p>
          )}
          <label htmlFor={formId + '-name'}>
            Model name
            <Input
              id={formId + '-name'}
              value={title}
              required
              maxLength={150}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label htmlFor={formId + '-scope'}>
            Scope, assumptions and limitations
            <Textarea
              id={formId + '-scope'}
              value={limitations}
              required
              maxLength={8000}
              onChange={(e) => setLimitations(e.target.value)}
            />
          </label>
          {!caseId && (
            <p className="message error">Choose or create a case first.</p>
          )}
          <h3>Inputs</h3>
          <p className="help">
            Use a short input name in equations, such as price. Units are
            declarations; encode any conversion factors explicitly. Nonlinear
            products and variable denominators are rejected.
          </p>
          {model.variables.map((v, i) => (
            <fieldset className="variable-editor" key={i}>
              <legend>Input {i + 1}</legend>
              <div className="model-editor-grid">
                <label htmlFor={`${formId}-${i}-id`}>
                  Name in equations
                  <Input
                    id={`${formId}-${i}-id`}
                    required
                    value={v.id}
                    maxLength={24}
                    onChange={(e) =>
                      change((m) => {
                        m.variables[i].id = e.target.value;
                      })
                    }
                  />
                </label>
                <label htmlFor={`${formId}-${i}-label`}>
                  Display label
                  <Input
                    id={`${formId}-${i}-label`}
                    required
                    value={v.label}
                    maxLength={150}
                    onChange={(e) =>
                      change((m) => {
                        m.variables[i].label = e.target.value;
                      })
                    }
                  />
                </label>
                <label htmlFor={`${formId}-${i}-unit`}>
                  Unit
                  <Input
                    id={`${formId}-${i}-unit`}
                    required
                    value={v.unit}
                    maxLength={150}
                    onChange={(e) =>
                      change((m) => {
                        m.variables[i].unit = e.target.value;
                      })
                    }
                  />
                </label>
                <div className="model-category-field">
                  <span className="small-label">Category</span>
                  <Picker
                    label="Input category"
                    value={v.kind}
                    change={(value) =>
                      change((m) => {
                        m.variables[i].kind = value as typeof v.kind;
                      })
                    }
                    options={[
                      { id: 'fact', label: 'Evidence / measurement' },
                      {
                        id: 'assumption',
                        label: 'Assumption / interpretation',
                      },
                      { id: 'value', label: 'Value judgement' },
                    ]}
                  />
                </div>
                {(['low', 'value', 'high'] as const).map((key) => (
                  <label key={key}>
                    {key === 'value'
                      ? 'Reference value'
                      : key === 'low'
                        ? 'Lower bound'
                        : 'Upper bound'}
                    <Input
                      type="number"
                      step="any"
                      required
                      value={v[key]}
                      onChange={(e) =>
                        change((m) => {
                          m.variables[i][key] = numeric(e.target.value);
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={model.variables.length <= 1}
                onClick={() =>
                  change((m) => {
                    m.variables.splice(i, 1);
                  })
                }
              >
                Remove input
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={model.variables.length >= 8}
            onClick={() =>
              change((m) => {
                let i = m.variables.length + 1;
                while (m.variables.some((v) => v.id === 'input' + i)) i++;
                m.variables.push({
                  id: 'input' + i,
                  label: 'New input',
                  unit: 'units',
                  kind: 'assumption',
                  low: 0,
                  value: 0,
                  high: 1,
                });
              })
            }
          >
            Add input
          </Button>
          <h3>Options</h3>
          <p className="help">Choose 2–6 registered options from this case.</p>
          <div className="model-option-list">
            {model.options.map((o) => (
              <span key={o.id}>
                {o.label}
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={'Remove ' + o.label}
                  onClick={() =>
                    change((m) => {
                      m.options = m.options.filter((x) => x.id !== o.id);
                      for (const p of m.perspectives)
                        p.rules = p.rules.filter((r) => r.optionId !== o.id);
                    })
                  }
                >
                  ×
                </Button>
              </span>
            ))}
          </div>
          {availableOptions.some(
            (o) => !model.options.some((x) => x.id === o.id),
          ) &&
            model.options.length < 6 && (
              <Picker
                label="Add option"
                value=""
                options={[
                  { id: '', label: 'Add a registered option…' },
                  ...availableOptions
                    .filter((o) => !model.options.some((x) => x.id === o.id))
                    .map((o) => ({ id: o.id, label: String(o.data.title) })),
                ]}
                change={(id) => {
                  const o = availableOptions.find((e) => e.id === id);
                  if (o)
                    change((m) => {
                      m.options.push({ id, label: String(o.data.title) });
                      for (const p of m.perspectives)
                        p.rules.push({
                          optionId: id,
                          score: '0',
                          constraints: [],
                        });
                    });
                }}
              />
            )}
          {availableOptions.length < 2 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                close();
                onNavigate('decide');
              }}
            >
              Register options first ↗
            </Button>
          )}
          <h3>Perspectives and rules</h3>
          {model.perspectives.map((p, pi) => (
            <fieldset className="perspective-editor" key={p.id}>
              <legend>{p.label}</legend>
              {p.rules.map((r, ri) => (
                <div className="rule-editor" key={r.optionId}>
                  <strong>
                    {model.options.find((o) => o.id === r.optionId)?.label}
                  </strong>
                  <label htmlFor={`${formId}-${pi}-${ri}-score`}>
                    Score expression
                    <Input
                      id={`${formId}-${pi}-${ri}-score`}
                      required
                      value={r.score}
                      maxLength={300}
                      onChange={(e) =>
                        change((m) => {
                          m.perspectives[pi].rules[ri].score = e.target.value;
                        })
                      }
                    />
                  </label>
                  {r.constraints.map((c, ci) => (
                    <div className="constraint-editor" key={ci}>
                      <label htmlFor={`${formId}-${pi}-${ri}-${ci}-label`}>
                        Constraint label
                        <Input
                          id={`${formId}-${pi}-${ri}-${ci}-label`}
                          required
                          value={c.label}
                          maxLength={150}
                          onChange={(e) =>
                            change((m) => {
                              m.perspectives[pi].rules[ri].constraints[
                                ci
                              ].label = e.target.value;
                            })
                          }
                        />
                      </label>
                      <label htmlFor={`${formId}-${pi}-${ri}-${ci}-expr`}>
                        Expression
                        <Input
                          id={`${formId}-${pi}-${ri}-${ci}-expr`}
                          required
                          value={c.expression}
                          maxLength={300}
                          onChange={(e) =>
                            change((m) => {
                              m.perspectives[pi].rules[ri].constraints[
                                ci
                              ].expression = e.target.value;
                            })
                          }
                        />
                      </label>
                      <Picker
                        label="Constraint comparison"
                        value={c.operator}
                        options={[
                          { id: '<=', label: '≤' },
                          { id: '>=', label: '≥' },
                        ]}
                        change={(value) =>
                          change((m) => {
                            m.perspectives[pi].rules[ri].constraints[
                              ci
                            ].operator = value as '<=' | '>=';
                          })
                        }
                      />
                      <label htmlFor={`${formId}-${pi}-${ri}-${ci}-limit`}>
                        Limit
                        <Input
                          id={`${formId}-${pi}-${ri}-${ci}-limit`}
                          required
                          type="number"
                          step="any"
                          value={c.limit}
                          onChange={(e) =>
                            change((m) => {
                              m.perspectives[pi].rules[ri].constraints[
                                ci
                              ].limit = numeric(e.target.value);
                            })
                          }
                        />
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label="Remove constraint"
                        onClick={() =>
                          change((m) => {
                            m.perspectives[pi].rules[ri].constraints.splice(
                              ci,
                              1,
                            );
                          })
                        }
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={r.constraints.length >= 4}
                    onClick={() =>
                      change((m) => {
                        m.perspectives[pi].rules[ri].constraints.push({
                          label: 'Hard constraint',
                          expression: model.variables[0]?.id || '0',
                          operator: '<=',
                          limit: 1,
                        });
                      })
                    }
                  >
                    Add hard constraint
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  change((m) => {
                    m.perspectives.splice(pi, 1);
                  })
                }
              >
                Remove perspective
              </Button>
            </fieldset>
          ))}
          {availableFrames.some(
            (f) => !model.perspectives.some((p) => p.id === f.id),
          ) &&
            model.perspectives.length < 4 && (
              <Picker
                label="Add perspective"
                value=""
                options={[
                  { id: '', label: 'Add a registered perspective…' },
                  ...availableFrames
                    .filter(
                      (f) => !model.perspectives.some((p) => p.id === f.id),
                    )
                    .map((f) => ({ id: f.id, label: String(f.data.title) })),
                ]}
                change={(id) => {
                  const f = availableFrames.find((e) => e.id === id);
                  if (f)
                    change((m) => {
                      m.perspectives.push({
                        id,
                        label: String(f.data.title),
                        rules: m.options.map((o) => ({
                          optionId: o.id,
                          score: '0',
                          constraints: [],
                        })),
                      });
                    });
                }}
              />
            )}
          {!availableFrames.length && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                close();
                onNavigate('frames');
              }}
            >
              Register a perspective first ↗
            </Button>
          )}
          <h3>Supporting sources</h3>
          {snapshot.entries
            .filter(
              (e) =>
                e.kind === 'source' &&
                e.caseId === caseId &&
                (sources.includes(e.id) ||
                  current.some((record) => record.id === e.id)),
            )
            .map((s) => (
              <label className="check-label" key={s.id}>
                <Checkbox
                  checked={sources.includes(s.id)}
                  onCheckedChange={(yes) =>
                    setSources((old) =>
                      yes ? [...old, s.id] : old.filter((id) => id !== s.id),
                    )
                  }
                />
                {String(s.data.title)}
                {!current.some((record) => record.id === s.id) &&
                  ' · Superseded version'}
              </label>
            ))}
          <details className="model-explanation">
            <summary>Inspect the executable definition</summary>
            <pre>{JSON.stringify(model, null, 2)}</pre>
          </details>
          <div className="form-footer">
            <p>
              {entry
                ? 'A new version preserves this model and all previous analyses.'
                : 'Models are saved in the case history.'}
            </p>
            <Button
              disabled={
                busy ||
                !caseId ||
                model.options.length < 2 ||
                !model.perspectives.length
              }
            >
              {busy ? 'Saving…' : 'Save model'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
