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
  type Data,
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
import { CaseWorkbench } from '@/components/civos/case-workbench';
import { ModelWorkbench } from '@/components/civos/model-workbench';
import { QuickSwitcher } from '@/components/civos/quick-switcher';
import type { Space } from '@/lib/store';
import { fieldDisplay, recordStatus, recordSearch } from '@/lib/presentation';
const layers = [
  { id: 'models', name: 'Models', icon: Activity },
  { id: 'overview', name: 'Workbench', icon: Workflow },
  { id: 'graph', name: 'Reference graph', icon: Network },
  { id: 'observe', name: 'Observations', icon: Eye },
  { id: 'frames', name: 'Perspectives', icon: Network },
  { id: 'trust', name: 'Review', icon: ShieldCheck },
  { id: 'decide', name: 'Decisions & actions', icon: Scale },
  { id: 'outcomes', name: 'Follow-up', icon: Activity },
  { id: 'coordinate', name: 'Coordination', icon: Settings2 },
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
    [layer, setLayer] = useState('models'),
    [caseId, setCase] = useState('all'),
    [kind, setKind] = useState('source'),
    [search, setSearch] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [auth, setAuth] = useState(false),
    [loaded, setLoaded] = useState(false),
    [sidebarOpen, setSidebarOpen] = useState(false),
    [navigationStep, setNavigationStep] = useState(0),
    [editor, setEditor] = useState<{
      kind: string;
      entry?: Entry;
      initial?: Data;
    } | null>(null),
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
      setError(e instanceof Error ? e.message : 'The action failed.');
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
      (!search || recordSearch(e).includes(search.toLocaleLowerCase('en'))),
  );
  const kindOptions = Object.entries(kinds).filter(
      ([, v]) => v.layer === layer,
    ),
    title = layers.find((l) => l.id === layer)!.name;
  const navigate = (id: string) => {
    setNavigationStep((step) => step + 1);
    if (layer === 'overview' && caseId === 'all' && cases[0])
      setCase(cases[0].id);
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
      setError('Choose a case above before adding a record.');
      return;
    }
    setEditor({ kind: k });
  };
  const exportBundle = () =>
    run(async () => {
      const r = await fetch('/api/civos?space=' + sid + '&export=1');
      if (!r.ok) throw Error(((await r.json()) as { error: string }).error);
      saveFile(await r.blob(), 'civos-export.json');
      setNotice('Signed export saved. Download attachments separately.');
    });
  const csv = () => {
    const rows = [
      [
        'sequence',
        'id',
        'type',
        'case',
        'title',
        'recording account',
        'timestamp',
        'supersedes',
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
      'civos-records.csv',
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
      <Sidebar className="civos-sidebar">
        <SidebarHeader>
          <span className="sidebar-title">Documents & views</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>VIEWS</SidebarGroupLabel>
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
              DOCUMENTS <span>{current.length}</span>
            </SidebarGroupLabel>
            {cases.map((c) => (
              <details key={c.id} open={caseId === c.id || cases.length === 1}>
                <summary>
                  <FolderOpen size={14} />
                  <span>{String(c.data.title)}</span>
                  <button
                    aria-label={'Open case ' + c.data.title}
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
              <p>Cases and documents appear here as you work.</p>
            )}
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <span className="author-credit">CivOS / Kris Ledel</span>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="workspace-top">
          <SidebarTrigger aria-label="Toggle document panel" />
          <button
            className="wordmark"
            onClick={() => navigate('overview')}
            aria-label="CivOS workbench"
          >
            Civ<span>OS</span>
            <i />
          </button>
          <div className="header-workspace">
            {spaces.length > 0 && (
              <Picker
                value={sid}
                change={setSid}
                options={spaces.map((space) => ({
                  id: space.id,
                  label: space.title,
                }))}
                label="Choose workspace"
              />
            )}
          </div>
          <QuickSwitcher
            entries={current}
            onOpen={openDocument}
            onGraph={() => navigate('graph')}
          />
          <Button
            variant="ghost"
            onClick={() => setSpaceDialog(true)}
            disabled={auth || busy}
            aria-label="Create workspace"
            title="Create workspace"
          >
            <Plus size={17} />
          </Button>
          {snap && (
            <Button
              variant="ghost"
              onClick={() => run(refresh)}
              disabled={busy}
              aria-label="Refresh workspace"
              title="Refresh workspace"
            >
              <RefreshCw size={16} />
            </Button>
          )}
        </header>
        <nav className="view-navigation" aria-label="Workspace views">
          {layers.map((view) => (
            <button
              key={view.id}
              onClick={() => navigate(view.id)}
              aria-current={layer === view.id ? 'page' : undefined}
            >
              {view.name}
            </button>
          ))}
        </nav>
        <main className="workspace-main">
          {layer !== 'overview' && layer !== 'models' && (
            <div className="section-title">
              <div>
                <span className="small-label">
                  {snap?.space.title || 'CivOS'} / {title}
                </span>
                <h1>{title}</h1>
                <p>
                  {snap?.space.purpose ||
                    'Gather evidence. Examine perspectives. Follow decisions.'}
                </p>
              </div>
            </div>
          )}
          {error && (
            <div role="alert" className="message error">
              <span>{error}</span>
              <Button variant="ghost" onClick={() => run(refresh)}>
                Reload
              </Button>
            </div>
          )}
          {notice && <output className="message success">{notice}</output>}
          {auth ? (
            <section className="panel">
              <h2>Open your workspace</h2>
              <p>Sign in to read and save cases.</p>
              <button
                className="action-link"
                onClick={() => window.location.assign('/signin-with-chatgpt')}
              >
                Sign in <ArrowRight size={16} />
              </button>
            </section>
          ) : !loaded ? (
            <output>Loading workspaces…</output>
          ) : (
            <>
              {layer !== 'overview' && (
                <div className="workspace-controls">
                  {snap && (
                    <>
                      <Picker
                        value={caseId}
                        change={setCase}
                        options={[
                          { id: 'all', label: 'All cases' },
                          ...cases.map((e) => ({
                            id: e.id,
                            label: String(e.data.title),
                          })),
                        ]}
                        label="Case"
                      />
                      <Button
                        variant="outline"
                        onClick={() => run(refresh)}
                        disabled={busy}
                        aria-label="Refresh"
                      >
                        <RefreshCw size={16} />
                      </Button>
                    </>
                  )}
                </div>
              )}
              {!spaces.length ? (
                <section className="welcome-card">
                  <div className="welcome-icon">
                    <Layers3 />
                  </div>
                  <div>
                    <span className="small-label">YOUR FIRST WORKSPACE</span>
                    <h2>Create a workspace.</h2>
                    <p>
                      Define a question. Record evidence, examine claims and
                      track decisions through a versioned history.
                    </p>
                    <Button
                      className="primary-action"
                      onClick={() => setSpaceDialog(true)}
                    >
                      Create workspace <ArrowRight />
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const d = await request('model_example');
                          await refreshSpaces(d.id);
                          setLayer('models');
                        })
                      }
                    >
                      Open synthetic model example
                    </Button>
                  </div>
                </section>
              ) : !snap ? (
                <output>Loading saved history…</output>
              ) : (
                <>
                  {snap.space.read_only === 1 && (
                    <div className="message">
                      <GitBranch size={20} />
                      <span>
                        Imported branch. Its signature and history are verified;
                        its claims still need review.
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
                        Create local continuation
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
                  ) : layer === 'models' ? (
                    <ModelWorkbench
                      key={sid + ':' + caseId}
                      snapshot={snap}
                      caseId={caseId}
                      canCreate={canKind}
                      onOpen={openDocument}
                      onCreate={(kind, initial, chosenCase) => {
                        setCase(chosenCase);
                        setEditor({ kind, initial });
                      }}
                      onRefresh={refresh}
                      onExample={async () => {
                        const d = await request('model_example');
                        await refreshSpaces(d.id);
                        setLayer('models');
                      }}
                      onNavigate={navigate}
                    />
                  ) : layer === 'overview' ? (
                    <CaseWorkbench
                      key={sid + ':' + caseId}
                      snapshot={snap}
                      caseId={caseId}
                      selected={detail?.id}
                      canCreate={canKind}
                      onChoose={(id) => {
                        setCase(id);
                        openDocument(null);
                      }}
                      onCreate={(entryKind, chosenCase) => {
                        if (canKind(entryKind)) {
                          setCase(chosenCase);
                          setEditor({ kind: entryKind });
                        }
                      }}
                      onOpen={openDocument}
                      onNavigate={navigate}
                    />
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
                          aria-label="Search records"
                          placeholder="Search titles and content…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      {kind === 'policy' && (
                        <p className="help">
                          Working rules change through rule proposals and rule
                          decisions. Each decision keeps its reference to the
                          original rule version.
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
                                      : 'Shared across the workspace'}{' '}
                                    · {date(e.createdAt)}
                                  </small>
                                </span>
                                <span className="record-tag">
                                  {recordStatus(e)}
                                </span>
                                <ArrowRight size={17} />
                              </button>
                            ))}
                        </div>
                      ) : (
                        <div className="empty">
                          <h3>
                            No {kinds[kind]?.plural.toLocaleLowerCase('en')} yet
                          </h3>
                          <p>{dependencyHint(kind)}</p>
                        </div>
                      )}
                      {layer === 'decide' && (
                        <section className="panel comparison">
                          <h2>Compare options</h2>
                          <div className="table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>Option</th>
                                  <th>Benefits</th>
                                  <th>Costs</th>
                                  <th>Reversibility</th>
                                  <th>Arguments</th>
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
                                              {fieldDisplay(
                                                a.kind,
                                                'position',
                                                a.data.position,
                                              )}
                                              : {String(a.data.title)}
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
                            <h2>Concept relations</h2>
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
                                    {fieldDisplay(
                                      e.kind,
                                      'relation',
                                      e.data.relation,
                                    )}{' '}
                                    →
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
                          <h2>Targets and outcomes</h2>
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
                                      ? 'Target condition met'
                                      : 'Target not met'}
                                  </span>
                                  <small>
                                    Target:{' '}
                                    {fieldDisplay(
                                      d.kind,
                                      'operator',
                                      d.data.operator,
                                    )}{' '}
                                    {String(d.data.target)}{' '}
                                    {String(d.data.unit)}
                                  </small>
                                </div>
                              ) : null;
                            })}
                          <p className="help">
                            Meeting a target condition shows how the measurement
                            compares with the target. It does not establish what
                            caused the outcome.
                          </p>
                        </section>
                      )}
                      {layer === 'coordinate' && (
                        <>
                          <section className="panel">
                            <div className="section-bar">
                              <h2>Exchange between nodes</h2>
                              <div className="button-row">
                                <Button
                                  variant="outline"
                                  onClick={exportBundle}
                                  disabled={busy}
                                >
                                  <Download />
                                  Signed export
                                </Button>
                                <Button variant="outline" onClick={csv}>
                                  <Download />
                                  Records CSV
                                </Button>
                                <label className="file-button">
                                  <Upload size={16} />
                                  Import branch
                                  <input
                                    type="file"
                                    accept=".json,application/json"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file)
                                        void run(async () => {
                                          if (file.size > 2_000_000)
                                            throw Error(
                                              'The file must be no larger than 2 MB.',
                                            );
                                          const d = await request('import', {
                                            envelope: await file.text(),
                                          });
                                          await refreshSpaces(d.id);
                                          setNotice(
                                            'The signature and record chain are verified. The branch is read-only.',
                                          );
                                        });
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                            <p>
                              Exports preserve the complete record history and
                              are signed by the node. Imports create a separate
                              read-only branch. Attachments and access
                              permissions are not transferred.
                            </p>
                            {snap.imports.map((i, n) => (
                              <div className="fingerprint" key={n}>
                                <span>Imported {date(i.received_at)}</span>
                                <code>{i.fingerprint}</code>
                                <span>
                                  {snap.trust.find(
                                    (t) => t.fingerprint === i.fingerprint,
                                  )?.status === 'recognized'
                                    ? 'Locally recognized key'
                                    : snap.trust.find(
                                          (t) =>
                                            t.fingerprint === i.fingerprint,
                                        )?.status === 'revoked'
                                      ? 'Locally revoked key'
                                      : 'Unknown key — identity unconfirmed'}
                                </span>
                              </div>
                            ))}
                            <p className="help">
                              A valid signature identifies the key that signed
                              the bundle. It does not prove anyone’s identity or
                              the accuracy of the content.
                            </p>
                          </section>
                          <section className="panel">
                            <div className="section-bar">
                              <h2>Local node key registry</h2>
                              {snap.space.role === 'owner' && (
                                <Button
                                  variant="outline"
                                  onClick={() => setTrustDialog(true)}
                                >
                                  Register / revoke key
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
                                      ? 'Recognized'
                                      : 'Revoked'}{' '}
                                    · {t.reason}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p>
                                No keys have been recognized locally. Compare
                                the fingerprint with the sender before
                                registering a key.
                              </p>
                            )}
                          </section>
                          <section className="panel">
                            <h2>Members and access</h2>
                            <p className="help">
                              Account roles control access. Participant records
                              describe responsibilities and interests; they do
                              not grant sign-in access. Other accounts also need
                              access to this web installation.
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
                                        owner: 'Owner',
                                        editor: 'Editor',
                                        reviewer: 'Reviewer',
                                        viewer: 'Viewer',
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
                                      Remove access
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
                                    label="Invitation role"
                                    options={[
                                      { id: 'reviewer', label: 'Reviewer' },
                                      { id: 'editor', label: 'Editor' },
                                      { id: 'viewer', label: 'Viewer' },
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
                                    Create single-use invitation
                                  </Button>
                                  {invite && (
                                    <label htmlFor="invite-token">
                                      Invitation code · valid for 24 hours
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
                            <h2>Attachments</h2>
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
                              <p>Add attachments when registering a source.</p>
                            )}
                          </section>
                        </>
                      )}
                    </>
                  )}
                  <footer className="workspace-foot">
                    <span>
                      {entries.length} records ·{' '}
                      {snap.space.role === 'owner' ? 'Owner' : snap.space.role}
                    </span>
                    <span>History verified at last load</span>
                    <code title={snap.space.head}>
                      {snap.space.head.slice(0, 16)}…
                    </code>
                  </footer>
                </>
              )}
              <div className="guide-links">
                <a
                  href="/articles/civos-models.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Computational models and worked example ↗
                </a>
                <a
                  href="/articles/civos-installationsguide.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Installation guide and walkthrough ↗
                </a>
                <a
                  href="/articles/civos-instruction-set.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Architecture and instructions ↗
                </a>
              </div>
              <section className="join-section">
                <label htmlFor="join-token">
                  Have an invitation code?
                  <Input
                    id="join-token"
                    value={joinToken}
                    onChange={(e) => setJoin(e.target.value)}
                    placeholder="Paste the single-use code"
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
                  Join workspace
                </Button>
              </section>
            </>
          )}
        </main>
      </SidebarInset>
      <Dialog open={spaceDialog} onOpenChange={setSpaceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              Create a shared workspace with its own history and working rule.
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
              Name
              <Input id="space-title" name="title" required maxLength={150} />
            </label>
            <label htmlFor="space-purpose">
              Purpose
              <Textarea
                id="space-purpose"
                name="purpose"
                required
                maxLength={3000}
              />
            </label>
            <Button className="form-save" disabled={busy}>
              Create workspace
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
            setNotice('The record has been saved to the history.');
          }}
        />
      )}
      {detail && (
        <aside className="document-pane" aria-label="Open document">
          <div className="document-toolbar">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Previous document"
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
              aria-label="Show document references"
            >
              <Network size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close document"
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
                  ? 'Earlier version'
                  : 'Current version'}
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
                            fieldDisplay(detail.kind, f.key, detail.data[f.key])
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
                    Download attachment
                  </a>
                )}
                <div className="detail-history">
                  <h3>
                    <History size={17} /> Backlinks and history
                  </h3>
                  <p>
                    Recording account: <code>{detail.actor}</code>
                  </p>
                  {detail.supersedes && (
                    <button
                      className="reference"
                      onClick={() =>
                        openDocument(byId.get(detail.supersedes!) || null)
                      }
                    >
                      Show previous version
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
                        Show newer version · {date(e.createdAt)}
                      </button>
                    ))}
                  <p>Records that refer here:</p>
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
                {!['case', 'policy', 'rule_resolution', 'model_run'].includes(
                  detail.kind,
                ) &&
                  canKind(detail.kind) &&
                  !entries.some((e) => e.supersedes === detail.id) && (
                    <Button
                      onClick={() => {
                        setEditor({ kind: detail.kind, entry: detail });
                        openDocument(null);
                      }}
                    >
                      Write a new version
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
            <DialogTitle>Node key</DialogTitle>
            <DialogDescription>
              This entry records the workspace’s local assessment of a key.
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
              SHA-256 fingerprint
              <Input
                id="trust-fingerprint"
                name="fingerprint"
                required
                pattern="[a-f0-9]{64}"
              />
            </label>
            <label htmlFor="trust-label">
              Sender name
              <Input id="trust-label" name="label" required />
            </label>
            <label htmlFor="trust-domain">
              Domain
              <Input id="trust-domain" name="domain" required />
            </label>
            <label htmlFor="trust-reason">
              Rationale and verification method
              <Textarea id="trust-reason" name="reason" required />
            </label>
            <label>
              Status
              <select name="status">
                <option value="recognized">Recognized</option>
                <option value="revoked">Revoked</option>
              </select>
            </label>
            <Button className="form-save" disabled={busy}>
              Save assessment
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
