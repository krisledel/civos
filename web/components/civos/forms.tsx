'use client';
import { useState, useId, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  kinds,
  active,
  type Entry,
  type Data,
  type Field,
  type Finding,
} from '@/lib/model';
import type { Space } from '@/lib/store';
import { optionLabel } from '@/lib/presentation';
export type Snapshot = {
  space: Space;
  entries: Entry[];
  findings: Finding[];
  statistics: {
    observations: number;
    reviewed: number;
    due: number;
    followed: number;
    sources: number;
    originGroups: number;
    unknownOrigins: number;
  };
  members: { principal: string; name: string; role: string }[];
  trust: {
    fingerprint: string;
    label: string;
    domain: string;
    status: string;
    reason: string;
  }[];
  attachments: { id: string; name: string; digest: string; size: number }[];
  imports: { fingerprint: string; received_at: string }[];
};
export const date = (x: string) =>
  new Date(x).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
export async function request(
  action: string,
  data: Record<string, unknown> = {},
) {
  const res = await fetch('/api/civos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
  });
  const b = (await res.json()) as {
    error: string;
    id: string;
    token: string;
    added: Entry[];
  };
  if (!res.ok) throw Error(b.error || 'The action failed.');
  return b;
}
export function Picker({
  value,
  change,
  options,
  label,
}: {
  value: string;
  change: (x: string) => void;
  options: { id: string; label: string }[];
  label: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => change(v || '')}
      items={options.map((o) => ({ value: o.id, label: o.label }))}
    >
      <SelectTrigger aria-label={label} className="picker">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem value={o.id} key={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function dependencyHint(kind: string) {
  const hints: Record<string, string> = {
    source: 'Enter the source URL, collection method, date and limitations.',
    observation:
      'Register a source first. The observation must refer to its evidence.',
    concept: 'First add the perspective in which the concept has its meaning.',
    mapping: 'Add two concepts and describe what is lost in translation.',
    assessment:
      'Add a participant and an observation or another record to review.',
    option:
      'Add observations as the evidence base. Describe benefits, costs and how to stop or reverse the action.',
    argument: 'Choose an option and the participant making the argument.',
    decision:
      'Review the observations behind the option as required by the working rule. Specify authority, responsibility, targets and follow-up.',
    task: 'Register a decision and assign responsibility for carrying it out.',
    outcome:
      'Register a decision and a source for the outcome. Use the same unit as the decision target.',
    rule_change:
      'Link the proposal to the current working rule and the records that demonstrate the problem.',
    rule_resolution:
      'Choose a rule proposal. Adopting it automatically creates the next working rule.',
  };
  return (
    hints[kind] || 'Add a record to make it available throughout the workspace.'
  );
}
export function EntryDialog({
  editor,
  snap,
  caseId,
  close,
  saved,
}: {
  editor: { kind: string; entry?: Entry; initial?: Data };
  snap: Snapshot;
  caseId: string;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const schema = kinds[editor.kind];
  const [data, setData] = useState<Data>(() =>
    editor.entry
      ? { ...editor.entry.data }
      : {
          ...Object.fromEntries(
            schema.fields
              .filter(
                (f) =>
                  f.type === 'date' ||
                  f.type === 'refs' ||
                  f.type === 'list' ||
                  f.key === 'policyId',
              )
              .map((f) => [
                f.key,
                f.type === 'date'
                  ? new Date(
                      Date.now() +
                        (f.key === 'reviewAt' || f.key === 'dueAt'
                          ? 86400000
                          : 0),
                    ).toISOString()
                  : f.key === 'policyId'
                    ? active(snap.entries)
                        .filter((e) => e.kind === 'policy')
                        .at(-1)?.id || ''
                    : [],
              ]),
          ),
          ...editor.initial,
        },
  );
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const change = (key: string, value: Data[string]) =>
    setData((d) => ({ ...d, [key]: value }));
  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const clean: Data = {};
      for (const f of schema.fields) {
        const v = data[f.key];
        if (
          v !== undefined &&
          v !== '' &&
          (!Array.isArray(v) || v.length || f.required)
        )
          clean[f.key] = v;
      }
      await request('append', {
        space: snap.space.id,
        head: snap.space.head,
        proposal: {
          kind: editor.kind,
          caseId: schema.global ? null : editor.entry?.caseId || caseId,
          supersedes: editor.entry?.id || null,
          data: clean,
        },
      });
      await saved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !busy) close();
      }}
    >
      <DialogContent className="wide-dialog">
        <DialogHeader>
          <DialogTitle>
            {editor.entry ? 'Revise' : 'Add'}{' '}
            {schema.label.toLocaleLowerCase('en')}
          </DialogTitle>
          <DialogDescription>
            {editor.entry
              ? 'A new version will be added. The previous version and its references are preserved.'
              : dependencyHint(editor.kind)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          {error && (
            <p className="message error" role="alert">
              {error}
            </p>
          )}
          {schema.fields
            .filter((f) => !['artifactId', 'artifactDigest'].includes(f.key))
            .map((f) => (
              <FieldInput
                key={f.key}
                field={f}
                value={data[f.key]}
                change={(v) => change(f.key, v)}
                entries={snap.entries}
                caseId={editor.entry?.caseId || caseId}
              />
            ))}
          {editor.kind === 'source' && (
            <label className="upload-field">
              Attachment (optional, up to 5 MB)
              <Input
                type="file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  setError('');
                  try {
                    if (file.size > 5_000_000)
                      throw Error(
                        'The attachment must be no larger than 5 MB.',
                      );
                    const body = new FormData();
                    body.set('file', file);
                    const r = await fetch('/api/civos?space=' + snap.space.id, {
                      method: 'POST',
                      body,
                    });
                    const b = (await r.json()) as {
                      error: string;
                      id: string;
                      digest: string;
                    };
                    if (!r.ok) throw Error(b.error);
                    setData((d) => ({
                      ...d,
                      artifactId: b.id,
                      artifactDigest: b.digest,
                      uri: d.uri || 'urn:civos:attachment:' + b.id,
                    }));
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : 'The attachment could not be saved.',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              {data.artifactId && (
                <small>
                  Attachment saved · {String(data.artifactDigest).slice(0, 16)}…
                </small>
              )}
            </label>
          )}
          <div className="form-footer">
            <p>Required fields are marked with *.</p>
            <Button className="primary-action" disabled={busy}>
              {busy
                ? 'Saving…'
                : editor.entry
                  ? 'Save revision'
                  : 'Save record'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function FieldInput({
  field: f,
  value,
  change,
  entries,
  caseId,
}: {
  field: Field;
  value: Data[string] | undefined;
  change: (x: Data[string]) => void;
  entries: Entry[];
  caseId: string;
}) {
  const fieldId = useId();
  const candidates = active(entries).filter(
    (e) => f.targets?.includes(e.kind) && (!e.caseId || e.caseId === caseId),
  );
  for (const id of Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : []) {
    const old = entries.find((e) => e.id === id);
    if (
      old &&
      f.targets?.includes(old.kind) &&
      !candidates.some((e) => e.id === id)
    )
      candidates.push(old);
  }
  const label = f.label + (f.required ? ' *' : '');
  let input;
  if (f.type === 'ref' || f.type === 'select')
    input = (
      <Picker
        value={String(value || '')}
        change={change}
        label={label}
        options={[
          { id: '', label: 'Choose…' },
          ...(f.type === 'ref'
            ? candidates.map((e) => ({ id: e.id, label: String(e.data.title) }))
            : f.options!.map((s) => ({ id: s, label: optionLabel(f, s) }))),
        ]}
      />
    );
  else if (f.type === 'refs')
    input = (
      <fieldset className="ref-options" aria-label={label}>
        {candidates.length ? (
          candidates.map((e) => (
            <label key={e.id} className="check-label">
              <Checkbox
                checked={Array.isArray(value) && value.includes(e.id)}
                onCheckedChange={(yes) =>
                  change(
                    yes
                      ? [...(Array.isArray(value) ? value : []), e.id]
                      : (Array.isArray(value) ? value : []).filter(
                          (id) => id !== e.id,
                        ),
                  )
                }
              />
              <span>{String(e.data.title)}</span>
            </label>
          ))
        ) : (
          <p className="help">
            No records are available to select yet.{' '}
            {f.targets?.map((k) => kinds[k].plural).join(' / ')} must be
            registered first.
          </p>
        )}
      </fieldset>
    );
  else if (f.type === 'long')
    input = (
      <Textarea
        aria-label={label}
        id={fieldId}
        value={String(value || '')}
        onChange={(e) => change(e.target.value)}
        required={f.required}
        maxLength={f.maxLength || 8000}
        rows={3}
      />
    );
  else if (f.type === 'list')
    input = (
      <ListInput
        label={label}
        value={Array.isArray(value) ? value : []}
        change={change}
        required={f.required}
      />
    );
  else if (f.type === 'date') {
    const iso =
      typeof value === 'string' && value
        ? new Date(
            new Date(value).getTime() -
              new Date(value).getTimezoneOffset() * 60000,
          )
            .toISOString()
            .slice(0, 16)
        : '';
    input = (
      <Input
        aria-label={label}
        id={fieldId}
        type="datetime-local"
        value={iso}
        onChange={(e) =>
          change(e.target.value ? new Date(e.target.value).toISOString() : '')
        }
        required={f.required}
      />
    );
  } else
    input = (
      <Input
        aria-label={label}
        id={fieldId}
        type={f.type === 'number' ? 'number' : 'text'}
        step="any"
        value={value === undefined ? '' : String(value)}
        onChange={(e) =>
          change(
            f.type === 'number' && e.target.value !== ''
              ? Number(e.target.value)
              : e.target.value,
          )
        }
        required={f.required}
        maxLength={8000}
      />
    );
  return (
    <div className="form-field">
      <div className="field-label">{label}</div>
      {input}
      {f.hint && <p className="help">{f.hint}</p>}
    </div>
  );
}
function ListInput({
  value,
  change,
  required,
  label,
}: {
  label: string;
  value: string[];
  change: (x: string[]) => void;
  required?: boolean;
}) {
  const [text, setText] = useState(value.join(', '));
  return (
    <Input
      aria-label={label}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        change(
          e.target.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }}
      placeholder="Separate with commas"
      required={required}
    />
  );
}
