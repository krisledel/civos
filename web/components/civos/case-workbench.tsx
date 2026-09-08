'use client';
import { useState } from 'react';
import { ArrowUpRight, Plus, Copy, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Picker, date, type Snapshot } from './forms';
import { active, kinds, type Entry } from '@/lib/model';

const fields = [
  {
    id: 'evidence',
    name: 'Underlag',
    types: ['source', 'observation'],
    empty: 'Källor och observationer',
    create: 'source',
  },
  {
    id: 'perspectives',
    name: 'Perspektiv',
    types: ['frame', 'concept', 'mapping'],
    empty: 'Perspektiv, begrepp och deras relationer',
    create: 'frame',
  },
  {
    id: 'review',
    name: 'Prövning',
    types: ['assessment', 'option', 'argument'],
    empty: 'Bedömningar, alternativ och argument',
    create: 'assessment',
  },
  {
    id: 'action',
    name: 'Beslut & utfall',
    types: ['decision', 'task', 'outcome'],
    empty: 'Beslut, åtgärder och uppföljning',
    create: 'decision',
  },
  {
    id: 'rules',
    name: 'Arbetsregler',
    types: ['policy', 'rule_change', 'rule_resolution'],
    empty: 'Regler och prövade ändringar',
    create: 'rule_change',
  },
];
function links(entry: Entry) {
  return kinds[entry.kind].fields.flatMap((field) => {
    if (field.type !== 'ref' && field.type !== 'refs') return [];
    const value = entry.data[field.key];
    return (
      Array.isArray(value)
        ? value
        : typeof value === 'string' && value
          ? [value]
          : []
    ).map((id) => ({ from: entry.id, to: id, label: field.label }));
  });
}
export function CaseWorkbench({
  snapshot,
  caseId,
  selected,
  canCreate,
  onChoose,
  onCreate,
  onOpen,
  onNavigate,
}: {
  snapshot: Snapshot;
  caseId: string;
  selected?: string;
  canCreate: (kind: string) => boolean;
  onChoose: (id: string) => void;
  onCreate: (kind: string, caseId: string) => void;
  onOpen: (entry: Entry) => void;
  onNavigate: (layer: string) => void;
}) {
  const [spot, setSpot] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [copied, setCopied] = useState('');
  const { entries, space } = snapshot;
  const current = active(entries),
    byId = new Map(entries.map((entry) => [entry.id, entry]));
  const cases = current.filter((entry) => entry.kind === 'case');
  const chosen = cases.find((entry) => entry.id === caseId) || cases[0];
  const casePosts = current.filter(
    (entry) => chosen && entry.caseId === chosen.id,
  );
  const caseIds = new Set(casePosts.map((entry) => entry.id));
  const relatedChanges = entries.filter(
    (entry) =>
      entry.kind === 'rule_change' &&
      links(entry).some((link) => {
        const target = byId.get(link.to);
        return (
          chosen &&
          target &&
          (target.id === chosen.id || target.caseId === chosen.id)
        );
      }),
  );
  const changeIds = new Set(relatedChanges.map((entry) => entry.id));
  const changes = current.filter((entry) => changeIds.has(entry.id));
  const resolutions = current.filter(
    (entry) =>
      entry.kind === 'rule_resolution' &&
      links(entry).some((link) => changeIds.has(link.to)),
  );
  const policy = current.filter((entry) => entry.kind === 'policy').at(-1);
  const currentIds = new Set(current.map((entry) => entry.id));
  const basePool = [
    ...casePosts,
    ...changes,
    ...resolutions,
    ...(policy ? [policy] : []),
  ];
  const retained = basePool.flatMap(links).flatMap((link) => {
    const target = byId.get(link.to);
    return target &&
      !currentIds.has(target.id) &&
      (target.caseId === chosen?.id || target.kind === 'policy')
      ? [target]
      : [];
  });
  const pool = [
    ...new Map(
      [...basePool, ...retained].map((entry) => [entry.id, entry]),
    ).values(),
  ];
  const relationList = pool.flatMap(links);
  const actorIds = new Set(relationList.map((link) => link.to));
  const actors = entries.filter(
    (entry) => entry.kind === 'actor' && actorIds.has(entry.id),
  );
  const groups = fields.map((field) => ({
    ...field,
    posts: pool
      .filter((entry) => field.types.includes(entry.kind))
      .sort((a, b) => b.seq - a.seq),
  }));
  const shown = groups.map((field) =>
    expanded.includes(field.id) ? field.posts : field.posts.slice(0, 4),
  );
  const rows = Math.max(4, ...shown.map((group) => group.length));
  const boardHeight = 86 + rows * 104 + 62;
  const positions = new Map(
    shown.flatMap((group, column) =>
      group.map((entry, row) => [entry.id, { column, row }] as const),
    ),
  );
  const focus = selected || spot || '';
  const focusEntry = byId.get(focus);
  const connections = relationList.filter(
    (link) => link.from === focus || link.to === focus,
  );
  const connectedIds = new Set(
    connections.flatMap((link) => [link.from, link.to]),
  );
  const findings = snapshot.findings.filter((finding) =>
    finding.ids.some((id) => caseIds.has(id) || id === chosen?.id),
  );
  const referenced = focusEntry ? links(focusEntry) : [];
  const referring = focusEntry
    ? current.flatMap(links).filter((link) => link.to === focusEntry.id)
    : [];
  return (
    <div className="case-workbench">
      <div className="case-selector-row">
        <div className="case-selector">
          <span className="workbench-caption">ÄRENDE</span>
          {chosen ? (
            <Picker
              value={chosen.id}
              change={onChoose}
              options={cases.map((entry) => ({
                id: entry.id,
                label: String(entry.data.title),
              }))}
              label="Välj ärende"
            />
          ) : (
            <span>Inget ärende registrerat</span>
          )}
        </div>
        {canCreate('case') && (
          <Button
            variant="ghost"
            onClick={() => onCreate('case', chosen?.id || 'all')}
          >
            <Plus size={15} /> Nytt ärende
          </Button>
        )}
      </div>
      {chosen ? (
        <header className="case-heading">
          <div className="case-heading-label">
            <span>{String(chosen.data.domain)}</span>
            <button onClick={() => onOpen(chosen)}>
              Ärendets uppgifter <ArrowUpRight size={14} />
            </button>
          </div>
          <h1>{String(chosen.data.title)}</h1>
          <p>{String(chosen.data.question)}</p>
          <div className="case-context">
            <span>{String(chosen.data.place)}</span>
            <span>{String(chosen.data.timeframe)}</span>
            {Array.isArray(chosen.data.groups) && (
              <span>{chosen.data.groups.join(' · ')}</span>
            )}
          </div>
        </header>
      ) : (
        <header className="case-heading case-heading-empty">
          <span className="workbench-caption">{space.title}</span>
          <h1>Vad behöver avgöras?</h1>
          <p>Registrera frågan, sammanhanget och de berörda grupperna.</p>
          {canCreate('case') && (
            <Button
              className="primary-action"
              onClick={() => onCreate('case', 'all')}
            >
              Skapa första ärendet <ArrowRight size={16} />
            </Button>
          )}
        </header>
      )}
      <div className="field-caption">
        <span>Arbetsfält</span>
        <span>Välj en post för att följa dess hänvisningar</span>
      </div>
      <div
        className="field-scroll"
        aria-label="Arbetsfält, rulla i sidled på en smal skärm"
      >
        <div className="evidence-field" style={{ height: boardHeight }}>
          <svg
            className="field-links"
            viewBox={`0 0 1000 ${boardHeight}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {connections.map((link, index) => {
              const a = positions.get(link.from),
                b = positions.get(link.to);
              if (!a || !b) return null;
              const right = b.column > a.column,
                same = b.column === a.column;
              const x1 = a.column * 200 + (right ? 188 : 12),
                x2 = b.column * 200 + (right ? 12 : 188);
              const y1 = 86 + a.row * 104 + 42,
                y2 = 86 + b.row * 104 + 42;
              const bend = same ? a.column * 200 + 198 : (x1 + x2) / 2;
              return (
                <path
                  key={index}
                  d={`M${x1},${y1} C${bend},${y1} ${bend},${y2} ${x2},${y2}`}
                />
              );
            })}
          </svg>
          {groups.map((field, column) => (
            <section
              className="work-field"
              key={field.id}
              aria-label={field.name}
            >
              <header>
                <h2>{field.name}</h2>
                <span>{field.posts.length}</span>
              </header>
              {shown[column].map((entry, row) => (
                <button
                  key={entry.id}
                  className={
                    'field-record' +
                    (entry.id === focus ? ' selected' : '') +
                    (connectedIds.has(entry.id) ? ' connected' : '') +
                    (focus && !connectedIds.has(entry.id) && entry.id !== focus
                      ? ' subdued'
                      : '')
                  }
                  style={{ top: 86 + row * 104 }}
                  onMouseEnter={() => setSpot(entry.id)}
                  onFocus={() => setSpot(entry.id)}
                  onClick={() => {
                    setSpot(entry.id);
                    onOpen(entry);
                  }}
                >
                  <span className="field-record-meta">
                    <span>{kinds[entry.kind].label}</span>
                    <span>{String(entry.seq).padStart(3, '0')}</span>
                  </span>
                  <strong>{String(entry.data.title)}</strong>
                  {(!currentIds.has(entry.id) ||
                    entry.data.verdict ||
                    entry.data.position ||
                    entry.data.status) && (
                    <small>
                      {!currentIds.has(entry.id)
                        ? 'Äldre version'
                        : String(
                            entry.data.verdict ||
                              entry.data.position ||
                              entry.data.status,
                          )}
                    </small>
                  )}
                </button>
              ))}
              {!field.posts.length && (
                <p className="field-empty">{field.empty}</p>
              )}
              <div
                className="field-actions"
                style={{
                  top: 86 + Math.max(shown[column].length, 1) * 104 + 9,
                }}
              >
                {field.posts.length > 4 && (
                  <button
                    onClick={() =>
                      setExpanded((open) =>
                        open.includes(field.id)
                          ? open.filter((id) => id !== field.id)
                          : [...open, field.id],
                      )
                    }
                  >
                    {expanded.includes(field.id)
                      ? 'Visa färre'
                      : `Visa ${field.posts.length - 4} till`}
                  </button>
                )}
                {chosen && canCreate(field.create) && (
                  <button onClick={() => onCreate(field.create, chosen.id)}>
                    <Plus size={13} /> {kinds[field.create].label}
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
      <section
        className="relation-index"
        aria-label="Hänvisningar för vald post"
      >
        <div className="relation-anchor">
          <span className="workbench-caption">
            {focusEntry ? kinds[focusEntry.kind].label : 'HÄNVISNINGAR'}
          </span>
          {focusEntry ? (
            <button onClick={() => onOpen(focusEntry)}>
              {String(focusEntry.data.title)} <ArrowUpRight size={15} />
            </button>
          ) : (
            <p>Markera en post i arbetsfälten.</p>
          )}
        </div>
        {focusEntry && (
          <>
            <div>
              <h3>
                Hänvisar till <span>{referenced.length}</span>
              </h3>
              {referenced.length ? (
                referenced.map((link, index) => {
                  const entry = byId.get(link.to);
                  return (
                    entry && (
                      <button key={index} onClick={() => onOpen(entry)}>
                        <span>{link.label}</span>
                        <strong>{String(entry.data.title)}</strong>
                        <ArrowUpRight size={13} />
                      </button>
                    )
                  );
                })
              ) : (
                <p>Inga registrerade hänvisningar.</p>
              )}
            </div>
            <div>
              <h3>
                Hänvisningar hit <span>{referring.length}</span>
              </h3>
              {referring.length ? (
                referring.map((link, index) => {
                  const entry = byId.get(link.from);
                  return (
                    entry && (
                      <button key={index} onClick={() => onOpen(entry)}>
                        <span>
                          {link.label}
                          {entry.data.verdict
                            ? ` · ${String(entry.data.verdict)}`
                            : entry.data.position
                              ? ` · ${String(entry.data.position)}`
                              : ''}
                        </span>
                        <strong>{String(entry.data.title)}</strong>
                        <ArrowUpRight size={13} />
                      </button>
                    )
                  );
                })
              ) : (
                <p>Ingen aktuell post hänvisar hit.</p>
              )}
            </div>
          </>
        )}
      </section>
      {actors.length > 0 && (
        <div className="case-actors">
          <span>Refererade deltagare</span>
          {actors.map((entry) => (
            <button key={entry.id} onClick={() => onOpen(entry)}>
              {String(entry.data.title)} <ArrowUpRight size={13} />
            </button>
          ))}
        </div>
      )}
      <details className="workbench-review" open={findings.length > 0}>
        <summary>
          Att pröva <span>{findings.length}</span>
        </summary>
        {findings.length ? (
          findings.map((finding, index) => (
            <button
              key={index}
              onClick={() => {
                const entry = byId.get(finding.ids[0]);
                if (entry) onOpen(entry);
              }}
            >
              <span className="review-dot" />
              <span>
                <strong>{finding.title}</strong>
                <small>{finding.detail}</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))
        ) : (
          <p>Inga avvikelser enligt de kontroller som körts för ärendet.</p>
        )}
      </details>
      <details className="workbench-history">
        <summary>
          Arbetsytans historik{' '}
          <span>
            {space.sequence} poster ·{' '}
            {entries.filter((entry) => entry.supersedes).length} revisioner
          </span>
        </summary>
        <div className="history-body">
          <div>
            <span className="workbench-caption">
              SHA-256 / KEDJANS SLUTVÄRDE
            </span>
            <code>{space.head}</code>
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(space.head);
                  setCopied(space.head);
                } catch {
                  setCopied('error');
                }
              }}
            >
              <Copy size={14} />
              {copied === space.head ? 'Kopierad' : 'Kopiera hash'}
            </Button>
            {copied === 'error' && (
              <output>Markera och kopiera hashvärdet ovan.</output>
            )}
            <p>
              {space.read_only
                ? 'Skrivskyddad import'
                : space.origin
                  ? 'Lokal fortsättning'
                  : 'Lokal arbetsyta'}
              {space.origin &&
                ` · ${space.read_only ? entries.length : entries.filter((entry) => entry.seq < space.local_start).length} mottagna poster · ${space.read_only ? 0 : entries.filter((entry) => entry.seq >= space.local_start).length} lokala tillägg`}
            </p>
            <dl className="workspace-measures">
              <div>
                <dt>Observationer med minst en bedömning</dt>
                <dd>
                  {snapshot.statistics.reviewed} /{' '}
                  {snapshot.statistics.observations}
                </dd>
              </div>
              <div>
                <dt>Uppföljda förfallna beslut</dt>
                <dd>
                  {snapshot.statistics.followed} / {snapshot.statistics.due}
                </dd>
              </div>
              <div>
                <dt>Kända källursprung</dt>
                <dd>{snapshot.statistics.originGroups}</dd>
              </div>
            </dl>
            <p>
              {snapshot.statistics.sources} källor, varav{' '}
              {snapshot.statistics.unknownOrigins} med okänt ursprung.
            </p>
            <button
              className="text-button"
              onClick={() => onNavigate('coordinate')}
            >
              Export och överföring <ArrowUpRight size={14} />
            </button>
          </div>
          <div>
            {entries
              .slice(-6)
              .reverse()
              .map((entry) => (
                <button
                  className="history-record"
                  key={entry.id}
                  onClick={() => onOpen(entry)}
                >
                  <span>{entry.seq}</span>
                  <strong>{String(entry.data.title)}</strong>
                  <small>{date(entry.createdAt)}</small>
                </button>
              ))}
          </div>
        </div>
      </details>
    </div>
  );
}
