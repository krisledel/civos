import assert from 'node:assert/strict';
import {
  canonical,
  digest,
  makeEntry,
  validate,
  verifyEntries,
  type Data,
  type Entry,
  type Proposal,
} from '../lib/model';
import { KERNEL_VERSION, type Model } from '../lib/kernel';
import { runAnalysis, runProposal, runStatus } from '../lib/kernel-records';

// Intended location: tests/record-regressions.ts.
// Call await runRecordRegressions() from tests/kernel.ts.
// Fixtures use the real schema, hashes and replay verifier; no database is needed.
async function fixture(configure: (model: Model) => void = () => {}) {
  const entries: Entry[] = [];
  const person = { id: 'kernel-regression-author', name: 'Regression author' };
  const appendProposal = async (proposal: Proposal) => {
    const entry = await makeEntry(proposal, entries, person, 'owner');
    entries.push(entry);
    return entry;
  };
  const append = (
    kind: string,
    data: Data,
    caseId: string | null = null,
    supersedes: string | null = null,
  ) => appendProposal({ kind, data, caseId, supersedes });
  const caseEntry = await append('case', {
    title: 'Kernel record regression',
    question: 'Do exact references and historical decisions remain valid?',
    domain: 'Synthetic test',
    place: 'Test fixture',
    groups: ['Test group'],
    timeframe: 'One deterministic exercise',
  });
  const source = await append(
    'source',
    {
      title: 'Declared model evidence',
      uri: 'urn:civos:tests:model-evidence',
      method: 'Constructed regression data.',
      capturedAt: '2026-09-08T00:00:00.000Z',
      originGroup: 'record-regression-fixture',
      limitations: 'Invented values; no real-world claim.',
    },
    caseEntry.id,
  );
  const observation = await append(
    'observation',
    {
      title: 'Declared interval',
      statement: 'The synthetic input lies between zero and ten.',
      category: 'observation',
      sourceIds: [source.id],
      observedAt: '2026-09-08T00:00:00.000Z',
      place: 'Test fixture',
      uncertainty: 'Declared bounds only.',
    },
    caseEntry.id,
  );
  const actor = await append('actor', {
    title: 'Test participant',
    role: 'Synthetic reviewer and decision owner',
    groups: ['Test group'],
    domains: ['Synthetic test'],
    interests: 'No real-world interests represented.',
  });
  const policy = await append('policy', {
    title: 'Test working rule',
    rule: 'Review the evidence and preserve exact model versions.',
    minReviews: 1,
    requiredGroups: [],
    reviewDays: 30,
  });
  await append(
    'assessment',
    {
      title: 'Fixture evidence review',
      targetId: observation.id,
      actorId: actor.id,
      verdict: 'stödjer',
      rationale: 'Valid as synthetic test evidence only.',
      method: 'Fixture inspection',
      independence: 'inte fastställt',
      interests: 'Same test author.',
      evidenceIds: [source.id],
    },
    caseEntry.id,
  );
  const frames: Entry[] = [];
  for (const title of ['First perspective', 'Second perspective']) {
    frames.push(
      await append(
        'frame',
        {
          title,
          description: 'One declared preference scale.',
          method: 'Affine comparison',
          assumptions: ['The synthetic equations apply.'],
          scope: 'Regression fixture',
          limitations: 'No external validity.',
          groups: ['Test group'],
        },
        caseEntry.id,
      ),
    );
  }
  const options: Entry[] = [];
  for (const title of ['Option A', 'Option B']) {
    options.push(
      await append(
        'option',
        {
          title,
          action: 'A synthetic alternative.',
          basisIds: [observation.id],
          benefits: 'Declared by the model.',
          costs: 'Declared by the model.',
          reversibility: 'No physical action is performed.',
        },
        caseEntry.id,
      ),
    );
  }
  const definition: Model = {
    version: KERNEL_VERSION,
    variables: [
      {
        id: 'x',
        label: 'Measured input',
        unit: 'units',
        kind: 'fact',
        low: 0,
        value: 3,
        high: 10,
      },
    ],
    options: options.map((entry) => ({
      id: entry.id,
      label: String(entry.data.title),
    })),
    perspectives: frames.map((entry) => ({
      id: entry.id,
      label: String(entry.data.title),
      rules: options.map((option, index) => ({
        optionId: option.id,
        score: index === 0 ? '2' : '1',
        constraints: [],
      })),
    })),
  };
  configure(definition);
  const model = await append(
    'model',
    {
      title: 'Regression model',
      definition: JSON.stringify(definition),
      optionIds: options.map((entry) => entry.id),
      frameIds: frames.map((entry) => entry.id),
      sourceIds: [source.id],
      limitations: 'Synthetic affine fixture.',
    },
    caseEntry.id,
  );
  const saveRun = (measurementIds: string[] = []) =>
    appendProposal(
      runProposal(
        entries,
        model.id,
        measurementIds,
        '{}',
        'Saved regression analysis',
      ),
    );
  const decision = (run: Entry, option: Entry): Proposal => ({
    kind: 'decision',
    caseId: caseEntry.id,
    data: {
      title: 'Decision linked to an exact analysis',
      optionId: option.id,
      ownerId: actor.id,
      authority: 'Synthetic test authority only.',
      rationale: 'Exercise the modeled constraint gate.',
      dissent: 'No real participants.',
      reviewAt: new Date(Date.now() + 86_400_000).toISOString(),
      metric: 'Synthetic result',
      operator: 'minst',
      target: 1,
      unit: 'units',
      stopCondition: 'Stop if the modeled constraint is violated.',
      policyId: policy.id,
      modelRunId: run.id,
    },
  });
  return {
    entries,
    person,
    append,
    appendProposal,
    caseEntry,
    source,
    model,
    options,
    saveRun,
    decision,
  };
}

