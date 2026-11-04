import { afterEach, expect, it, vi } from 'vitest';
import { Context } from '@deepseek-ai/cordis';
import { exportToFile } from '../../src/client/export-file.js';
import type { Transfer } from '../../src/contracts.js';
afterEach(() => vi.unstubAllGlobals());
const job: Transfer = { id: 'test', kind: 'export', state: 'completed', downloadable: true, createdAt: 0, items: [] };

it('chooses a destination before creating the export and streams into that file', async () => {
  const order: string[] = [], chunks: Uint8Array[] = [];
  const writable = new WritableStream<Uint8Array>({ write(chunk) { chunks.push(chunk); }, close() { order.push('saved'); } });
  vi.stubGlobal('window', { showSaveFilePicker: async () => { order.push('picker'); return { name: 'chosen.zip', createWritable: async () => { order.push('writer'); return writable; } }; } });
  vi.stubGlobal('fetch', async () => { order.push('fetch'); return new Response(new Uint8Array([80, 75, 1, 2])); });
  const result = await exportToFile(new Context(), async () => { order.push('export'); return job; }, () => {}, 'Alink.zip');
  expect(order).toEqual(['picker', 'export', 'fetch', 'writer', 'saved']);
  expect([...chunks[0]]).toEqual([80, 75, 1, 2]); expect(result?.name).toBe('chosen.zip');
});

it('does not start a job when the picker is canceled or unavailable', async () => {
  const create = vi.fn(async () => job);
  vi.stubGlobal('window', { showSaveFilePicker: async () => { throw new DOMException('canceled', 'AbortError'); } });
  expect(await exportToFile(new Context(), create, () => {}, 'Alink.zip')).toBeUndefined();
  expect(create).not.toHaveBeenCalled();
  vi.stubGlobal('window', {});
  await expect(exportToFile(new Context(), create, () => {}, 'Alink.zip')).rejects.toThrow('选择保存位置');
  expect(create).not.toHaveBeenCalled();
});

it('never opens the chosen file for writing when archive validation fails', async () => {
  const createWritable = vi.fn();
  vi.stubGlobal('window', { showSaveFilePicker: async () => ({ name: 'existing.zip', createWritable }) });
  vi.stubGlobal('fetch', async () => Response.json({ error: { code: 'SOURCE_INACTIVE', message: 'archived' } }, { status: 400 }));
  await expect(exportToFile(new Context(), async () => job, () => {}, 'Alink.zip')).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
  expect(createWritable).not.toHaveBeenCalled();
});

it('does not report success when writing the selected file fails', async () => {
  const closed = vi.fn();
  vi.stubGlobal('window', { showSaveFilePicker: async () => ({ name: 'full-disk.zip', createWritable: async () => new WritableStream({ write() { throw new Error('Disk full'); }, close: closed }) }) });
  vi.stubGlobal('fetch', async () => new Response(new Uint8Array([80, 75])));
  await expect(exportToFile(new Context(), async () => job, () => {}, 'Alink.zip')).rejects.toThrow('Disk full');
  expect(closed).not.toHaveBeenCalled();
});
