import { useCallback, useEffect, useRef, useState } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { Operation, Preview, SourceApp, SourceSession, Transfer } from '../contracts.js';
import { call, friendlyError } from './api.js';
import { openImportedSession } from './navigation.js';
interface SourceInfo { app: SourceApp; available: boolean; count: number; unknown?: boolean; error?: string }
interface Targets { workspaces: Array<{ id: string; path: string; title: string }>; presets: Array<{ id: string; name?: string; broken?: string }>; defaultPreset: string }
interface Message { role: string; content: Array<{ type: string; text?: string }> }
interface PreviewPage { preview?: Preview; items: Message[]; total: number; offset: number }
const names: Record<string, string> = { workbuddy: 'WorkBuddy', codex: 'Codex', raccoon: '小浣熊', cursor: 'Cursor', dsh: 'DSH' };
const states: Record<string, string> = { prepared: '排队中', writing: '迁入中', verifying: '核对中', completed: '迁移完成', failed: '迁移失败', canceled: '已取消', 'needs-attention': '需要核对' };
const running = (job: Transfer) => ['queued', 'running'].includes(job.state);
function Check({ label, checked, partial = false, disabled, change }: { label: string; checked: boolean; partial?: boolean; disabled?: boolean; change(): void }) {
  return <input type="checkbox" aria-label={label} checked={checked} disabled={disabled} ref={node => { if (node) node.indeterminate = partial && !checked; }} onClick={e => e.stopPropagation()} onChange={change} />;
}
export function MigrationPanel({ ctx }: { ctx: Context }) {
  const [tab, setTab] = useState<'sources' | 'records'>('sources');
  const [sources, setSources] = useState<SourceInfo[]>([]), [targets, setTargets] = useState<Targets>({ workspaces: [], presets: [], defaultPreset: '' });
  const [app, setApp] = useState<SourceApp>('workbuddy'), [query, setQuery] = useState('');
  const [sessions, setSessions] = useState<SourceSession[]>([]), [cursor, setCursor] = useState<string>();
  const [selection, setSelection] = useState<Map<string, SourceSession>>(new Map()), [focus, setFocus] = useState<SourceSession>();
  const [targetMode, setTargetMode] = useState('original'), [cwd, setCwd] = useState(''), [preset, setPreset] = useState('');
  const [preview, setPreview] = useState<Preview>(), [messages, setMessages] = useState<Message[]>([]), [total, setTotal] = useState(0), [previewTitle, setPreviewTitle] = useState('');
  const [operations, setOperations] = useState<Operation[]>([]), [transfers, setTransfers] = useState<Transfer[]>([]);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [revision, setRevision] = useState(0);
  const [localOpen, setLocalOpen] = useState(false), [directory, setDirectory] = useState('');
  const action = useRef<AbortController | undefined>(undefined), mounted = useRef(true);
  const synchronized = useRef(new Set<string>());
  const syncNative = useCallback(async (jobs: Operation[]) => {
    const completed = jobs.filter(op => op.state === 'completed').map(op => op.targetSessionId);
    if (completed.some(id => !synchronized.current.has(id))) {
      await ctx.sessions.refresh();
      await Promise.all(completed.filter(id => !synchronized.current.has(id)).map(id => ctx.sessions.refreshProjections(id as SessionId)));
      await ctx.sessions.refresh();
      for (const id of completed) synchronized.current.add(id);
    }
  }, [ctx]);
  const selected = [...selection.values()];
  const importBusy = transfers.some(job => job.kind === 'import' && running(job));
  const active = transfers.some(running) || operations.some(op => ['prepared', 'writing', 'verifying'].includes(op.state));
  const clearPreview = () => { setPreview(undefined); setMessages([]); setTotal(0); setPreviewTitle(''); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; action.current?.abort(); }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([call<SourceInfo[]>('sources', {}, controller.signal), call<Targets>('targets', {}, controller.signal), call<Operation[]>('operations', {}, controller.signal), call<Transfer[]>('transfers', {}, controller.signal)])
      .then(async ([sourceList, targetList, jobs, batches]) => { if (controller.signal.aborted) return; await syncNative(jobs); if (controller.signal.aborted) return; setSources(sourceList); setTargets(targetList); setOperations(jobs); setTransfers(batches); setPreset(value => value || targetList.defaultPreset); })
      .catch(e => { if (!controller.signal.aborted) setError(friendlyError(e)); });
    return () => controller.abort();
  }, [revision, syncNative]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    call<{ items: SourceSession[]; nextCursor?: string }>('sessions', { app, text: query, limit: 100 }, controller.signal)
      .then(page => { if (!controller.signal.aborted) { setSessions(page.items); setCursor(page.nextCursor); } })
      .catch(e => { if (!controller.signal.aborted) { setError(friendlyError(e)); setSessions([]); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [app, query, revision]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const [jobs, batches] = await Promise.all([call<Operation[]>('operations', {}, controller.signal), call<Transfer[]>('transfers', {}, controller.signal)]);
        await syncNative(jobs);
        if (!controller.signal.aborted) { setOperations(jobs); setTransfers(batches); }
      } catch (e) { if (!controller.signal.aborted) setError(friendlyError(e)); }
      if (!controller.signal.aborted) timer = setTimeout(poll, 500);
    };
    timer = setTimeout(poll, 300); return () => { controller.abort(); clearTimeout(timer); };
  }, [active, syncNative]);
  async function perform(work: (signal: AbortSignal) => Promise<void>) {
    if (busy) return;
    const controller = new AbortController(); action.current = controller; setBusy(true); setError(''); setNotice('');
    try { await work(controller.signal); }
    catch (e) { if (!controller.signal.aborted && mounted.current) setError(friendlyError(e)); }
    finally { if (mounted.current) setBusy(false); }
  }
  function toggle(items: SourceSession[], add: boolean) {
    const next = new Map(selection);
    for (const item of items) if (add) next.set(item.sourceId, item); else next.delete(item.sourceId);
    if (next.size > 100) { setError('每批最多选择 100 条会话，请分批处理。'); return; }
    setSelection(next);
    if (add && items[0]) { setFocus(items[0]); if (!cwd) setCwd(items[0].cwd || ''); }
    else if (focus && !next.has(focus.sourceId)) setFocus(next.values().next().value);
    clearPreview();
  }
  function choose(source: SourceSession) { toggle([source], true); setFocus(source); }
  async function inspect(signal: AbortSignal) {
    if (!focus) return;
    const target = { cwd: targetMode === 'single' ? cwd : focus.cwd || cwd, agentPreset: preset };
    if (!target.cwd) throw { code: 'INVALID_TARGET' };
    const value = await call<Preview>('preview', { sourceId: focus.sourceId, target }, signal);
    const page = await call<PreviewPage>('previewPage', { previewId: value.previewId }, signal);
    if (!signal.aborted) { setPreview(value); setMessages(page.items); setTotal(page.total); setPreviewTitle(focus.title); }
  }
  async function start(kind: 'import' | 'export', signal: AbortSignal) {
    const job = await call<Transfer>(kind === 'import' ? 'importMany' : 'exportMany', {
      requestId: crypto.randomUUID(), sourceIds: selected.map(s => s.sourceId), titles: Object.fromEntries(selected.map(s => [s.sourceId, (s.title || '未命名会话').slice(0, 300)])),
      ...(kind === 'import' ? { target: { agentPreset: preset, ...(targetMode === 'single' ? { cwd } : {}) } } : {}),
    }, signal);
    if (!signal.aborted) setTransfers(old => [job, ...old.filter(item => item.id !== job.id)]);
  }
  function registered(result: { sources: SourceSession[]; errors: string[] }) {
    toggle(result.sources, true); setLocalOpen(false); setTab('sources');
    setNotice(`已读取 ${result.sources.length} 条会话。${result.errors.length ? `${result.errors.length} 条来源已失效或归档，未加入。` : ''}`);
  }
  async function upload(files: File[], signal: AbortSignal) {
    const sources: SourceSession[] = [], errors: string[] = [];
    if (files.length > 100) throw new Error('一次最多读取 100 个文件。');
    for (const file of files) {
      const format = file.name.toLowerCase().endsWith('.zip') ? 'alink' : 'dsh';
      const response = await fetch(`api/dsh-alink.upload?multiple=1&format=${format}&filename=${encodeURIComponent(file.name)}`, { method: 'POST', credentials: 'same-origin', body: file, signal });
      const result = await response.json();
      if (!result.ok) { errors.push(result.error.code); continue; }
      sources.push(...result.value.sources); errors.push(...result.value.errors);
    }
    if (!sources.length) throw { code: errors[0] || 'INVALID_SOURCE' };
    registered({ sources, errors });
  }
  const projects = new Map<string, SourceSession[]>();
  for (const session of sessions) { const key = session.cwd || ''; const group = projects.get(key) || []; group.push(session); projects.set(key, group); }
  const shownTransfers = transfers.some(running) ? transfers.filter(running) : transfers.slice(0, 1);
  const lastExport = transfers.find(job => job.downloadable);
  if (lastExport && !shownTransfers.includes(lastExport)) shownTransfers.push(lastExport);
  const validTarget = targetMode === 'single' ? !!cwd : selected.every(item => !!item.cwd);
  return <section className="dsh-alink">
    <header className="dsh-alink-header"><h1>Alink</h1><nav aria-label="Alink 页面">
      <button className={tab === 'sources' ? 'current' : ''} onClick={() => setTab('sources')}>会话</button>
      <button className={tab === 'records' ? 'current' : ''} onClick={() => setTab('records')}>迁移记录</button>
    </nav><div className="dsh-alink-header-actions"><button onClick={() => setLocalOpen(value => !value)}>从本地导入</button><button disabled={busy} onClick={() => { clearPreview(); setRevision(value => value + 1); }}>刷新来源</button></div></header>
    {error && <div className="dsh-alink-error" role="alert">{error}</div>}
    {notice && <p className="dsh-alink-notice" role="status">{notice}</p>}
    {localOpen && <section className="dsh-alink-local" aria-label="本地导入"><label>选择导出包或旧 DSH 日志<input aria-label="备份文件" type="file" multiple accept=".zip,.jsonl,.zstd" disabled={busy} onChange={e => { const files = [...e.target.files || []]; if (files.length) void perform(signal => upload(files, signal)); e.target.value = ''; }} /></label>
      <label>本地备份目录<input aria-label="备份目录" value={directory} onChange={e => setDirectory(e.target.value)} placeholder="已有 .alink 目录的完整路径" /></label><button disabled={!directory || busy} onClick={() => void perform(async signal => registered(await call('registerFiles', { path: directory, format: 'alink' }, signal)))}>读取目录</button>
    </section>}
    {shownTransfers.map(job => <section className={'dsh-alink-transfer' + (job.state === 'completed' && !job.items.some(item => item.warning) ? ' is-complete' : '')} key={job.id} aria-label="任务进度"><div><strong>{job.kind === 'import' ? '导入' : '导出'}{running(job) ? '中' : job.state === 'completed' ? '完成' : job.state === 'partial' ? '部分完成' : job.state === 'canceled' ? '已停止' : '未完成'}</strong><span>{job.items.filter(item => item.state === 'completed').length} / {job.items.length} 条会话</span>
      {job.items.find(item => item.state === 'running')?.title && <small>{job.items.find(item => item.state === 'running')!.title}</small>}
      {job.errorCode && <small>{friendlyError({ code: job.errorCode })}</small>}
      {job.items.filter(item => item.warning).map(item => <small key={'warning-' + item.sourceId}>{item.title}：{item.warning}</small>)}
      {job.items.filter(item => item.state === 'failed').map(item => <small key={item.sourceId}>{item.title || '会话'}：{friendlyError({ code: item.errorCode })}</small>)}
    </div><div className="dsh-alink-task-actions">{running(job) && <button onClick={() => void perform(async () => { await call('cancelTransfer', { id: job.id }); })}>停止任务</button>}
      {!running(job) && job.state !== 'completed' && <button disabled={busy} onClick={() => void perform(async () => { const next = await call<Transfer>('retryTransfer', { id: job.id }); setTransfers(old => old.map(item => item.id === next.id ? next : item)); })}>重试未完成项</button>}
      {job.downloadable && <a href={'api/dsh-alink.export?id=' + encodeURIComponent(job.id)} download>下载导出包</a>}
      {job.kind === 'import' && !running(job) && <button onClick={() => setTab('records')}>查看迁移记录</button>}</div></section>)}
    {tab === 'sources' ? <div className="dsh-alink-columns">
      <aside className="dsh-alink-sources"><label>来源应用<select aria-label="来源应用" value={app} onChange={e => setApp(e.target.value as SourceApp)}>{['workbuddy', 'codex', 'raccoon', 'cursor'].map(id => <option key={id} value={id}>{names[id]} · {sources.find(s => s.app === id)?.count ?? 0} 个会话</option>)}</select></label>
        <input aria-label="搜索来源会话" placeholder="搜索会话或项目" value={query} onChange={e => setQuery(e.target.value)} />
        <div className="dsh-alink-list-tools"><label><Check label="全选当前列表" checked={!!sessions.length && sessions.every(item => selection.has(item.sourceId))} partial={sessions.some(item => selection.has(item.sourceId))} change={() => toggle(sessions, !sessions.every(item => selection.has(item.sourceId)))} />全选列表</label><span>{sessions.length} 条</span></div>
        {sources.find(s => s.app === app)?.error && <p className="dsh-alink-note">来源暂时无法读取。</p>}
        {loading ? <p role="status">正在读取…</p> : !sessions.length ? <p className="dsh-alink-empty">没有有效会话。</p> : <div className="dsh-alink-session-list">{[...projects].map(([project, items]) => <details key={project} className="dsh-alink-project" open>
          <summary title={project}><Check label={'选择项目：' + (project || '未关联项目')} checked={items.every(item => selection.has(item.sourceId))} partial={items.some(item => selection.has(item.sourceId))} change={() => toggle(items, !items.every(item => selection.has(item.sourceId)))} /><span>{project.split(/[\\/]/).filter(Boolean).at(-1) || '未关联项目'}</span><small>{items.length}</small></summary>
          {project && <p className="dsh-alink-project-path" title={project}>{project}</p>}
          <div className="dsh-alink-project-sessions">{items.map(item => <div className={'dsh-alink-session-row' + (focus?.sourceId === item.sourceId ? ' selected' : '')} key={item.sourceId}><Check label={'选择会话：' + item.title} checked={selection.has(item.sourceId)} change={() => toggle([item], !selection.has(item.sourceId))} /><button aria-label={'打开会话：' + item.title} onClick={() => choose(item)}>{item.title}</button></div>)}</div>
        </details>)}</div>}
        {cursor && <button onClick={() => void perform(async signal => { const page = await call<{ items: SourceSession[]; nextCursor?: string }>('sessions', { app, text: query, cursor, limit: 100 }, signal); setSessions(old => [...old, ...page.items]); setCursor(page.nextCursor); })}>加载更多</button>}
      </aside>
      <main className="dsh-alink-preview"><section className="dsh-alink-selection" aria-label="导入与导出"><div className="dsh-alink-selection-heading"><h2>{selected.length ? `已选择 ${selected.length} 条会话` : '选择会话'}</h2>{selected.length > 0 && <button onClick={() => { setSelection(new Map()); setFocus(undefined); clearPreview(); }}>清空选择</button>}</div>
        {!selected.length ? <p className="dsh-alink-note">勾选会话或整个项目，然后直接导入或导出。</p> : <><ul className="dsh-alink-picked">{selected.map(item => <li key={item.sourceId}><span>{item.title}</span><small>{names[item.app]}</small><button aria-label={'取消选择：' + item.title} onClick={() => toggle([item], false)}>×</button></li>)}</ul>
          <div className="dsh-alink-targets"><label>导入项目<select aria-label="导入项目" value={targetMode} onChange={e => { setTargetMode(e.target.value); clearPreview(); }}><option value="original">保留各会话的原项目</option><option value="single">统一到指定项目</option></select></label><label>DSH 配置<select aria-label="DSH 配置" value={preset} onChange={e => { setPreset(e.target.value); clearPreview(); }}>{targets.presets.map(item => <option key={item.id} value={item.id} disabled={!!item.broken}>{item.name || ({ standard: '标准模式', minimal: '精简模式' } as Record<string, string>)[item.id] || item.id}</option>)}</select></label></div>
          {targetMode === 'single' && <label className="dsh-alink-unified">目标项目目录<input aria-label="目标项目目录" value={cwd} list="dsh-alink-workspaces" onChange={e => { setCwd(e.target.value); clearPreview(); }} placeholder="选择或填写已有项目目录" /><datalist id="dsh-alink-workspaces">{targets.workspaces.map(item => <option key={item.id} value={item.path}>{item.title}</option>)}</datalist></label>}
          {!validTarget && <p className="dsh-alink-note">所选会话缺少原项目目录，请选择统一目标项目。</p>}
          <div className="dsh-alink-primary-actions"><button className="primary" disabled={busy || importBusy || !preset || !validTarget} onClick={() => void perform(signal => start('import', signal))}>导入所选（{selected.length}）</button><button disabled={busy} onClick={() => void perform(signal => start('export', signal))}>导出所选（{selected.length}）</button></div>
        </>}
      </section>
      {focus && <section className="dsh-alink-inspect"><div className="dsh-alink-preview-actions"><h3>{previewTitle || focus.title}</h3><button disabled={busy || !preset || !focus.sourceId} onClick={() => void perform(inspect)}>{busy ? '正在读取…' : '查看对话'}</button></div>
        {preview ? <><p className="dsh-alink-note">{total} 条对话消息</p><div className="dsh-alink-messages" role="region" aria-label="对话历史">{messages.map((message, index) => <article key={index}><small>{message.role === 'user' ? '用户' : '助手'}</small>{message.content.map((block, i) => block.type === 'text' ? <pre key={i}>{block.text}</pre> : null)}</article>)}</div>
          {messages.length < total && <button onClick={() => void perform(async signal => { const page = await call<PreviewPage>('previewPage', { previewId: preview.previewId, offset: messages.length }, signal); setMessages(old => [...old, ...page.items]); })}>加载更多对话</button>}</> : <p className="dsh-alink-note">可以直接导入，也可以先查看这条会话的对话内容。</p>}
      </section>}
      </main>
    </div> : <section className="dsh-alink-operations" aria-label="迁移记录"><h2>迁移记录</h2>{!operations.length && <p className="dsh-alink-empty">暂无迁移记录。</p>}{operations.map(op => <article key={op.operationId}><div><strong>{op.title}</strong><span role="status">{states[op.state]}{op.outdated ? ' · 旧版导入' : ''}</span>{op.errorCode && <small>{friendlyError({ code: op.errorCode })}</small>}</div><div className="dsh-alink-operation-actions">
      {op.state === 'completed' && <button onClick={() => void perform(() => openImportedSession(ctx, op.targetSessionId))}>打开会话</button>}
      {(op.outdated || ['failed', 'needs-attention', 'canceled'].includes(op.state)) && <button disabled={busy || active} onClick={() => void perform(async () => { const next = await call<Operation>('retryOperation', { operationId: op.operationId }); setOperations(old => [next, ...old.filter(item => item.operationId !== next.operationId)]); })}>{op.outdated ? '重新导入纯对话' : '重新核对并重试'}</button>}
      {['prepared', 'writing', 'verifying'].includes(op.state) && <button onClick={() => void perform(async () => { await call('cancel', { operationId: op.operationId }); })}>停止</button>}
      <button disabled={busy} onClick={() => void perform(async signal => { const page = await call<PreviewPage>('previewPage', { previewId: op.previewId }, signal); setTab('sources'); setFocus({ sourceId: '', nativeId: '', app, title: op.title }); setPreview(page.preview); setMessages(page.items); setTotal(page.total); setPreviewTitle(op.title); })}>查看对话</button>
      <button disabled={busy || active} title="删除此记录，保留已迁入的 DSH 会话" onClick={() => void perform(async () => { await call('removeOperation', { operationId: op.operationId }); setOperations(old => old.filter(item => item.operationId !== op.operationId)); })}>删除记录</button>
    </div></article>)}</section>}
  </section>;
}
