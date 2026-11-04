import type { Context } from '@deepseek-ai/cordis';
import type { Transfer } from '../contracts.js';
import { call } from './api.js';

type Picker = (options: { id: string; suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<FileSystemFileHandle>;

/** Choose the destination before creating a job; stream directly into the selected file. */
export async function exportToFile(ctx: Context, create: () => Promise<Transfer>, update: (job: Transfer) => void, suggestedName: string): Promise<{ job: Transfer; name: string } | undefined> {
  const picker = (window as Window & { showSaveFilePicker?: Picker }).showSaveFilePicker;
  if (!picker) throw new Error('当前环境不支持选择保存位置，请使用 DSH 桌面端或 Chrome / Edge 的本地或安全连接。');
  let file: FileSystemFileHandle;
  try { file = await picker.call(window, { id: 'dsh-alink-export', suggestedName, types: [{ description: 'Alink 会话包', accept: { 'application/zip': ['.zip'] } }] }); }
  catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; throw error; }
  const controller = new AbortController(), release = ctx.effect(() => () => controller.abort());
  const signal = controller.signal;
  try {
    let job = await create(); update(job);
    while (['queued', 'running'].includes(job.state)) {
      await new Promise(resolve => setTimeout(resolve, 400)); signal.throwIfAborted();
      job = await call<Transfer>('transfer', { id: job.id }, signal); update(job);
    }
    if (!job.downloadable) throw Object.assign(new Error('导出未完成'), { code: job.errorCode || job.items.find(item => item.errorCode)?.errorCode || 'CANCELED' });
    const response = await fetch('api/dsh-alink.export?id=' + encodeURIComponent(job.id), { credentials: 'same-origin', signal });
    if (!response.ok) {
      const result = await response.json(); throw Object.assign(new Error(result.error.message), { code: result.error.code });
    }
    if (!response.body) throw new Error('导出文件不可用，请重试。');
    signal.throwIfAborted();
    const writable = await file.createWritable();
    await response.body.pipeTo(writable, { signal });
    return { job, name: file.name };
  } finally { await release(); }
}
