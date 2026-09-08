import { createSpace, getSpace, append } from './store';
import type { Person, Data } from './model';
import { energyModel } from './kernel-example-data';
export async function createKernelExample(person: Person) {
  const id = await createSpace(
    'Energy models · synthetic example',
    'A constructed comparison of two perspectives. All scores, intervals and constraints are invented for testing; they are not engineering estimates.',
    person,
  );
  const add = async (
    kind: string,
    data: Data,
    caseId: string | null = null,
  ) => {
    const space = await getSpace(id, person);
    return (await append(space, { kind, data, caseId }, space.head, person))[0];
  };
  const c = await add('case', {
    title: 'Which energy package survives both perspectives?',
    question:
      'Compare preferences, identify the price threshold and test what a new measurement would resolve.',
    domain: 'Synthetic model experiment',
    place: 'Fictional workshop',
    groups: ['Cost group', 'Continuity group'],
    timeframe: 'One bounded exercise',
  });
  const source = await add(
    'source',
    {
      title: 'Constructed example inputs',
      uri: 'urn:civos:synthetic:affine-energy-v1',
      method:
        'Invented numbers for a reproducible calculation. No empirical data.',
      capturedAt: new Date().toISOString(),
      originGroup: 'synthetic-example-v1',
      limitations:
        'No physical, financial or operational conclusions about real energy systems.',
    },
    c.id,
  );
  const observation = await add(
    'observation',
    {
      title: 'Uncertain example price and operating stress',
      statement:
        'Price index is declared between 2 and 5. Stress is assumed between 0 and 2.',
      category: 'prognos',
      sourceIds: [source.id],
      observedAt: new Date().toISOString(),
      place: 'Synthetic parameter space',
      uncertainty:
        'Declared box bounds. No probability distribution or independence assumption.',
      contradicts: [],
    },
    c.id,
  );
  const frameIds: string[] = [];
  for (const title of ['Cost perspective', 'Continuity perspective']) {
    const f = await add(
      'frame',
      {
        title,
        description:
          'Explicit synthetic preference model. Higher scores are preferred within this perspective.',
        method: 'Affine equations and hard constraints',
        assumptions: ['The declared equations and input bounds apply'],
        scope: 'This constructed comparison only',
        limitations: 'Scores cannot be compared across perspectives.',
        groups: [
          title === 'Cost perspective' ? 'Cost group' : 'Continuity group',
        ],
      },
      c.id,
    );
    frameIds.push(f.id);
  }
  const optionIds: string[] = [];
  for (const title of [
    'Flexible package',
    'Balanced package',
    'Reserve package',
  ]) {
    const o = await add(
      'option',
      {
        title,
        action: 'Synthetic alternative for model comparison.',
        basisIds: [observation.id],
        benefits: 'Specified by each perspective’s score expression.',
        costs: 'Specified by the synthetic model only.',
        reversibility: 'This is a calculation; no physical action is executed.',
      },
      c.id,
    );
    optionIds.push(o.id);
  }
  const model = await add(
    'model',
    {
      title: 'Energy package comparison',
      definition: JSON.stringify(energyModel(optionIds, frameIds)),
      optionIds,
      frameIds,
      sourceIds: [source.id],
      limitations:
        'Synthetic affine model. Box uncertainty, no probabilities. Higher scores are better within each perspective. Incomparable scales remain separate.',
    },
    c.id,
  );
  return { id, caseId: c.id, modelId: model.id };
}
