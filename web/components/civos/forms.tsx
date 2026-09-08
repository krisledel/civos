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
  new Date(x).toLocaleString('sv-SE', {
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
  const b = (await res.json()) as { error: string; id: string; token: string };
  if (!res.ok) throw Error(b.error || 'Åtgärden misslyckades.');
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
    source: 'Ange källadress, insamlingsmetod, datum och begränsningar.',
    observation:
      'Registrera en källa först. Observationen ska hänvisa till sitt underlag.',
    concept: 'Lägg först till det perspektiv där begreppet har sin betydelse.',
    mapping:
      'Lägg till två begrepp och beskriv vad som går förlorat i översättningen.',
    assessment:
      'Lägg till en deltagare och en observation eller annan post att granska.',
    option:
      'Lägg till observationer som kunskapsgrund. Beskriv nytta, kostnader och möjlighet att avbryta.',
    argument: 'Välj ett alternativ och den deltagare som framför argumentet.',
    decision:
      'Granska alternativets observationer enligt arbetsregeln. Ange mandat, ansvar, mål och uppföljning.',
    task: 'Registrera ett beslut och knyt genomförandet till en ansvarig.',
    outcome:
      'Registrera ett beslut och en källa för utfallet. Använd samma enhet som beslutets mål.',
    rule_change:
      'Knyt förslaget till gällande arbetsregel och de poster som visar problemet.',
    rule_resolution:
      'Välj ett regelförslag. Ett antaget förslag skapar automatiskt nästa arbetsregel.',
  };
  return (
    hints[kind] ||
    'Lägg till en post för att göra den tillgänglig för resten av arbetet.'
  );
}
export function EntryDialog({
  editor,
  snap,
  caseId,
  close,
  saved,
}: {
  editor: { kind: string; entry?: Entry };
  snap: Snapshot;
  caseId: string;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const schema = kinds[editor.kind];
  const [data, setData] = useState<Data>(() =>
    editor.entry
      ? { ...editor.entry.data }
      : Object.fromEntries(
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
      setError(e instanceof Error ? e.message : 'Kunde inte spara.');
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
            {editor.entry ? 'Revidera' : 'Lägg till'}{' '}
            {schema.label.toLocaleLowerCase('sv')}
          </DialogTitle>
          <DialogDescription>
            {editor.entry
              ? 'En ny version läggs till. Den tidigare versionen och dess hänvisningar bevaras.'
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
              Bilaga (valfritt, högst 5 MB)
              <Input
                type="file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  setError('');
                  try {
                    if (file.size > 5_000_000)
                      throw Error('Bilagan får vara högst 5 MB.');
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
                        : 'Bilagan kunde inte sparas.',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              {data.artifactId && (
                <small>
                  Bilaga sparad · {String(data.artifactDigest).slice(0, 16)}…
                </small>
              )}
            </label>
          )}
          <div className="form-footer">
            <p>Obligatoriska fält är märkta med *.</p>
            <Button className="primary-action" disabled={busy}>
              {busy
                ? 'Sparar…'
                : editor.entry
                  ? 'Spara revision'
                  : 'Spara post'}
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
          { id: '', label: 'Välj…' },
          ...(f.type === 'ref'
            ? candidates.map((e) => ({ id: e.id, label: String(e.data.title) }))
            : f.options!.map((s) => ({ id: s, label: s }))),
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
            Det finns inga valbara poster ännu.{' '}
            {f.targets?.map((k) => kinds[k].plural).join(' / ')} behöver
            registreras först.
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
        maxLength={8000}
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
      placeholder="Separera med kommatecken"
      required={required}
    />
  );
}
