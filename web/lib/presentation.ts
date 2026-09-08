import { kinds, type Entry, type Field } from './model';

// These are display labels. Protocol values stay unchanged in records and signatures.
const optionLabels: Record<string, string> = {
  observation: 'Observation',
  tolkning: 'Interpretation',
  prognos: 'Forecast',
  värdering: 'Value judgement',
  överlappande: 'Overlapping',
  snävare: 'Narrower',
  bredare: 'Broader',
  oförenliga: 'Incompatible',
  'likvärdiga inom angivet område': 'Equivalent within the stated scope',
  stödjer: 'Supports',
  invänder: 'Objects',
  osäkert: 'Uncertain',
  'inte fastställt': 'Not established',
  'gemensamt ursprung': 'Shared origin',
  'självständigt granskat': 'Independently reviewed',
  för: 'For',
  emot: 'Against',
  villkor: 'Condition',
  minst: 'At least',
  högst: 'At most',
  exakt: 'Exactly',
  planerad: 'Planned',
  pågår: 'In progress',
  klar: 'Completed',
  avbruten: 'Cancelled',
  antas: 'Adopted',
  avslås: 'Rejected',
};

export function optionLabel(field: Field, value: string): string {
  return field.type === 'select' && field.options?.includes(value)
    ? optionLabels[value] || value
    : value;
}

export function fieldDisplay(
  kind: string,
  key: string,
  value: unknown,
): string {
  const field = kinds[kind]?.fields.find((candidate) => candidate.key === key);
  return field ? optionLabel(field, String(value)) : String(value);
}

export function recordStatus(entry: Entry): string {
  const key = ['verdict', 'position', 'status'].find((key) => entry.data[key]);
  return key
    ? fieldDisplay(entry.kind, key, entry.data[key])
    : kinds[entry.kind].label;
}

export function recordSearch(entry: Entry): string {
  return [
    JSON.stringify(entry.data),
    kinds[entry.kind].label,
    kinds[entry.kind].plural,
    ...kinds[entry.kind].fields
      .filter(
        (field) =>
          field.type === 'select' && entry.data[field.key] !== undefined,
      )
      .map((field) => optionLabel(field, String(entry.data[field.key]))),
  ]
    .join(' ')
    .toLocaleLowerCase('en');
}
