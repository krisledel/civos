import { KERNEL_VERSION, type Model } from './kernel';
export function energyModel(
  optionIds = ['flex', 'balanced', 'reserve'],
  frameIds = ['cost', 'continuity'],
): Model {
  return {
    version: KERNEL_VERSION,
    variables: [
      {
        id: 'price',
        label: 'Price index',
        unit: 'synthetic index',
        kind: 'fact',
        low: 2,
        value: 3,
        high: 5,
      },
      {
        id: 'stress',
        label: 'Operating stress',
        unit: 'synthetic index',
        kind: 'assumption',
        low: 0,
        value: 1,
        high: 2,
      },
    ],
    options: optionIds.map((id, i) => ({
      id,
      label: ['Flexible package', 'Balanced package', 'Reserve package'][i],
    })),
    perspectives: [
      {
        id: frameIds[0],
        label: 'Cost perspective',
        rules: optionIds.map((optionId, i) => ({
          optionId,
          score: ['80 - 8 * price', '45', '20 + 7 * price'][i],
          constraints:
            i === 2
              ? [
                  {
                    label: 'Reserve operating limit',
                    expression: 'stress',
                    operator: '<=',
                    limit: 2.5,
                  },
                ]
              : [],
        })),
      },
      {
        id: frameIds[1],
        label: 'Continuity perspective',
        rules: optionIds.map((optionId, i) => ({
          optionId,
          score: ['45 - 2 * stress', '60 - 2 * stress', '80 - 4 * stress'][i],
          constraints:
            i === 2
              ? [
                  {
                    label: 'Reserve operating limit',
                    expression: 'stress',
                    operator: '<=',
                    limit: 2.5,
                  },
                ]
              : [],
        })),
      },
    ],
  };
}