export async function runRecordRegressions() {
  let checks = 0;
  const equal = (actual: unknown, expected: unknown, message: string) => {
    assert.deepEqual(actual, expected, message);
    checks++;
  };

  // The incoming measurement did not belong to the saved run. Its own source
  // still must be checked before publishing an automatically updated result.
  {
    const f = await fixture();
    const run = await f.saveRun();
    const incomingSource = await f.append(
      'source',
      {
        ...f.source.data,
        title: 'New measurement source',
        uri: 'urn:civos:tests:incoming-measurement',
      },
      f.caseEntry.id,
    );
    await f.append(
      'model_measurement',
      {
        title: 'Incoming measurement',
        modelId: f.model.id,
        variable: 'x',
        unit: 'units',
        low: 2,
        value: 3,
        high: 4,
        sourceIds: [incomingSource.id],
        method: 'Synthetic interval measurement.',
      },
      f.caseEntry.id,
    );
    const beforeRevision = runStatus(run, f.entries);
    equal(
      beforeRevision.state,
      'changed',
      'New valid evidence should be detected.',
    );
    equal(
      beforeRevision.live?.inputs.x,
      { low: 2, value: 3, high: 4 },
      'Valid incoming evidence should be recalculated.',
    );

    await f.append(
      'source',
      {
        ...incomingSource.data,
        title: 'Corrected measurement source',
      },
      f.caseEntry.id,
      incomingSource.id,
    );
    const afterRevision = runStatus(run, f.entries);
    equal(
      afterRevision.state,
      'blocked',
      'A revised incoming source must block automatic reuse of its measurement.',
    );
    equal(
      afterRevision.live,
      undefined,
      'Do not publish a current result from a measurement whose source was revised.',
    );
    await verifyEntries(f.entries, f.entries.at(-1)!.hash);
    checks++; // Historical run replay must still use its original prefix.
  }

  // Restoring a decision bypasses present-day freshness/locality requirements,
  // but must not bypass a hard constraint in its immutable saved calculation.
  {
    const f = await fixture((model) => {
      model.perspectives[0].rules[1].constraints = [
        {
          label: 'Impossible at saved input',
          expression: 'x',
          operator: '<=',
          limit: 2,
        },
      ];
    });
    const run = await f.saveRun();
    const bad = f.decision(run, f.options[1]);
    assert.throws(
      () => validate(bad, f.entries, 'owner', true),
      /modeled hard constraint/i,
      'Restore must reject the infeasible option using its saved run.',
    );
    checks++;

    // A correctly hashed but invalid imported decision must fail replay too.
    const body = {
      id: crypto.randomUUID(),
      kind: bad.kind,
      caseId: bad.caseId || null,
      actor: f.person.id,
      actorName: f.person.name,
      createdAt: new Date().toISOString(),
      supersedes: null,
      data: bad.data,
      seq: f.entries.length + 1,
      prevHash: f.entries.at(-1)!.hash,
    };
    const forged: Entry = { ...body, hash: await digest(canonical(body)) };
    await assert.rejects(
      () => verifyEntries([...f.entries, forged], forged.hash),
      /modeled hard constraint/i,
      'A valid record hash must not conceal an impossible modeled decision.',
    );
    checks++;

    const good = f.decision(run, f.options[0]);
    const accepted = await makeEntry(
      good,
      f.entries,
      f.person,
      'owner',
      true,
      f.entries.length + 100,
    );
    await verifyEntries([...f.entries, accepted], accepted.hash);
    checks++; // Valid historical decisions do not inherit a new branch's local_start.
  }

  // Only one perspective's nonwinning option becomes robust. Winners,
  // reference feasibility and shared feasibility all remain identical, so
  // comparing only those fields misses a material constraint-status change.
  {
    const f = await fixture((model) => {
      model.perspectives[0].rules[1].constraints = [
        {
          label: 'Upper bound',
          expression: 'x',
          operator: '<=',
          limit: 5,
        },
      ];
      model.perspectives[1].rules[1].constraints = [
        {
          label: 'Lower bound',
          expression: 'x',
          operator: '>=',
          limit: 2,
        },
      ];
    });
    const run = await f.saveRun();
    const original = runAnalysis(run, f.entries);
    await f.append(
      'model_measurement',
      {
        title: 'Narrowed upper interval',
        modelId: f.model.id,
        variable: 'x',
        unit: 'units',
        low: 0,
        value: 3,
        high: 4,
        sourceIds: [f.source.id],
        method: 'Synthetic interval measurement.',
      },
      f.caseEntry.id,
    );
    const status = runStatus(run, f.entries);
    equal(
      status.state,
      'changed',
      'Narrowed evidence should change the saved run status.',
    );
    assert.ok(
      status.live,
      'Valid new evidence should produce a live calculation.',
    );
    checks++;
    equal(
      original.perspectives[0].rules[1].robust,
      false,
      'The original constraint was not robust.',
    );
    equal(
      status.live.perspectives[0].rules[1].robust,
      true,
      'The updated constraint is robust.',
    );
    equal(
      status.live.perspectives.map((p) => p.winners),
      original.perspectives.map((p) => p.winners),
      'Winners intentionally remain unchanged.',
    );
    equal(
      status.live.perspectives.map((p) => p.rules.map((r) => r.feasible)),
      original.perspectives.map((p) => p.rules.map((r) => r.feasible)),
      'Reference feasibility intentionally remains unchanged.',
    );
    equal(
      status.live.sharedFeasible,
      original.sharedFeasible,
      'Shared robust feasibility intentionally remains unchanged.',
    );
    equal(
      status.live.sharedPreferred,
      original.sharedPreferred,
      'Shared preference intentionally remains unchanged.',
    );
    assert.doesNotMatch(
      status.detail,
      /feasibility (?:are |is )?unchanged/i,
      'A changed per-perspective robust flag must not be reported as unchanged feasibility.',
    );
    checks++;
    await verifyEntries(f.entries, f.entries.at(-1)!.hash);
    checks++;
  }

  return { recordRegressionChecks: checks };
}
