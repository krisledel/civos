'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- SVG nodes require SVG elements; equivalent native buttons are also provided below. */
import { useMemo, useState } from 'react';
import { Network, Search, ArrowUpRight, Focus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { kinds, active, type Entry } from '@/lib/model';
type Edge = { from: string; to: string; label: string };
const palette: Record<string, string> = {
  models: '#e3b66d',
  overview: '#b7bdbe',
  observe: '#9da3a5',
  frames: '#c2c3c9',
  trust: '#939b98',
  decide: '#e4b66b',
  outcomes: '#dba2ef',
  coordinate: '#a1a3a4',
};
export function RecordGraph({
  entries,
  selected,
  onOpen,
  includeCases = false,
}: {
  entries: Entry[];
  selected?: string;
  onOpen: (e: Entry) => void;
  includeCases?: boolean;
}) {
  const [query, setQuery] = useState(''),
    [showCases, setShowCases] = useState(includeCases),
    [zoom, setZoom] = useState(1),
    [hover, setHover] = useState('');
  const graph = useMemo(() => {
    const current = active(entries),
      edges: Edge[] = [];
    for (const e of current) {
      for (const f of kinds[e.kind].fields) {
        if (f.type !== 'ref' && f.type !== 'refs') continue;
        const value = e.data[f.key];
        for (const id of Array.isArray(value)
          ? value
          : typeof value === 'string' && value
            ? [value]
            : [])
          edges.push({ from: e.id, to: id, label: f.label });
      }
      if (showCases && e.caseId)
        edges.push({ from: e.id, to: e.caseId, label: 'Belongs to case' });
    }
    const related = new Set(edges.flatMap((e) => [e.from, e.to]));
    const currentIds = new Set(current.map((e) => e.id));
    const candidates = [
      ...current,
      ...entries.filter((e) => !currentIds.has(e.id) && related.has(e.id)),
    ];
    let pool = candidates.filter(
      (e) =>
        (showCases || e.kind !== 'case') &&
        (!query ||
          String(e.data.title)
            .toLocaleLowerCase('en')
            .includes(query.toLocaleLowerCase('en'))),
    );
    if (query) {
      const hits = new Set(pool.map((e) => e.id));
      for (const edge of edges)
        if (hits.has(edge.from) || hits.has(edge.to)) {
          const other = candidates.find(
            (e) => e.id === (hits.has(edge.from) ? edge.to : edge.from),
          );
          if (other && !pool.some((e) => e.id === other.id)) pool.push(other);
        }
    }
    const total = pool.length;
    pool = pool
      .sort(
        (a, b) =>
          Number(related.has(b.id)) - Number(related.has(a.id)) ||
          a.seq - b.seq,
      )
      .slice(0, 80);
    const chosen = candidates.find((e) => e.id === selected);
    if (chosen && !pool.some((e) => e.id === selected) && pool.length === 80)
      pool[79] = chosen;
    const nodes = pool.map((e, i) => ({
      entry: e,
      x:
        400 +
        Math.cos(i * 2.39996) *
          Math.sqrt((i + 1) / Math.max(pool.length, 1)) *
          300,
      y:
        250 +
        Math.sin(i * 2.39996) *
          Math.sqrt((i + 1) / Math.max(pool.length, 1)) *
          180,
    }));
    const lookup = new Map(nodes.map((n) => [n.entry.id, n]));
    const visibleEdges = edges.filter(
      (e) => lookup.has(e.from) && lookup.has(e.to),
    );
    for (let step = 0; step < 130; step++) {
      for (let i = 0; i < nodes.length; i++) {
        let dx = 0,
          dy = 0;
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const x = nodes[i].x - nodes[j].x,
            y = nodes[i].y - nodes[j].y,
            d = Math.max(60, x * x + y * y);
          dx += (x * 110) / d;
          dy += (y * 110) / d;
        }
        nodes[i].x +=
          Math.max(-5, Math.min(5, dx)) + (400 - nodes[i].x) * 0.002;
        nodes[i].y +=
          Math.max(-5, Math.min(5, dy)) + (250 - nodes[i].y) * 0.003;
      }
      for (const edge of visibleEdges) {
        const a = lookup.get(edge.from)!,
          b = lookup.get(edge.to)!,
          x = b.x - a.x,
          y = b.y - a.y,
          d = Math.max(1, Math.hypot(x, y)),
          force = (d - 110) * 0.009;
        a.x += (x / d) * force;
        a.y += (y / d) * force;
        b.x -= (x / d) * force;
        b.y -= (y / d) * force;
      }
      for (const n of nodes) {
        n.x = Math.max(65, Math.min(735, n.x));
        n.y = Math.max(50, Math.min(445, n.y));
      }
    }
    return { nodes, edges: visibleEdges, lookup, total };
  }, [entries, query, showCases, selected]);
  const focus = hover || selected,
    linked = new Set(
      graph.edges
        .filter((e) => e.from === focus || e.to === focus)
        .flatMap((e) => [e.from, e.to]),
    );
  return (
    <section className="graph-panel">
      <div className="graph-toolbar">
        <div>
          <Network size={17} />
          <strong>Reference graph</strong>
          <span>
            {graph.nodes.length} documents · {graph.edges.length} links
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setZoom(1);
            setQuery('');
            setHover('');
          }}
        >
          <Focus size={15} />
          Reset
        </Button>
      </div>
      <div className="graph-search">
        <Search size={16} />
        <Input
          aria-label="Search graph"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a document and its references…"
        />
        <label htmlFor="graph-cases">
          <Checkbox
            id="graph-cases"
            checked={showCases}
            onCheckedChange={(v) => setShowCases(v)}
          />
          Case links
        </label>
      </div>
      {graph.nodes.length ? (
        <>
          <div className="graph-canvas">
            <svg
              viewBox={`${400 - 400 / zoom} ${250 - 250 / zoom} ${800 / zoom} ${500 / zoom}`}
              role="img"
              aria-label="Reference graph. Documents can also be opened from the list below."
            >
              <title>Workspace documents and directed references</title>
              <defs>
                <pattern
                  id="graph-grid"
                  width="24"
                  height="24"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 24 0 L 0 0 0 24"
                    fill="none"
                    stroke="#3e4041"
                    strokeWidth="0.5"
                    opacity=".4"
                  />
                </pattern>
                <marker
                  id="arrowhead"
                  viewBox="0 0 10 10"
                  refX="17"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#7e8081" />
                </marker>
              </defs>
              <rect
                x="-800"
                y="-500"
                width="2400"
                height="1500"
                fill="url(#graph-grid)"
              />
              {graph.edges.map((e, i) => {
                const a = graph.lookup.get(e.from)!,
                  b = graph.lookup.get(e.to)!,
                  lit = focus === e.from || focus === e.to;
                return (
                  <g key={i}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={lit ? '#afb5b6' : '#5f6162'}
                      strokeWidth={lit ? 2 : 1}
                      opacity={focus && !lit ? 0.14 : 0.7}
                      markerEnd="url(#arrowhead)"
                    />
                    <title>
                      {e.label}: {String(a.entry.data.title)} →{' '}
                      {String(b.entry.data.title)}
                    </title>
                  </g>
                );
              })}
              {graph.nodes.map((n) => {
                const isSelected = n.entry.id === selected,
                  lit =
                    !focus || n.entry.id === focus || linked.has(n.entry.id),
                  color = palette[kinds[n.entry.kind].layer];
                return (
                  <g
                    key={n.entry.id}
                    role="button"
                    tabIndex={0}
                    aria-label={
                      kinds[n.entry.kind].label + ': ' + n.entry.data.title
                    }
                    className="graph-node"
                    onClick={() => onOpen(n.entry)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen(n.entry);
                      }
                    }}
                    onMouseEnter={() => setHover(n.entry.id)}
                    onMouseLeave={() => setHover('')}
                    onFocus={() => setHover(n.entry.id)}
                    onBlur={() => setHover('')}
                    opacity={lit ? 1 : 0.25}
                  >
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={22}
                      fill={isSelected ? '#2c2d2e' : 'transparent'}
                      stroke={isSelected ? color : 'transparent'}
                      strokeWidth="1"
                    />
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={isSelected ? 10 : 7}
                      fill={color}
                      stroke={isSelected ? '#edeeee' : '#121314'}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    <text
                      x={n.x}
                      y={n.y - 16}
                      textAnchor="middle"
                      className="graph-node-seq"
                      fill={color}
                      fontSize="12"
                    >
                      {String(n.entry.seq).padStart(3, '0')}
                    </text>
                    {(graph.nodes.length <= 22 || (focus && lit)) && (
                      <text
                        x={n.x}
                        y={n.y + 31}
                        textAnchor="middle"
                        fill={isSelected ? '#f3f4f5' : '#c4c5c5'}
                        fontSize="12"
                      >
                        {String(n.entry.data.title).slice(0, 25)}
                        {String(n.entry.data.title).length > 25 ? '…' : ''}
                      </text>
                    )}
                    <title>
                      {kinds[n.entry.kind].label}: {String(n.entry.data.title)}
                    </title>
                  </g>
                );
              })}
            </svg>
            <div className="graph-zoom">
              <Button
                variant="ghost"
                aria-label="Zoom out"
                disabled={zoom <= 0.7}
                onClick={() => setZoom((z) => Math.max(0.7, z - 0.2))}
              >
                −
              </Button>
              <span>{Math.round(zoom * 100)}%</span>
              <Button
                variant="ghost"
                aria-label="Zoom in"
                disabled={zoom >= 1.7}
                onClick={() => setZoom((z) => Math.min(1.7, z + 0.2))}
              >
                +
              </Button>
            </div>
          </div>
          <div className="graph-legend">
            {Object.entries(palette)
              .filter(([layer]) =>
                graph.nodes.some((n) => kinds[n.entry.kind].layer === layer),
              )
              .map(([layer, color]) => (
                <span key={layer}>
                  <i style={{ background: color }} />
                  {
                    (
                      {
                        overview: 'Case',
                        models: 'Models',
                        observe: 'Evidence',
                        frames: 'Perspectives',
                        trust: 'Review',
                        decide: 'Decisions',
                        outcomes: 'Outcomes',
                        coordinate: 'Working rule',
                      } as Record<string, string>
                    )[layer]
                  }
                </span>
              ))}
          </div>
        </>
      ) : (
        <div className="graph-empty">
          <Network size={45} />
          <h3>
            {query ? 'No matching documents' : 'References grow as you work'}
          </h3>
          <p>
            Link an observation to a source, an argument to an option or an
            outcome to a decision.
          </p>
        </div>
      )}
      {graph.total > 80 && (
        <p className="help">
          Showing 80 of {graph.total} documents. Search or choose a case to
          narrow the graph.
        </p>
      )}
      {graph.nodes.length > 0 && (
        <details className="graph-accessible">
          <summary>Documents and relations as a list</summary>
          <div>
            {graph.nodes.map((n) => (
              <button key={n.entry.id} onClick={() => onOpen(n.entry)}>
                <span>
                  <small>{kinds[n.entry.kind].label}</small>
                  {String(n.entry.data.title)}
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
          <ul>
            {graph.edges.map((e, i) => (
              <li key={i}>
                {String(graph.lookup.get(e.from)?.entry.data.title)}{' '}
                <strong>→ {e.label} →</strong>{' '}
                {String(graph.lookup.get(e.to)?.entry.data.title)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
