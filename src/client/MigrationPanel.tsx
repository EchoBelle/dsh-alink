import { useEffect, useRef, useState } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { Operation, Preview, SourceApp, SourceSession } from '../contracts.js';
import { call, friendlyError } from './api.js';
import { openImportedSession } from './navigation.js';
interface SourceInfo { app: SourceApp; available: boolean; count: number; unknown?: boolean; error?: string }
interface Targets { workspaces: Array<{ id: string; path: string; title: string }>; presets: Array<{ id: string; name?: string; broken?: string }>; defaultPreset: string }
interface Message { role: string; content: Array<{ type: string; text?: string; resourceId?: string }> }
interface PreviewPage { preview?: Preview; items: Message[]; total: number; offset: number }
const names: Record<string, string> = { workbuddy: 'WorkBuddy', codex: 'Codex', raccoon: '小浣熊', cursor: 'Cursor', dsh: 'DSH' };
const states: Record<string, string> = { prepared: '排队中', writing: '迁入中', verifying: '核对中', completed: '迁移完成', failed: '迁移失败', canceled: '已取消', 'needs-attention': '需要核对' };
const labels: Record<string, string> = { native: '原生迁入', rendered: '历史说明', 'archive-only': '仅保留备份', missing: '资源缺失', blocked: '需要处理' };
const issueCopy: Record<string, string> = {
  tool_history: '工具参数与结果转成历史说明，不执行工具。', inactive_or_auxiliary: '隐藏、旧版本和辅助记录只保留在备份中。',
  unsupported_event: '来源私有内容或特殊角色只保留在备份中。', unsupported_block: '不支持的内容块只保留在备份中。',
  resource_discovery_scope: '只收集可识别且位于允许目录中的资源。', multi_store_snapshot: '日志与索引分别捕获，可能不属于完全相同的时刻。',
  native_cards: '来源应用的专用卡片保留在原始记录中。', cursor_dependency_closure: '共享资源与跨会话引用未被视为完整收集。',
  unresolved_history: '无法完整重建有效上下文，需要先处理来源历史。', artifact_context: '历史产物以明确标注的上下文附件关联。',
  reconstructed_history: 'DSH 的轮次与流式展示由原文重建，不代表来源中的原生执行事件。',
  reconstructed_stream: '来源未提供可复用的流式记录，DSH 展示结构由正文重建。',
};
export function MigrationPanel({ ctx }: { ctx: Context }) {
  const [sources, setSources] = useState<SourceInfo[]>([]), [targets, setTargets] = useState<Targets>({ workspaces: [], presets: [], defaultPreset: '' });
  const [app, setApp] = useState<SourceApp>('workbuddy'), [query, setQuery] = useState('');
  const [sessions, setSessions] = useState<SourceSession[]>([]), [cursor, setCursor] = useState<string>();
  const [selected, setSelected] = useState<SourceSession>(), [cwd, setCwd] = useState(''), [preset, setPreset] = useState('');
  const [preview, setPreview] = useState<Preview>(), [messages, setMessages] = useState<Message[]>([]), [total, setTotal] = useState(0);
  const [operations, setOperations] = useState<Operation[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0), [issueLimit, setIssueLimit] = useState(100), [reviewOnly, setReviewOnly] = useState(false);
  const [directory, setDirectory] = useState('');
  const requestId = useRef(''), action = useRef<AbortController | undefined>(undefined), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; action.current?.abort(); }; }, []);
  const invalidate = () => { action.current?.abort(); setBusy(false); setPreview(undefined); setMessages([]); requestId.current = ''; setReviewOnly(false); setError(''); };
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([call<SourceInfo[]>('sources', {}, controller.signal), call<Targets>('targets', {}, controller.signal), call<Operation[]>('operations', {}, controller.signal)])
      .then(([sourceList, targetList, jobs]) => { if (controller.signal.aborted) return; setSources(sourceList); setTargets(targetList); setOperations(jobs); setPreset(value => value || targetList.defaultPreset); })
      .catch(e => { if (!controller.signal.aborted) setError(friendlyError(e)); });
    return () => controller.abort();
  }, [ctx, revision]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    call<{ items: SourceSession[]; nextCursor?: string }>('sessions', { app, text: query, limit: 50 }, controller.signal)
      .then(page => { if (!controller.signal.aborted) { setSessions(page.items); setCursor(page.nextCursor); } })
      .catch(e => { if (!controller.signal.aborted) { setError(friendlyError(e)); setSessions([]); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ctx, app, query, revision]);
  const active = operations.some(o => ['prepared', 'writing', 'verifying'].includes(o.state));
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { if (!document.hidden) setOperations(await call<Operation[]>('operations', {}, controller.signal)); }
      catch (e) { if (!controller.signal.aborted) setError(friendlyError(e)); }
      if (!controller.signal.aborted) timer = setTimeout(poll, 500);
    };
    timer = setTimeout(poll, 500);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [ctx, active]);
  async function perform(work: (signal: AbortSignal) => Promise<void>) {
    action.current?.abort(); const controller = new AbortController(); action.current = controller; setBusy(true); setError('');
    try { await work(controller.signal); }
    catch (e) { if (!controller.signal.aborted && mounted.current) setError(friendlyError(e)); }
    finally { if (!controller.signal.aborted && mounted.current) setBusy(false); }
  }
  function choose(source: SourceSession) { invalidate(); setSelected(source); setCwd(source.cwd || ''); }
  async function prepare(signal: AbortSignal) {
    if (!selected) return;
    const value = await call<Preview>('preview', { sourceId: selected.sourceId, target: { cwd, agentPreset: preset } }, signal);
    const page = await call<PreviewPage>('previewPage', { previewId: value.previewId, offset: 0 }, signal);
    if (signal.aborted) return;
    setPreview(value); setMessages(page.items); setTotal(page.total); setReviewOnly(false); setIssueLimit(100); requestId.current = crypto.randomUUID();
  }
  async function commit(signal: AbortSignal) {
    if (!preview) return;
    const op = await call<Operation>('commit', { previewId: preview.previewId, reportHash: preview.report.reportHash, requestId: requestId.current || (requestId.current = crypto.randomUUID()) }, signal);
    setOperations(old => [op, ...old.filter(o => o.operationId !== op.operationId)]);
  }
  function reportDownload() {
    if (!preview) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(preview, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'dsh-alink-report.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function upload(file: File, signal: AbortSignal) {
    const format = file.name.endsWith('.zip') ? 'alink' : 'dsh';
    const response = await fetch(`api/dsh-alink.upload?format=${format}&filename=${encodeURIComponent(file.name)}`, { method: 'POST', credentials: 'same-origin', body: file, signal });
    const result = await response.json(); if (!result.ok) throw Object.assign(new Error(result.error.message), { code: result.error.code });
    choose(result.value); // choose does not start a migration; source status is checked again at preview and commit.
  }
  const differences = preview?.report.issues.filter(i => i.disposition !== 'native') ?? [];
  return <section className="dsh-alink">
    <header className="dsh-alink-header"><div><h1>会话迁移</h1><p>将已有对话带入 DSH，接着完成工作。</p></div><button onClick={() => { invalidate(); setRevision(v => v + 1); }}>刷新来源</button></header>
    <p className="dsh-alink-note">仅显示未归档且当前有效的会话</p>
    {error && <div className="dsh-alink-error" role="alert">{error}</div>}
    <div className="dsh-alink-columns">
      <aside className="dsh-alink-sources">
        <label>来源应用<select aria-label="来源应用" value={app} onChange={e => { invalidate(); setSelected(undefined); setApp(e.target.value as SourceApp); }}>
          {['workbuddy', 'codex', 'raccoon', 'cursor'].map(id => <option key={id} value={id}>{names[id]} · {sources.find(s => s.app === id)?.count ?? 0} 个有效会话</option>)}
        </select></label>
        <input aria-label="搜索来源会话" placeholder="搜索会话或项目" value={query} onChange={e => { invalidate(); setSelected(undefined); setQuery(e.target.value); }} />
        {sources.find(s => s.app === app)?.error && <p className="dsh-alink-note">来源暂时无法读取或存储格式尚未支持。</p>}
        {sources.find(s => s.app === app)?.unknown && <p className="dsh-alink-note">部分会话的归档状态无法核实，已排除。</p>}
        {loading ? <p role="status">正在读取会话列表…</p> : !sessions.length ? <p className="dsh-alink-empty">没有可迁移的有效会话。</p> : <div className="dsh-alink-session-list">
          {sessions.map(s => <button key={s.sourceId} aria-label={'打开预览：' + s.title} className={selected?.sourceId === s.sourceId ? 'selected' : ''} onClick={() => choose(s)}><strong>{s.title}</strong><small title={s.cwd}>{s.cwd || '未关联本机项目'}</small></button>)}
        </div>}
        {cursor && <button onClick={() => void perform(async signal => { const page = await call<{ items: SourceSession[]; nextCursor?: string }>('sessions', { app, text: query, cursor, limit: 50 }, signal); setSessions(old => [...old, ...page.items]); setCursor(page.nextCursor); })}>加载更多会话</button>}
        <details className="dsh-alink-import"><summary>从备份导入</summary><p>备份必须能关联到原应用中仍有效的会话。</p>
          <label className="dsh-alink-file">选择 ALink ZIP 或旧 DSH 日志<input aria-label="备份文件" type="file" accept=".zip,.jsonl,.zstd" onChange={e => { const file = e.target.files?.[0]; if (file) void perform(signal => upload(file, signal)); e.target.value = ''; }} /></label>
          <label>DSH 所在电脑上的备份目录<input aria-label="备份目录" value={directory} onChange={e => setDirectory(e.target.value)} placeholder="已有 .alink 目录的完整路径" /></label>
          <button disabled={!directory || busy} onClick={() => void perform(async signal => { choose(await call<SourceSession>('registerFile', { path: directory, format: 'alink' }, signal)); })}>读取备份目录</button>
        </details>
      </aside>
      <main className="dsh-alink-preview">
        {!selected && !preview ? <div className="dsh-alink-empty"><h2>选择一条会话</h2><p>先查看内容与迁移差异，再决定是否导入。</p><p>导入会新增独立会话，原应用的数据保持不变。</p></div> : <>
          {selected && <><h2>{selected.title}</h2><div className="dsh-alink-targets"><label>目标项目目录<input aria-label="目标项目目录" list="dsh-alink-workspaces" value={cwd} onChange={e => { invalidate(); setCwd(e.target.value); }} placeholder="选择或填写已存在的目录" /><datalist id="dsh-alink-workspaces">{targets.workspaces.map(w => <option key={w.id} value={w.path}>{w.title}</option>)}</datalist></label>
            <label>DSH 配置<select aria-label="DSH 配置" value={preset} onChange={e => { invalidate(); setPreset(e.target.value); }}>{targets.presets.map(p => <option key={p.id} value={p.id} disabled={!!p.broken}>{p.name || ({ standard: '标准模式', minimal: '精简模式', cordis: 'Cordis 模式', ptc: 'PTC 模式' } as Record<string, string>)[p.id] || p.id}{p.broken ? '（不可用）' : ''}</option>)}</select></label></div>
            <button className="primary" disabled={busy || !cwd || !preset} onClick={() => void perform(prepare)}>{busy && !preview ? '正在准备…' : '生成迁移预览'}</button></>}
          {preview && <><div className="dsh-alink-counts">{Object.entries(preview.report.counts).filter(([, n]) => n > 0).map(([key, count]) => <span key={key} className={key === 'blocked' ? 'blocked' : ''}>{labels[key]} <b>{count}</b> 项</span>)}</div>
            {differences.length > 0 && <details open className="dsh-alink-differences"><summary>迁移差异 · {differences.length} 项</summary><ul>{differences.slice(0, issueLimit).map((i, n) => <li key={n}><b>{labels[i.disposition]}</b> {issueCopy[i.code] || i.detail}</li>)}</ul>{differences.length > issueLimit && <button onClick={() => setIssueLimit(v => v + 100)}>显示更多差异</button>}</details>}
            <div className="dsh-alink-preview-actions"><span>{total} 条迁入后历史</span><button onClick={reportDownload}>保存报告</button></div>
            <div className="dsh-alink-messages">{messages.map((m, i) => <article key={i} className={m.role}><small>{m.role === 'user' ? '用户 / 历史上下文' : '助手 / 历史说明'}</small>{m.content.map((b, j) => b.type === 'text' ? <pre key={j}>{b.text}</pre> : <p key={j}>📎 历史附件</p>)}</article>)}</div>
            {messages.length < total && <button onClick={() => void perform(async signal => { const page = await call<PreviewPage>('previewPage', { previewId: preview.previewId, offset: messages.length }, signal); setMessages(old => [...old, ...page.items]); })}>查看更多历史</button>}
            {!reviewOnly && <div className="dsh-alink-submit"><p>原始记录与资源保留在备份中。工具历史不会被执行。</p><button className="primary" disabled={busy || preview.report.counts.blocked > 0 || active} onClick={() => void perform(commit)}>{preview.report.counts.blocked ? '请先处理来源历史' : differences.length ? '按上述差异导入' : '导入会话'}</button></div>}
          </>}
        </>}
      </main>
    </div>
    <section className="dsh-alink-operations" aria-label="迁移记录"><h2>迁移记录</h2>{!operations.length && <p className="dsh-alink-note">完成一次迁移后，可以在这里查看结果。</p>}
      {operations.map(op => <article key={op.operationId}><div><strong>{op.title}</strong><span role="status">{states[op.state]}</span>{op.errorCode && <small>{friendlyError({ code: op.errorCode })}</small>}</div><div className="dsh-alink-operation-actions">
        {op.state === 'completed' && <button onClick={() => void perform(() => openImportedSession(ctx, op.targetSessionId))}>打开会话</button>}
        {['failed', 'needs-attention', 'canceled'].includes(op.state) && <button disabled={busy} onClick={() => void perform(async signal => { const page = await call<PreviewPage>('previewPage', { previewId: op.previewId }, signal); if (!page.preview) return; const retry = await call<Operation>('commit', { previewId: op.previewId, reportHash: page.preview.report.reportHash, requestId: crypto.randomUUID() }, signal); setOperations(old => old.map(o => o.operationId === retry.operationId ? retry : o)); })}>重新核对并重试</button>}
        {['prepared', 'writing', 'verifying'].includes(op.state) && <button onClick={() => void perform(async signal => { await call('cancel', { operationId: op.operationId }, signal); })}>请求停止</button>}
        <button onClick={() => void perform(async signal => { const page = await call<PreviewPage>('previewPage', { previewId: op.previewId }, signal); setSelected(undefined); setPreview(page.preview); setMessages(page.items); setTotal(page.total); setReviewOnly(true); })}>查看报告</button>
        <a href={'api/dsh-alink.archive?operationId=' + encodeURIComponent(op.operationId)} download>保存备份</a>
      </div></article>)}
    </section>
  </section>;
}
