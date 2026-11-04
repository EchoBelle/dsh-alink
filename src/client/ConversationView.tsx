import { useEffect, useRef, useState } from 'react';
import { call, friendlyError } from './api.js';

interface Message { role: string; content: Array<{ type: string; text?: string }> }
interface DialoguePage { inspectionId?: string; items: Message[]; total: number; offset: number }
// Keep bulk selection from starting a worker for every selected conversation at once.
const readers: Promise<unknown>[] = [Promise.resolve(), Promise.resolve()];
let nextReader = 0;
function read(endpoint: string, payload: unknown, signal: AbortSignal) {
  const slot = nextReader++ % readers.length;
  const result = readers[slot].then(() => { signal.throwIfAborted(); return call<DialoguePage>(endpoint, payload, signal); });
  readers[slot] = result.catch(() => {});
  return result;
}

export function ConversationView({ sourceId, previewId, title, revision }: { sourceId?: string; previewId?: string; title: string; revision: number }) {
  const [page, setPage] = useState<DialoguePage>(), [reading, setReading] = useState(true), [paging, setPaging] = useState(false);
  const [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const controller = useRef<AbortController>();
  useEffect(() => {
    const request = new AbortController(); controller.current = request;
    setPage(undefined); setError(''); setReading(true); setPaging(false);
    const timer = setTimeout(() => {
      read(previewId ? 'previewPage' : 'inspect', previewId ? { previewId } : { sourceId }, request.signal)
        .then(value => { if (!request.signal.aborted) setPage(value); })
        .catch(error => { if (!request.signal.aborted) setError(friendlyError(error)); })
        .finally(() => { if (!request.signal.aborted) setReading(false); });
    }, 120);
    return () => { clearTimeout(timer); request.abort(); };
  }, [sourceId, previewId, revision, retry]);
  async function more() {
    const request = controller.current;
    if (!page || !request || paging) return;
    setPaging(true); setError('');
    try {
      const value = await call<DialoguePage>(previewId ? 'previewPage' : 'inspectionPage', {
        ...(previewId ? { previewId } : { inspectionId: page.inspectionId }), offset: page.items.length,
      }, request.signal);
      if (!request.signal.aborted) setPage({ ...value, items: [...page.items, ...value.items] });
    } catch (error) { if (!request.signal.aborted) setError(friendlyError(error)); }
    finally { if (!request.signal.aborted) setPaging(false); }
  }
  return <details className="dsh-alink-inspect" open aria-label={'会话内容：' + title} aria-busy={reading || paging}>
    <summary className="dsh-alink-preview-actions"><svg className="dsh-alink-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2 4 4-4 4" /></svg><h3>{title}</h3>{page && <span>{page.total} 条对话</span>}</summary>
    {reading ? <div className="dsh-alink-reading" role="status" aria-label="正在加载对话"><span className="dsh-alink-spinner" aria-hidden="true" /><span>正在读取对话…</span><div className="dsh-alink-skeleton" aria-hidden="true"><i/><i/><i/></div></div> : <>
      {page && <div className="dsh-alink-messages" role="region" aria-label="对话历史">{page.items.length ? page.items.map((message, index) => <article key={index}><small>{message.role === 'user' ? '用户' : '助手'}</small>{message.content.map((block, i) => block.type === 'text' ? <pre key={i}>{block.text}</pre> : null)}</article>) : <p className="dsh-alink-empty">此会话暂无可展示的文字消息。</p>}</div>}
      {error ? <div className="dsh-alink-read-error" role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>重新读取</button></div> : page && page.items.length < page.total && <button disabled={paging} onClick={() => void more()}>{paging ? <><span className="dsh-alink-spinner" aria-hidden="true" />正在读取…</> : '加载更多对话'}</button>}
    </>}
  </details>;
}
