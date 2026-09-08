'use client';
import { useState } from 'react';
import { ArrowUpRight, Copy, GitBranch, Hash, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { active, kinds, type Entry } from '@/lib/model';
import { date, type Snapshot } from './forms';
import { RecordGraph } from './graph';

export function SystemMap({
  snapshot,
  caseId,
  selected,
  onOpen,
  onCoordinate,
}: {
  snapshot: Snapshot;
  caseId: string;
  selected?: string;
  onOpen: (entry: Entry) => void;
  onCoordinate: () => void;
}) {
  const { space, entries } = snapshot;
  const current = active(entries);
  const scoped = entries.filter(
    (entry) =>
      caseId === 'all' ||
      (entry.kind === 'case'
        ? entry.id === caseId
        : !entry.caseId || entry.caseId === caseId),
  );
  const latest = entries.at(-1);
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState(false);
  const headParts = space.head.match(/.{1,8}/g) || [];
  return (
    <section className="system-map" aria-label="Samband och posthistorik">
      <header className="system-map-heading">
        <span>
          <Network size={15} /> RELATIONER{' '}
          <span className="instrument-slash">/</span>{' '}
          {caseId === 'all' ? 'HELA ARBETSYTAN' : 'VALT ÄRENDE'}
        </span>
        <span className="instrument-code">CIVOS · 0.3</span>
      </header>
      <div className="system-map-grid">
        <RecordGraph
          entries={scoped}
          selected={selected}
          onOpen={onOpen}
          includeCases
        />
        <aside className="history-instrument" aria-label="Arbetsytans historik">
          <div className="instrument-title">
            <Hash size={15} />
            <h2>Posthistorik</h2>
            <span>SHA-256</span>
          </div>
          <div className="sequence-readout">
            <span>SENASTE SEKVENS</span>
            <strong>{String(space.sequence).padStart(6, '0')}</strong>
          </div>
          <dl className="instrument-stats">
            <div>
              <dt>Aktuella poster</dt>
              <dd>{current.length}</dd>
            </div>
            <div>
              <dt>Revisioner</dt>
              <dd>{entries.filter((entry) => entry.supersedes).length}</dd>
            </div>
          </dl>
          <div className="head-readout">
            <span className="instrument-label">HEAD / KEDJANS SLUTVÄRDE</span>
            <code className="hash-blocks">
              {headParts.map((part, index) => (
                <span key={index}>{part}</span>
              ))}
            </code>
            <Button
              variant="ghost"
              className="copy-head"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(space.head);
                  setCopied(space.head);
                  setCopyError(false);
                } catch {
                  setCopyError(true);
                }
              }}
            >
              <Copy size={13} />{' '}
              {copied === space.head ? 'Kopierad' : 'Kopiera hash'}
            </Button>
            {copyError && <output>Markera och kopiera hashvärdet ovan.</output>}
          </div>
          <div className="branch-readout">
            <GitBranch size={17} />
            <div>
              <span className="instrument-label">GREN</span>
              <strong>
                {space.read_only
                  ? 'Skrivskyddad import'
                  : space.origin
                    ? 'Lokal fortsättning'
                    : 'Lokal arbetsyta'}
              </strong>
            </div>
          </div>
          {space.origin && (
            <p className="branch-counts">
              {space.read_only
                ? entries.length
                : entries.filter((entry) => entry.seq < space.local_start)
                    .length}{' '}
              mottagna poster ·{' '}
              {space.read_only
                ? 0
                : entries.filter((entry) => entry.seq >= space.local_start)
                    .length}{' '}
              lokala tillägg
            </p>
          )}
          {latest && (
            <button className="latest-record" onClick={() => onOpen(latest)}>
              <span className="instrument-label">
                SENAST REGISTRERAD /{' '}
                {kinds[latest.kind].label.toLocaleUpperCase('sv')}
              </span>
              <strong>{String(latest.data.title)}</strong>
              <small>
                {date(latest.createdAt)} <ArrowUpRight size={14} />
              </small>
            </button>
          )}
          <Button
            variant="ghost"
            className="instrument-action"
            onClick={onCoordinate}
          >
            Export & överföring <ArrowUpRight size={14} />
          </Button>
        </aside>
      </div>
    </section>
  );
}
