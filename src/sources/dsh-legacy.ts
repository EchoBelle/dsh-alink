import { createReadStream } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createZstdDecompress } from 'node:zlib';
import { ArchiveBuilder } from '../archive.js';
import { readJsonl, readJsonStream } from './jsonl.js';
import { normalizeBlocks } from './resources.js';
import { sourceKey, type SourceLocator, asRecord } from './types.js';
export async function* legacyRows(file: string, signal?: AbortSignal) {
  if (!file.endsWith('.zstd')) { yield* readJsonl(file, { signal, lossless: true }); return; }
  const input = createReadStream(file, { signal }), decoder = createZstdDecompress();
  input.on('error', error => decoder.destroy(error)); input.pipe(decoder);
  try { yield* readJsonStream(decoder, { signal, lossless: true }); }
  finally { input.destroy(); decoder.destroy(); }
}
export async function discoverLegacy(root: string): Promise<SourceLocator[]> {
  let archived: Set<string> | undefined;
  try {
    const state = JSON.parse(await readFile(path.join(root, 'storages/workspace.json'), 'utf8'));
    if (state.unit?.name === 'workspace' && state.unit.version === 2 && Array.isArray(state.global?.archivedSessionIds) && state.global.archivedSessionIds.every((id: unknown) => typeof id === 'string')) archived = new Set(state.global.archivedSessionIds);
  } catch { /* Missing registry never implies active. */ }
  const result: SourceLocator[] = [];
  for (const project of await readdir(path.join(root, 'sessions'), { withFileTypes: true }).catch(() => [])) {
    if (!project.isDirectory()) continue;
    for (const session of await readdir(path.join(root, 'sessions', project.name), { withFileTypes: true })) {
      if (!session.isDirectory()) continue;
      for (const name of ['session.jsonl', 'session.jsonl.zstd']) {
        const file = path.join(root, 'sessions', project.name, session.name, name);
        if (!await stat(file).catch(() => undefined)) continue;
        for await (const h of legacyRows(file)) {
          if (h.type === 'session' && h.version === 0 && typeof h.id === 'string') result.push({
            sourceId: sourceKey('dsh', root, h.id), app: 'dsh', nativeId: h.id, file, root, title: h.id,
            cwd: typeof h.cwd === 'string' ? h.cwd : undefined, eligibility: archived ? archived.has(h.id) ? 'archived' : 'active' : 'unknown',
          });
          break;
        }
        break;
      }
    }
  }
  return result;
}
export async function captureLegacy(source: SourceLocator, destination: string, signal?: AbortSignal) {
  const b = await ArchiveBuilder.create(destination, 'dsh', 'session-v0-jsonl', { native_id: source.nativeId, title: source.title, ...(source.cwd ? { cwd: source.cwd } : {}) });
  b.manifest.source.location = source.file;
  try {
    const snapshot = await b.originalFile(source.file, undefined, signal);
    // Compression is detected from the original name because object names are hashes.
    const read = source.file.endsWith('.zstd') ? async function* () {
      const input = createReadStream(snapshot), decoder = createZstdDecompress(); input.on('error', e => decoder.destroy(e)); input.pipe(decoder);
      try { yield* readJsonStream(decoder, { signal, lossless: true }); } finally { input.destroy(); decoder.destroy(); }
    } : () => readJsonl(snapshot, { signal, lossless: true });
    let index = 0;
    for await (const row of read()) {
      const ref = await b.record(row, { file: path.basename(source.file), record_index: index });
      if (index++ === 0) {
        if (row.type !== 'session' || row.version !== 0) throw new Error('Unsupported DSH source version');
        await b.event(ref, 'metadata', { projection: 'auxiliary' }); continue;
      }
      const data = asRecord(row.data ?? {}), roots = [source.root, ...(source.resourceRoots ?? [])];
      const attrs = { native_type: String(row.type), ...(typeof row.time === 'number' ? { timestamp: row.time } : {}) };
      if (row.surfaceOp && typeof row.surfaceOp === 'object' || String(row.type).startsWith('compaction/')) b.issue('unresolved_history', 'Legacy DSH surface replacement requires reconstruction');
      if (row.type === 'session/title') b.manifest.session.title = String(data.title ?? source.title);
      if (row.type === 'user/message' || row.type === 'assistant/message') await b.event(ref, 'message', { ...attrs, role: row.type === 'user/message' ? 'user' : 'assistant', content: await normalizeBlocks(row.type === 'user/message' ? data.content : data.message?.content, b, ref, roots) });
      else if (row.type === 'tool/call') await b.event(ref, 'tool_call', { ...attrs, role: 'assistant', content: [{ type: 'tool_call', call_id: String(data.callId ?? ''), name: String(data.name ?? ''), arguments: data.arguments ?? '' }] });
      else if (row.type === 'tool/result') await b.event(ref, 'tool_result', { ...attrs, role: 'tool', content: [{ type: 'tool_result', call_id: String(data.message?.source?.callId ?? ''), output: data.message?.content ?? null }] });
      else await b.event(ref, 'lifecycle', { ...attrs, projection: 'auxiliary' });
    }
    return await b.finish();
  } catch (error) { await b.close(); throw error; }
}
