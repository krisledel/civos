'use client';
/* oxlint-disable react/react-compiler -- explicit loading resets are intentional; this app does not enable the React compiler. */
import { useEffect, useState, useCallback } from 'react';
import {
  Layers3,
  Plus,
  Workflow,
  Eye,
  Network,
  ShieldCheck,
  Scale,
  Activity,
  Settings2,
  Download,
  Upload,
  ArrowRight,
  GitBranch,
  RefreshCw,
  Search,
  History,
  FileText,
  FolderOpen,
  ArrowLeft,
  X,
  Library,
  CircleCheck,
  Clock3,
  BookOpen,
  Users,
  Compass,
  ArrowUpRight,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  kinds,
  active,
  meetsTarget,
  references,
  type Entry,
} from '@/lib/model';
import {
  Picker,
  EntryDialog,
  request,
  date,
  type Snapshot,
  dependencyHint,
} from '@/components/civos/forms';
import { RecordGraph } from '@/components/civos/graph';
import { SystemMap } from '@/components/civos/system-map';
import { QuickSwitcher } from '@/components/civos/quick-switcher';
import type { Space } from '@/lib/store';
const layers = [
  { id: 'overview', name: 'Arbetsyta', icon: Workflow },
  { id: 'graph', name: 'Sambandsgraf', icon: Network },
  { id: 'observe', name: 'Observationer', icon: Eye },
  { id: 'frames', name: 'Perspektiv', icon: Network },
  { id: 'trust', name: 'Granskning', icon: ShieldCheck },
  { id: 'decide', name: 'Beslut & åtgärder', icon: Scale },
  { id: 'outcomes', name: 'Uppföljning', icon: Activity },
  { id: 'coordinate', name: 'Samordning', icon: Settings2 },
];
function saveFile(content: Blob, name: string) {
  const url = URL.createObjectURL(content),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function MobileMenuDismiss({ selection }: { selection: string }) {
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    setOpenMobile(false);
  }, [selection, setOpenMobile]);
  return null;
}
export default function Home() {
  const [spaces, setSpaces] = useState<Space[]>([]),
    [sid, setSid] = useState(''),
    [snap, setSnap] = useState<Snapshot | null>(null),
    [layer, setLayer] = useState('overview'),
    [caseId, setCase] = useState('all'),
    [kind, setKind] = useState('source'),
    [search, setSearch] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [auth, setAuth] = useState(false),
    [loaded, setLoaded] = useState(false),
    [sidebarOpen, setSidebarOpen] = useState(true),
    [allFindings, setAllFindings] = useState(false),
    [navigationStep, setNavigationStep] = useState(0),
    [editor, setEditor] = useState<{ kind: string; entry?: Entry } | null>(
      null,
    ),
    [detail, setDetail] = useState<Entry | null>(null),
    [documentHistory, setDocumentHistory] = useState<Entry[]>([]),
    [graphFocus, setGraphFocus] = useState<string | undefined>(),
    [spaceDialog, setSpaceDialog] = useState(false),
    [invite, setInvite] = useState(''),
    [inviteRole, setInviteRole] = useState('reviewer'),
    [joinToken, setJoin] = useState(''),
    [trustDialog, setTrustDialog] = useState(false),
    [notice, setNotice] = useState('');
  const openDocument = (entry: Entry | null) => {
    setNavigationStep((step) => step + 1);
    if (entry) setGraphFocus(entry.id);
    if (entry && detail && entry.id !== detail.id)
      setDocumentHistory((h) => [...h, detail].slice(-30));
    if (!entry) setDocumentHistory([]);
    setDetail(entry);
  };
  const previousDocument = () => {
    const last = documentHistory.at(-1);
    if (last) {
      setDetail(last);
      setDocumentHistory((h) => h.slice(0, -1));
    }
  };
  useEffect(() => {
    if (detail) document.getElementById('document-title')?.focus();
  }, [detail]);
  useEffect(() => {
    setAllFindings(false);
  }, [sid, caseId]);
  const refreshSpaces = useCallback(async (chosen?: string) => {
    const r = await fetch('/api/civos');
    if (r.status === 401) {
      setAuth(true);
      setLoaded(true);
      return;
    }
    const d = (await r.json()) as Snapshot & { error: string; spaces: Space[] };
    if (!r.ok) throw Error(d.error);
    setAuth(false);
    setSpaces(d.spaces);
    setLoaded(true);
    if (chosen) setSid(chosen);
    else
      setSid(
        (old) =>
          old ||
          d.spaces.find(
            (s: Space) => s.id === localStorage.getItem('civos.workspace'),
          )?.id ||
          d.spaces[0]?.id ||
          '',
      );
  }, []);
  const refresh = useCallback(async () => {
    if (!sid) return;
    const r = await fetch('/api/civos?space=' + encodeURIComponent(sid));
    const d = (await r.json()) as Snapshot & { error: string; spaces: Space[] };
    if (!r.ok) throw Error(d.error);
    setSnap(d);
  }, [sid]);
  // oxlint-disable-next-line react/react-compiler -- state changes follow an asynchronous server read.
  useEffect(() => {
    refreshSpaces().catch((e) => {
      setError(e.message);
      setLoaded(true);
    });
  }, [refreshSpaces]);
  // oxlint-disable-next-line react/react-compiler -- clear the previous workspace while a new request is in flight.
  useEffect(() => {
    if (!sid) return;
    localStorage.setItem('civos.workspace', sid);
    let live = true;
    setSnap(null);
    setCase('all');
    setDetail(null);
    setDocumentHistory([]);
    fetch('/api/civos?space=' + encodeURIComponent(sid))
      .then(async (r) => {
        const d = (await r.json()) as Snapshot & {
          error: string;
          spaces: Space[];
        };
        if (!r.ok) throw Error(d.error);
        if (live) setSnap(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [sid]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Åtgärden misslyckades.');
    } finally {
      setBusy(false);
    }
  };
  const entries = snap?.entries || [],
    current = active(entries),
    cases = current.filter((e) => e.kind === 'case'),
    byId = new Map(entries.map((e) => [e.id, e]));
  const canKind = (k: string) =>
    !!snap &&
    !snap.space.read_only &&
    snap.space.role !== 'viewer' &&
    (snap.space.role !== 'reviewer' ||
      ['assessment', 'argument', 'outcome'].includes(k)) &&
    (!['rule_resolution', 'policy'].includes(k) || snap.space.role === 'owner');
  const visible = current.filter(
    (e) =>
      (caseId === 'all' || !e.caseId || e.caseId === caseId) &&
      (!search ||
        JSON.stringify(e.data)
          .toLocaleLowerCase('sv')
          .includes(search.toLocaleLowerCase('sv'))),
  );
  const scopedFindings = (snap?.findings || []).filter(
    (finding) =>
      caseId === 'all' ||
      finding.ids.some(
        (id) => byId.get(id)?.caseId === caseId || id === caseId,
      ),
  );
  const kindOptions = Object.entries(kinds).filter(
      ([, v]) => v.layer === layer,
    ),
    title = layers.find((l) => l.id === layer)!.name;
  const navigate = (id: string) => {
    setNavigationStep((step) => step + 1);
    if (window.innerWidth <= (sidebarOpen ? 1359 : 1119)) {
      setDetail(null);
      setDocumentHistory([]);
    }
    setLayer(id);
    setSearch('');
    setKind(
      Object.entries(kinds).find(([, v]) => v.layer === id)?.[0] || 'case',
    );
  };
  const newEntry = (k: string) => {
    if (!kinds[k].global && caseId === 'all' && cases.length !== 1) {
      setError('Välj ett ärende i listan ovan innan du lägger till en post.');
      return;
    }
    setEditor({ kind: k });
  };
  const exportBundle = () =>
    run(async () => {
      const r = await fetch('/api/civos?space=' + sid + '&export=1');
      if (!r.ok) throw Error(((await r.json()) as { error: string }).error);
      saveFile(await r.blob(), 'civos-export.json');
      setNotice('Signerad export sparad. Bilagor laddas ner separat.');
    });
  const csv = () => {
    const rows = [
      [
        'sekvens',
        'id',
        'typ',
        'ärende',
        'rubrik',
        'registrerande konto',
        'tidpunkt',
        'ersätter',
        'hash',
      ],
      ...entries.map((e) => [
        e.seq,
        e.id,
        kinds[e.kind].label,
        e.caseId || '',
        e.data.title,
        e.actor,
        e.createdAt,
        e.supersedes || '',
        e.hash,
      ]),
    ];
    const cell = (x: unknown) => {
      let s = String(x);
      if (/^[=+@\-\t\r\n]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    saveFile(
      new Blob(
        ['\uFEFF' + rows.map((r) => r.map(cell).join(';')).join('\r\n')],
        { type: 'text/csv;charset=utf-8' },
      ),
      'civos-register.csv',
    );
  };
  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      className={
        'civos-shell' +
        (detail ? ' has-document' : '') +
        (!sidebarOpen ? ' sidebar-collapsed' : '')
      }
    >
      <MobileMenuDismiss
        selection={`${sid}:${navigationStep}:${spaceDialog}`}
      />
      <nav className="icon-rail" aria-label="Snabbnavigering">
        <div className="rail-mark">
          <Layers3 />
        </div>
        <button
          aria-label="Arbetsyta"
          onClick={() => navigate('overview')}
          className={layer === 'overview' ? 'active' : ''}
        >
          <Library />
        </button>
        <button
          aria-label="Sambandsgraf"
          onClick={() => navigate('graph')}
          className={layer === 'graph' ? 'active' : ''}
        >
          <Network />
        </button>
        <button aria-label="Samordning" onClick={() => navigate('coordinate')}>
          <Settings2 />
        </button>
        <span className="rail-bottom">KL</span>
      </nav>
      <Sidebar className="civos-sidebar">
        <SidebarHeader>
          <div className="brand">
            <Layers3 />
            <strong>CivOS</strong>
          </div>
          <span className="small-label">KUNSKAP · PERSPEKTIV · HANDLING</span>
          <div className="workspace-selector">
            {spaces.length > 0 && (
              <Picker
                value={sid}
                change={setSid}
                options={spaces.map((s) => ({ id: s.id, label: s.title }))}
                label="Välj arbetsyta"
              />
            )}
            <Button
              variant="ghost"
              className="new-workspace"
              onClick={() => setSpaceDialog(true)}
              disabled={auth || busy}
              aria-label="Skapa ny arbetsyta"
              title="Skapa ny arbetsyta"
            >
              <Plus size={16} />
              {!spaces.length && 'Ny arbetsyta'}
            </Button>
          </div>
          <QuickSwitcher
            entries={current}
            onOpen={openDocument}
            onGraph={() => navigate('graph')}
          />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>VYER</SidebarGroupLabel>
            <SidebarMenu>
              {layers.map((x, i) => (
                <SidebarMenuItem key={x.id}>
                  <SidebarMenuButton
                    isActive={layer === x.id}
                    onClick={() => navigate(x.id)}
                  >
                    <x.icon />
                    <span>{x.name}</span>
                    <span className="nav-index">
                      {i ? String(i).padStart(2, '0') : '•'}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup className="document-tree">
            <SidebarGroupLabel>
              DOKUMENT <span>{current.length}</span>
            </SidebarGroupLabel>
            {cases.map((c) => (
              <details key={c.id} open={caseId === c.id || cases.length === 1}>
                <summary>
                  <FolderOpen size={14} />
                  <span>{String(c.data.title)}</span>
                  <button
                    aria-label={'Visa ärendet ' + c.data.title}
                    onClick={(e) => {
                      e.preventDefault();
                      setCase(c.id);
                      openDocument(c);
                    }}
                  >
                    ↗
                  </button>
                </summary>
                {current
                  .filter((e) => e.caseId === c.id)
                  .map((e) => (
                    <button
                      key={e.id}
                      className={detail?.id === e.id ? 'active' : ''}
                      onClick={() => {
                        setCase(c.id);
                        openDocument(e);
                      }}
                    >
                      <FileText size={13} />
                      <span>{String(e.data.title)}</span>
                    </button>
                  ))}
              </details>
            ))}
            {!cases.length && (
              <p>Ärenden och dokument visas här när du börjar arbeta.</p>
            )}
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="owner-avatar">KL</div>
          <strong>Kris Ledel</strong>
          <span className="small-label">CivOS</span>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="workspace-top">
          <SidebarTrigger />
          <div className="workspace-tab">
            <FileText size={14} />
            <span>{title}</span>
          </div>
          <button className="tab-graph" onClick={() => navigate('graph')}>
            <Network size={14} />
            Grafvy
          </button>
          <span className="system-status">
            <i />
            {snap ? 'Arbetsyta ansluten' : 'Arbetsyta'}
          </span>
        </header>
        <main className="workspace-main">
          <div className="section-title">
            <div>
              <span className="small-label">
                {snap?.space.title || 'CivOS'} / {title}
              </span>
              <h1>
                {layer === 'overview' ? snap?.space.title || 'CivOS' : title}
              </h1>
              <p>
                {snap?.space.purpose ||
                  'Samla underlag. Pröva perspektiv. Följ besluten.'}
              </p>
            </div>
            {snap && layer === 'overview' && (
              <div className="header-actions">
                <Button variant="outline" onClick={() => navigate('graph')}>
                  <Network size={16} /> Visa samband
                </Button>
                {canKind('case') && (
                  <Button
                    className="primary-action"
                    onClick={() => newEntry('case')}
                    disabled={busy}
                  >
                    <Plus size={16} /> Nytt ärende
                  </Button>
                )}
              </div>
            )}
          </div>
          {error && (
            <div role="alert" className="message error">
              <span>{error}</span>
              <Button variant="ghost" onClick={() => run(refresh)}>
                Läs in igen
              </Button>
            </div>
          )}
          {notice && <output className="message success">{notice}</output>}
          {auth ? (
            <section className="panel">
              <h2>Öppna din arbetsyta</h2>
              <p>Logga in för att läsa och spara ärenden.</p>
              <button
                className="action-link"
                onClick={() => window.location.assign('/signin-with-chatgpt')}
              >
                Logga in <ArrowRight size={16} />
              </button>
            </section>
          ) : !loaded ? (
            <output>Läser arbetsytor…</output>
          ) : (
            <>
              <div className="workspace-controls">
                {snap && (
                  <>
                    <Picker
                      value={caseId}
                      change={setCase}
                      options={[
                        { id: 'all', label: 'Alla ärenden' },
                        ...cases.map((e) => ({
                          id: e.id,
                          label: String(e.data.title),
                        })),
                      ]}
                      label="Ärende"
                    />
                    <Button
                      variant="outline"
                      onClick={() => run(refresh)}
                      disabled={busy}
                      aria-label="Uppdatera"
                    >
                      <RefreshCw size={16} />
                    </Button>
                  </>
                )}
              </div>
              {!spaces.length ? (
                <section className="welcome-card">
                  <div className="welcome-icon">
                    <Layers3 />
                  </div>
                  <div>
                    <span className="small-label">DIN FÖRSTA ARBETSYTA</span>
                    <h2>Initiera en arbetsyta.</h2>
                    <p>
                      Avgränsa en fråga. Registrera underlag, pröva påståenden
                      och följ beslut genom en versionerad historik.
                    </p>
                    <Button
                      className="primary-action"
                      onClick={() => setSpaceDialog(true)}
                    >
                      Skapa arbetsyta <ArrowRight />
                    </Button>
                    <div
                      className="welcome-steps"
                      aria-label="Arbetets tre steg"
                    >
                      <span>
                        <BookOpen size={17} /> Samla underlag
                      </span>
                      <span>
                        <Compass size={17} /> Pröva perspektiv
                      </span>
                      <span>
                        <CircleCheck size={17} /> Följ besluten
                      </span>
                    </div>
                  </div>
                </section>
              ) : !snap ? (
                <output>Läser sparad historik…</output>
              ) : (
                <>
                  {snap.space.read_only === 1 && (
                    <div className="message">
                      <GitBranch size={20} />
                      <span>
                        Importerad gren. Signaturen och historiken är
                        verifierade; påståendena behöver granskas.
                      </span>
                      <Button
                        onClick={() =>
                          run(async () => {
                            const d = await request('fork', { space: sid });
                            await refreshSpaces(d.id);
                          })
                        }
                        disabled={busy}
                      >
                        Skapa lokal fortsättning
                      </Button>
                    </div>
                  )}
                  {layer === 'graph' ? (
                    <RecordGraph
                      entries={entries.filter(
                        (e) =>
                          caseId === 'all' ||
                          (e.kind === 'case'
                            ? e.id === caseId
                            : !e.caseId || e.caseId === caseId),
                      )}
                      selected={detail?.id || graphFocus}
                      onOpen={openDocument}
                    />
                  ) : layer === 'overview' ? (
                    <>
                      <SystemMap
                        snapshot={snap}
                        caseId={caseId}
                        selected={detail?.id || graphFocus}
                        onOpen={openDocument}
                        onCoordinate={() => navigate('coordinate')}
                      />
                      <div className="overview-caption">
                        <span className="small-label">LÄGET I ARBETSYTAN</span>
                        <span>{current.length} aktuella poster</span>
                      </div>
                      <div className="metric-grid">
                        {[
                          {
                            label: 'Granskade observationer',
                            value: snap.statistics.reviewed,
                            total: snap.statistics.observations,
                            note: 'Minst en registrerad bedömning',
                            icon: ShieldCheck,
                            tone: 'violet',
                          },
                          {
                            label: 'Uppföljda förfallna beslut',
                            value: snap.statistics.followed,
                            total: snap.statistics.due,
                            note: 'Beslut med passerat uppföljningsdatum',
                            icon: CircleCheck,
                            tone: 'mint',
                          },
                          {
                            label: 'Kända källursprung',
                            value: snap.statistics.originGroups,
                            total: null,
                            note: `${snap.statistics.sources} källor · ${snap.statistics.unknownOrigins} med okänt ursprung`,
                            icon: BookOpen,
                            tone: 'sand',
                          },
                        ].map(
                          ({ label, value, total, note, icon: Icon, tone }) => (
                            <article className="metric" key={label}>
                              <div className="metric-heading">
                                <span>{label}</span>
                                <span className={'metric-icon ' + tone}>
                                  <Icon size={18} />
                                </span>
                              </div>
                              <strong>
                                {value}
                                {total !== null && <span> / {total}</span>}
                              </strong>
                              <small>{note}</small>
                            </article>
                          ),
                        )}
                      </div>
                      <div className="section-bar">
                        <h2>
                          Dina ärenden{' '}
                          <span className="section-count">
                            {
                              cases.filter(
                                (e) => caseId === 'all' || caseId === e.id,
                              ).length
                            }
                          </span>
                        </h2>
                        <span className="section-hint">
                          Öppna ett ärende för att läsa vidare
                        </span>
                      </div>
                      {cases.length === 0 ? (
                        <div className="empty">
                          <span className="empty-icon">
                            <FolderOpen size={24} />
                          </span>
                          <h3>Vilken fråga ska ni undersöka?</h3>
                          <p>
                            Ett ärende avgränsar fråga, sammanhang, tid och
                            berörda grupper.
                          </p>
                        </div>
                      ) : (
                        <div className="case-grid">
                          {cases
                            .filter((e) => caseId === 'all' || caseId === e.id)
                            .map((e) => (
                              <button
                                key={e.id}
                                className="case-card"
                                onClick={() => {
                                  setCase(e.id);
                                  openDocument(e);
                                }}
                              >
                                <div className="case-card-top">
                                  <span className="case-symbol">
                                    <FolderOpen size={19} />
                                  </span>
                                  <span className="case-domain">
                                    {String(e.data.domain)}
                                  </span>
                                  <ArrowUpRight size={17} />
                                </div>
                                <h3>{String(e.data.title)}</h3>
                                <p>{String(e.data.question)}</p>
                                <div className="card-foot">
                                  <span>
                                    <FileText size={14} />
                                    {
                                      current.filter((x) => x.caseId === e.id)
                                        .length
                                    }{' '}
                                    kopplade poster
                                  </span>
                                  <span className="case-open">
                                    Öppna <ArrowRight size={14} />
                                  </span>
                                </div>
                              </button>
                            ))}
                        </div>
                      )}
                      <div className="journey-actions">
                        {[
                          { k: 'source', icon: BookOpen },
                          { k: 'frame', icon: Compass },
                          { k: 'actor', icon: Users },
                          { k: 'option', icon: GitBranch },
                          { k: 'outcome', icon: CircleCheck },
                        ].map(({ k, icon: Icon }) => (
                          <Button
                            key={k}
                            variant="outline"
                            onClick={() => {
                              navigate(kinds[k].layer);
                              if (canKind(k)) newEntry(k);
                            }}
                          >
                            <Icon size={16} />
                            <span>{kinds[k].plural}</span>
                            {canKind(k) ? (
                              <Plus size={14} />
                            ) : (
                              <ArrowRight size={14} />
                            )}
                          </Button>
                        ))}
                      </div>
                      <div className="two-columns overview-panels">
                        <section className="panel">
                          <div className="panel-heading">
                            <h2>Behöver uppmärksamhet</h2>
                            <span className="panel-icon attention">
                              <Eye size={17} />
                            </span>
                          </div>
                          <div className="findings">
                            {scopedFindings
                              .slice(0, allFindings ? undefined : 5)
                              .map((f, i) => (
                                <button
                                  key={i}
                                  onClick={() =>
                                    openDocument(byId.get(f.ids[0]) || null)
                                  }
                                >
                                  <span className="attention">●</span>
                                  <span>
                                    <strong>{f.title}</strong>
                                    <small>{f.detail}</small>
                                  </span>
                                  <ArrowRight size={15} />
                                </button>
                              ))}
                          </div>
                          {scopedFindings.length > 5 && (
                            <Button
                              variant="ghost"
                              className="show-findings"
                              onClick={() => setAllFindings(!allFindings)}
                            >
                              {allFindings
                                ? 'Visa färre'
                                : `Visa alla ${scopedFindings.length}`}{' '}
                              <ArrowRight size={14} />
                            </Button>
                          )}
                          {!scopedFindings.length && (
                            <div className="panel-empty">
                              <span className="quiet-check">
                                <CircleCheck size={22} />
                              </span>
                              <strong>Inga avvikelser hittade</strong>
                              <p>
                                Enligt de kontroller som körts
                                {caseId !== 'all' ? ' för det här ärendet' : ''}
                                .
                              </p>
                            </div>
                          )}
                        </section>
                        <section className="panel">
                          <div className="panel-heading">
                            <h2>Senaste händelser</h2>
                            <span className="panel-icon">
                              <Clock3 size={17} />
                            </span>
                          </div>
                          <div className="timeline">
                            {entries
                              .filter(
                                (e) =>
                                  caseId === 'all' ||
                                  !e.caseId ||
                                  e.caseId === caseId,
                              )
                              .slice(-8)
                              .reverse()
                              .map((e) => (
                                <button
                                  key={e.id}
                                  aria-label={String(e.data.title)}
                                  onClick={() => openDocument(e)}
                                >
                                  <span className="event-dot" />
                                  <span>
                                    <strong>{String(e.data.title)}</strong>
                                    <small>
                                      {kinds[e.kind].label} ·{' '}
                                      {date(e.createdAt)}
                                      {e.supersedes ? ' · revision' : ''}
                                    </small>
                                  </span>
                                </button>
                              ))}
                          </div>
                        </section>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="section-bar">
                        <Tabs value={kind} onValueChange={setKind}>
                          <TabsList>
                            {kindOptions.map(([k, v]) => (
                              <TabsTrigger key={k} value={k}>
                                {v.plural}
                                <span className="count">
                                  {visible.filter((e) => e.kind === k).length}
                                </span>
                              </TabsTrigger>
                            ))}
                          </TabsList>
                        </Tabs>
                        {kind !== 'policy' && canKind(kind) && (
                          <Button onClick={() => newEntry(kind)}>
                            <Plus />
                            {kinds[kind]?.label}
                          </Button>
                        )}
                      </div>
                      <div className="search-row">
                        <Search size={18} />
                        <Input
                          aria-label="Sök i poster"
                          placeholder="Sök i rubrik och innehåll…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      {kind === 'policy' && (
                        <p className="help">
                          Arbetsregler ändras genom regelförslag och
                          regelbeslut. Beslut behåller hänvisningen till sin
                          ursprungliga regelversion.
                        </p>
                      )}
                      {visible.filter((e) => e.kind === kind).length ? (
                        <div className="record-list">
                          {visible
                            .filter((e) => e.kind === kind)
                            .reverse()
                            .map((e) => (
                              <button
                                className="record-row"
                                key={e.id}
                                onClick={() => openDocument(e)}
                              >
                                <span className="record-number">
                                  {String(e.seq).padStart(3, '0')}
                                </span>
                                <span>
                                  <strong>{String(e.data.title)}</strong>
                                  <small>
                                    {e.caseId
                                      ? String(byId.get(e.caseId)?.data.title)
                                      : 'Gemensamt för arbetsytan'}{' '}
                                    · {date(e.createdAt)}
                                  </small>
                                </span>
                                <span className="record-tag">
                                  {String(
                                    e.data.verdict ||
                                      e.data.status ||
                                      kinds[e.kind].label,
                                  )}
                                </span>
                                <ArrowRight size={17} />
                              </button>
                            ))}
                        </div>
                      ) : (
                        <div className="empty">
                          <h3>
                            Inga {kinds[kind]?.plural.toLocaleLowerCase('sv')}{' '}
                            ännu
                          </h3>
                          <p>{dependencyHint(kind)}</p>
                        </div>
                      )}
                      {layer === 'decide' && (
                        <section className="panel comparison">
                          <h2>Jämför handlingsalternativ</h2>
                          <div className="table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>Alternativ</th>
                                  <th>Nytta</th>
                                  <th>Kostnader</th>
                                  <th>Återställbarhet</th>
                                  <th>Argument</th>
                                </tr>
                              </thead>
                              <tbody>
                                {visible
                                  .filter((e) => e.kind === 'option')
                                  .map((o) => (
                                    <tr key={o.id}>
                                      <td>
                                        <button
                                          className="text-button"
                                          onClick={() => openDocument(o)}
                                        >
                                          {String(o.data.title)}
                                        </button>
                                      </td>
                                      <td>{String(o.data.benefits)}</td>
                                      <td>{String(o.data.costs)}</td>
                                      <td>{String(o.data.reversibility)}</td>
                                      <td>
                                        {current
                                          .filter(
                                            (a) =>
                                              a.kind === 'argument' &&
                                              a.data.optionId === o.id,
                                          )
                                          .map((a) => (
                                            <button
                                              key={a.id}
                                              className="reference"
                                              onClick={() => openDocument(a)}
                                            >
                                              {String(a.data.position)}:{' '}
                                              {String(a.data.title)}
                                            </button>
                                          ))}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {layer === 'frames' &&
                        current.some((e) => e.kind === 'mapping') && (
                          <section className="panel">
                            <h2>Betydelsernas samband</h2>
                            {visible
                              .filter((e) => e.kind === 'mapping')
                              .map((e) => (
                                <button
                                  key={e.id}
                                  className="mapping-row"
                                  onClick={() => openDocument(e)}
                                >
                                  <span>
                                    {String(
                                      byId.get(String(e.data.fromId))?.data
                                        .title,
                                    )}
                                  </span>
                                  <span className="relation-label">
                                    {String(e.data.relation)} →
                                  </span>
                                  <span>
                                    {String(
                                      byId.get(String(e.data.toId))?.data.title,
                                    )}
                                  </span>
                                </button>
                              ))}
                          </section>
                        )}
                      {layer === 'outcomes' && (
                        <section className="panel">
                          <h2>Mål och utfall</h2>
                          {visible
                            .filter((e) => e.kind === 'outcome')
                            .map((o) => {
                              const d = byId.get(String(o.data.decisionId));
                              return d ? (
                                <div className="outcome-row" key={o.id}>
                                  <button
                                    className="text-button"
                                    onClick={() => openDocument(o)}
                                  >
                                    {String(o.data.title)}
                                  </button>
                                  <strong>
                                    {String(o.data.value)} {String(o.data.unit)}
                                  </strong>
                                  <span
                                    className={
                                      meetsTarget(o, d) ? 'good' : 'attention'
                                    }
                                  >
                                    {meetsTarget(o, d)
                                      ? 'Målvillkoret uppnått'
                                      : 'Målet är inte uppnått'}
                                  </span>
                                  <small>
                                    Mål: {String(d.data.operator)}{' '}
                                    {String(d.data.target)}{' '}
                                    {String(d.data.unit)}
                                  </small>
                                </div>
                              ) : null;
                            })}
                          <p className="help">
                            Ett uppnått målvillkor visar mätvärdets relation
                            till målet. Det fastställer inte vad som orsakade
                            utfallet.
                          </p>
                        </section>
                      )}
                      {layer === 'coordinate' && (
                        <>
                          <section className="panel">
                            <div className="section-bar">
                              <h2>Överföring mellan noder</h2>
                              <div className="button-row">
                                <Button
                                  variant="outline"
                                  onClick={exportBundle}
                                  disabled={busy}
                                >
                                  <Download />
                                  Signerad export
                                </Button>
                                <Button variant="outline" onClick={csv}>
                                  <Download />
                                  Register CSV
                                </Button>
                                <label className="file-button">
                                  <Upload size={16} />
                                  Importera gren
                                  <input
                                    type="file"
                                    accept=".json,application/json"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file)
                                        void run(async () => {
                                          if (file.size > 2_000_000)
                                            throw Error(
                                              'Filen får vara högst 2 MB.',
                                            );
                                          const d = await request('import', {
                                            envelope: await file.text(),
                                          });
                                          await refreshSpaces(d.id);
                                          setNotice(
                                            'Signaturen och postkedjan har verifierats. Grenen är skrivskyddad.',
                                          );
                                        });
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                            <p>
                              Exporten bevarar hela posthistoriken och signeras
                              av noden. Import skapar en separat skrivskyddad
                              gren. Bilagor och behörigheter överförs inte.
                            </p>
                            {snap.imports.map((i, n) => (
                              <div className="fingerprint" key={n}>
                                <span>Importerad {date(i.received_at)}</span>
                                <code>{i.fingerprint}</code>
                                <span>
                                  {snap.trust.find(
                                    (t) => t.fingerprint === i.fingerprint,
                                  )?.status === 'recognized'
                                    ? 'Lokalt igenkänd nyckel'
                                    : snap.trust.find(
                                          (t) =>
                                            t.fingerprint === i.fingerprint,
                                        )?.status === 'revoked'
                                      ? 'Lokalt återkallad nyckel'
                                      : 'Okänd nyckel — identiteten är inte bekräftad'}
                                </span>
                              </div>
                            ))}
                            <p className="help">
                              En giltig signatur identifierar nyckeln som
                              signerade paketet. Den bevisar varken personernas
                              identitet eller innehållets riktighet.
                            </p>
                          </section>
                          <section className="panel">
                            <div className="section-bar">
                              <h2>Lokalt register över nodnycklar</h2>
                              {snap.space.role === 'owner' && (
                                <Button
                                  variant="outline"
                                  onClick={() => setTrustDialog(true)}
                                >
                                  Registrera / återkalla nyckel
                                </Button>
                              )}
                            </div>
                            {snap.trust.length ? (
                              snap.trust.map((t) => (
                                <div
                                  className="fingerprint"
                                  key={t.fingerprint}
                                >
                                  <strong>
                                    {t.label} · {t.domain}
                                  </strong>
                                  <code>{t.fingerprint}</code>
                                  <p>
                                    {t.status === 'recognized'
                                      ? 'Igenkänd'
                                      : 'Återkallad'}{' '}
                                    · {t.reason}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p>
                                Inga nycklar har erkänts lokalt. Jämför
                                fingeravtrycket med avsändaren innan en nyckel
                                registreras.
                              </p>
                            )}
                          </section>
                          <section className="panel">
                            <h2>Deltagande och behörighet</h2>
                            <p className="help">
                              Kontoroller styr åtkomst. Deltagarposter beskriver
                              uppdrag och intressen och ger ingen
                              inloggningsbehörighet. Andra konton behöver även
                              åtkomst till denna webbinstallation.
                            </p>
                            {snap.members.map((m) => (
                              <div className="member-row" key={m.principal}>
                                <span>
                                  {m.name}
                                  <small>{m.principal}</small>
                                </span>
                                <strong>
                                  {
                                    (
                                      {
                                        owner: 'Ägare',
                                        editor: 'Redaktör',
                                        reviewer: 'Granskare',
                                        viewer: 'Läsare',
                                      } as Record<string, string>
                                    )[m.role]
                                  }
                                </strong>
                                {snap.space.role === 'owner' &&
                                  m.role !== 'owner' && (
                                    <Button
                                      variant="outline"
                                      onClick={() =>
                                        run(async () => {
                                          await request('revoke', {
                                            space: sid,
                                            principal: m.principal,
                                          });
                                          await refresh();
                                        })
                                      }
                                    >
                                      Ta bort åtkomst
                                    </Button>
                                  )}
                              </div>
                            ))}
                            {snap.space.role === 'owner' &&
                              !snap.space.read_only && (
                                <div className="invite-form">
                                  <Picker
                                    value={inviteRole}
                                    change={setInviteRole}
                                    label="Inbjudans roll"
                                    options={[
                                      { id: 'reviewer', label: 'Granskare' },
                                      { id: 'editor', label: 'Redaktör' },
                                      { id: 'viewer', label: 'Läsare' },
                                    ]}
                                  />
                                  <Button
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() =>
                                      run(async () => {
                                        const d = await request('invite', {
                                          space: sid,
                                          role: inviteRole,
                                        });
                                        setInvite(d.token);
                                      })
                                    }
                                  >
                                    Skapa engångsinbjudan
                                  </Button>
                                  {invite && (
                                    <label htmlFor="invite-token">
                                      Inbjudningskod · giltig ett dygn
                                      <Input
                                        id="invite-token"
                                        value={invite}
                                        readOnly
                                        onFocus={(e) => e.target.select()}
                                      />
                                    </label>
                                  )}
                                </div>
                              )}
                          </section>
                          <section className="panel">
                            <h2>Bilagor</h2>
                            {snap.attachments.length ? (
                              snap.attachments.map((a) => (
                                <div className="attachment-row" key={a.id}>
                                  <a
                                    href={
                                      '/api/civos?space=' +
                                      sid +
                                      '&attachment=' +
                                      a.id
                                    }
                                  >
                                    {a.name}
                                  </a>
                                  <span>{Math.ceil(a.size / 1024)} kB</span>
                                  <code>{a.digest}</code>
                                </div>
                              ))
                            ) : (
                              <p>
                                Bilagor läggs till när en källa registreras.
                              </p>
                            )}
                          </section>
                        </>
                      )}
                    </>
                  )}
                  <footer className="workspace-foot">
                    <span>
                      {entries.length} poster ·{' '}
                      {snap.space.role === 'owner' ? 'Ägare' : snap.space.role}
                    </span>
                    <span>Historiken verifierad vid senaste inläsning</span>
                    <code title={snap.space.head}>
                      {snap.space.head.slice(0, 16)}…
                    </code>
                  </footer>
                </>
              )}
              <div className="guide-links">
                <a
                  href="/articles/civos-installationsguide.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Installationsguide och genomgång ↗
                </a>
                <a
                  href="/articles/civos-instruction-set.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Arkitektur och instruktioner ↗
                </a>
              </div>
              <section className="join-section">
                <label htmlFor="join-token">
                  Har du en inbjudningskod?
                  <Input
                    id="join-token"
                    value={joinToken}
                    onChange={(e) => setJoin(e.target.value)}
                    placeholder="Klistra in engångskoden"
                  />
                </label>
                <Button
                  variant="outline"
                  disabled={!joinToken || busy}
                  onClick={() =>
                    run(async () => {
                      const d = await request('join', { token: joinToken });
                      setJoin('');
                      await refreshSpaces(d.id);
                    })
                  }
                >
                  Anslut till arbetsyta
                </Button>
              </section>
            </>
          )}
        </main>
      </SidebarInset>
      <Dialog open={spaceDialog} onOpenChange={setSpaceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ny arbetsyta</DialogTitle>
            <DialogDescription>
              Samla ett gemensamt arbete med egen historik och arbetsregel.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              void run(async () => {
                const result = await request('create', {
                  title: d.get('title'),
                  purpose: d.get('purpose'),
                });
                setSpaceDialog(false);
                navigate('overview');
                await refreshSpaces(result.id);
              });
            }}
          >
            <label htmlFor="space-title">
              Namn
              <Input id="space-title" name="title" required maxLength={150} />
            </label>
            <label htmlFor="space-purpose">
              Syfte
              <Textarea
                id="space-purpose"
                name="purpose"
                required
                maxLength={3000}
              />
            </label>
            <Button className="form-save" disabled={busy}>
              Skapa arbetsyta
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {editor && snap && (
        <EntryDialog
          editor={editor}
          snap={snap}
          caseId={caseId === 'all' ? cases[0]?.id : caseId}
          close={() => setEditor(null)}
          saved={async () => {
            setEditor(null);
            await refresh();
            setNotice('Posten har sparats i historiken.');
          }}
        />
      )}
      {detail && (
        <aside className="document-pane" aria-label="Öppet dokument">
          <div className="document-toolbar">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Föregående dokument"
              disabled={!documentHistory.length}
              onClick={previousDocument}
            >
              <ArrowLeft size={16} />
            </Button>
            <span>
              <FileText size={13} />
              {kinds[detail.kind].label}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('graph')}
              aria-label="Visa dokumentets samband"
            >
              <Network size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Stäng dokument"
              onClick={() => openDocument(null)}
            >
              <X size={16} />
            </Button>
          </div>
          <div className="document-content">
            <div className="document-breadcrumb">
              {detail.caseId
                ? String(byId.get(detail.caseId)?.data.title)
                : snap?.space.title}{' '}
              / {kinds[detail.kind].label}
            </div>
            <h2 id="document-title" tabIndex={-1}>
              {String(detail.data.title)}
            </h2>
            <div className="document-state">
              <span>
                {entries.some((e) => e.supersedes === detail.id)
                  ? 'Äldre version'
                  : 'Aktuell version'}
              </span>
              <span>#{String(detail.seq).padStart(3, '0')}</span>
            </div>
            <p className="document-meta">
              {date(detail.createdAt)} · {detail.actorName}
            </p>
            {detail && (
              <>
                <dl className="detail-fields">
                  {kinds[detail.kind].fields
                    .filter(
                      (f) =>
                        f.key !== 'title' &&
                        detail.data[f.key] !== undefined &&
                        detail.data[f.key] !== '',
                    )
                    .map((f) => (
                      <div key={f.key}>
                        <dt>{f.label}</dt>
                        <dd>
                          {f.type === 'ref' || f.type === 'refs' ? (
                            (Array.isArray(detail.data[f.key])
                              ? (detail.data[f.key] as string[])
                              : [String(detail.data[f.key])]
                            ).map((id) => (
                              <button
                                className="reference"
                                key={id}
                                onClick={() =>
                                  openDocument(byId.get(id) || null)
                                }
                              >
                                {String(byId.get(id)?.data.title || id)}
                              </button>
                            ))
                          ) : f.type === 'date' ? (
                            date(String(detail.data[f.key]))
                          ) : Array.isArray(detail.data[f.key]) ? (
                            (detail.data[f.key] as string[]).join(', ')
                          ) : f.key === 'uri' &&
                            /^https?:/.test(String(detail.data[f.key])) ? (
                            <a
                              href={String(detail.data[f.key])}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {String(detail.data[f.key])}
                            </a>
                          ) : (
                            String(detail.data[f.key])
                          )}
                        </dd>
                      </div>
                    ))}
                </dl>
                {detail.kind === 'source' && detail.data.artifactId && (
                  <a
                    href={
                      '/api/civos?space=' +
                      sid +
                      '&attachment=' +
                      detail.data.artifactId
                    }
                  >
                    Ladda ner bilaga
                  </a>
                )}
                <div className="detail-history">
                  <h3>
                    <History size={17} /> Bakåtlänkar och historik
                  </h3>
                  <p>
                    Registrerande konto: <code>{detail.actor}</code>
                  </p>
                  {detail.supersedes && (
                    <button
                      className="reference"
                      onClick={() =>
                        openDocument(byId.get(detail.supersedes!) || null)
                      }
                    >
                      Visa föregående version
                    </button>
                  )}
                  {entries
                    .filter((e) => e.supersedes === detail.id)
                    .map((e) => (
                      <button
                        key={e.id}
                        className="reference"
                        onClick={() => openDocument(e)}
                      >
                        Visa nyare version · {date(e.createdAt)}
                      </button>
                    ))}
                  <p>Poster som hänvisar hit:</p>
                  {current
                    .filter((e) => references(e).includes(detail.id))
                    .map((e) => (
                      <button
                        key={e.id}
                        className="reference"
                        onClick={() => openDocument(e)}
                      >
                        {kinds[e.kind].label}: {String(e.data.title)}
                      </button>
                    ))}
                  <code className="hash">{detail.hash}</code>
                </div>
                {!['case', 'policy', 'rule_resolution'].includes(detail.kind) &&
                  canKind(detail.kind) &&
                  !entries.some((e) => e.supersedes === detail.id) && (
                    <Button
                      onClick={() => {
                        setEditor({ kind: detail.kind, entry: detail });
                        openDocument(null);
                      }}
                    >
                      Skriv en ny version
                    </Button>
                  )}
              </>
            )}
          </div>
        </aside>
      )}
      <Dialog open={trustDialog} onOpenChange={setTrustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nodnyckel</DialogTitle>
            <DialogDescription>
              Registreringen är arbetsytans lokala bedömning av en nyckel.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              void run(async () => {
                await request('trust', { space: sid, ...values });
                setTrustDialog(false);
                await refresh();
              });
            }}
          >
            <label htmlFor="trust-fingerprint">
              SHA-256-fingeravtryck
              <Input
                id="trust-fingerprint"
                name="fingerprint"
                required
                pattern="[a-f0-9]{64}"
              />
            </label>
            <label htmlFor="trust-label">
              Avsändarens namn
              <Input id="trust-label" name="label" required />
            </label>
            <label htmlFor="trust-domain">
              Sakområde
              <Input id="trust-domain" name="domain" required />
            </label>
            <label htmlFor="trust-reason">
              Skäl och kontrollmetod
              <Textarea id="trust-reason" name="reason" required />
            </label>
            <label>
              Status
              <select name="status">
                <option value="recognized">Igenkänd</option>
                <option value="revoked">Återkallad</option>
              </select>
            </label>
            <Button className="form-save" disabled={busy}>
              Spara bedömning
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
