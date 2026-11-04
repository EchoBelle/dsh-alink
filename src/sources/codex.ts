import path from 'node:path';
import { readdir, stat, realpath } from 'node:fs/promises';
import { ArchiveBuilder } from '../archive.js';
import { readJsonl } from './jsonl.js';
import { tableColumns, withReadonlyDatabase, captureNativeRows } from './sqlite.js';
import { sourceKey, eligibility, binaryState, number, asRecord, type SourceLocator } from './types.js';
import { normalizeResponse } from './resources.js';
async function database(root: string) {
  const names = (await readdir(root)).filter(n => /^state_\d+\.sqlite$/.test(n)).sort((a, b) => Number(b.match(/\d+/)![0]) - Number(a.match(/\d+/)![0]));
  return names[0] ? path.join(root, names[0]) : undefined;
}
export async function discoverCodex(root: string): Promise<SourceLocator[]> {
  const file = await database(root); if (!file) return [];
  const canonical = await realpath(root);
  const rows = await withReadonlyDatabase(file, db => {
    const cols = tableColumns(db, 'threads');
    if (!cols.has('id') || !cols.has('rollout_path')) throw new Error('UNSUPPORTED_SOURCE');
    const selected = ['id', 'title', 'name', 'cwd', 'rollout_path', 'updated_at', 'archived', 'deleted_at', 'source', 'thread_source'].filter(k => cols.has(k));
    return db.prepare(`SELECT ${selected.map(k => '"' + k + '"').join(',')} FROM threads`).all().map(row => ({ row, proven: cols.has('archived') && binaryState(row.archived) !== undefined }));
  });
  const result: SourceLocator[] = [];
  for (const { row, proven } of rows) {
    if (['subagent', 'guardian_review'].includes(String(row.thread_source)) || String(row.source).startsWith('{')) continue;
    const file = await realpath(String(row.rollout_path)).catch(() => undefined);
    if (!file || !file.startsWith(canonical + path.sep) || !(await stat(file)).isFile()) continue;
    const nativeId = String(row.id);
    result.push({ sourceId: sourceKey('codex', root, nativeId), app: 'codex', nativeId, root, file,
      title: String(row.name || row.title || '未命名会话'), cwd: row.cwd ? String(row.cwd) : undefined, updatedAt: number(row.updated_at) === undefined ? undefined : number(row.updated_at)! * 1000,
      eligibility: file.split(path.sep).includes('archived_sessions') ? 'archived' : eligibility(row, proven) });
  }
  return result;
}
export async function captureCodex(source: SourceLocator, destination: string, signal?: AbortSignal) {
  const builder = await ArchiveBuilder.create(destination, 'codex', 'rollout-jsonl', { native_id: source.nativeId, title: source.title, ...(source.cwd ? { cwd: source.cwd } : {}) });
  builder.manifest.source.location = source.file;
  try {
    const snapshot = await builder.originalFile(source.file, undefined, signal);
    let index = 0;
    for await (const value of readJsonl(snapshot, { signal, lossless: true })) {
      const row = asRecord(value), ref = await builder.record(row, { file: path.basename(source.file), record_index: index++ });
      if (row.type === 'session_meta') {
        if (row.payload?.history_base) builder.issue('unresolved_history', 'Source references an external history base');
        await builder.event(ref, 'metadata', { native_type: 'session_meta', projection: 'auxiliary' });
      } else if (row.type === 'response_item' && row.payload && typeof row.payload === 'object') {
        await normalizeResponse(asRecord(row.payload), builder, ref, [source.root, ...(source.resourceRoots ?? [])], true, row.timestamp);
      } else {
        if (row.type === 'compacted' || row.type === 'compaction') builder.issue('unresolved_history', 'Source compaction has not been reconstructed');
        await builder.event(ref, row.type === 'compacted' ? 'compaction' : 'lifecycle', { native_type: String(row.type), projection: 'auxiliary' });
      }
    }
    const file = await database(source.root);
    if (file) await captureNativeRows(builder, file, [
      ['threads', 'id', source.nativeId], ['thread_dynamic_tools', 'thread_id', source.nativeId],
      ['thread_artifacts', 'thread_id', source.nativeId], ['thread_spawn_edges', 'parent_thread_id', source.nativeId],
    ], signal);
    await captureNativeRows(builder, path.join(source.root, 'thread_history_1.sqlite'), [
      ['thread_turns', 'thread_id', source.nativeId], ['thread_items', 'thread_id', source.nativeId],
    ], signal);
    builder.issue('multi_store_snapshot', 'Rollout and auxiliary indexes are read consistently but are not one atomic cross-store snapshot');
    builder.issue('resource_discovery_scope', 'Only recognized resource references within configured source roots are collected');
    return await builder.finish();
  } catch (error) { await builder.close(); throw error; }
}
