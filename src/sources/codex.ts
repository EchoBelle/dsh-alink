import path from 'node:path';
import { readdir, stat, realpath } from 'node:fs/promises';
import { ArchiveBuilder } from '../archive.js';
import { readJsonl, readJsonStream } from './jsonl.js';
import { createReadStream } from 'node:fs';
import { LinkError } from '../transport.js';
import { tableColumns, withReadonlyDatabase, captureNativeRows, portableRow } from './sqlite.js';
import { sourceKey, eligibility, binaryState, number, asRecord, type SourceLocator } from './types.js';
import { normalizeBlocks, normalizeResponse } from './resources.js';
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
    const visited = new Set<string>();
    const canonicalRoot = await realpath(source.root);
    const historyBase = async (base: Record<string, any>, current: string): Promise<string | undefined> => {
      if (typeof base.thread_id !== 'string' || !/^[a-f0-9-]{36}$/.test(base.thread_id) || !Number.isSafeInteger(base.end_byte_offset) || base.end_byte_offset < 1) throw new LinkError('SOURCE_HISTORY_MISSING');
      const candidates: string[] = [];
      for (const folder of ['sessions', 'archived_sessions']) {
        for (const entry of await readdir(path.join(source.root, folder), { recursive: true, withFileTypes: true }).catch(() => [])) {
          if (!entry.isFile() || !entry.name.endsWith(base.thread_id + '.jsonl')) continue;
          const file = await realpath(path.join(entry.parentPath, entry.name));
          if (file === current || visited.has(file) || !file.startsWith(canonicalRoot + path.sep) || (await stat(file)).size < base.end_byte_offset) continue;
          let header: any, count = 0;
          for await (const row of readJsonStream(createReadStream(file, { end: base.end_byte_offset - 1, signal }), { signal })) { header ??= row; count++; }
          if (header?.type !== 'session_meta' || header.payload?.id !== base.thread_id) continue;
          if (!header.payload.history_base && Number.isSafeInteger(base.end_ordinal_exclusive) && count !== base.end_ordinal_exclusive) continue;
          candidates.push(file);
        }
      }
      return candidates.length === 1 ? candidates[0] : undefined;
    };
    const appendIndex = async (base: Record<string, any>): Promise<void> => {
      const indexFile = path.join(source.root, 'thread_history_1.sqlite');
      let restored = 0;
      if (await stat(indexFile).catch(() => undefined)) await withReadonlyDatabase(indexFile, async db => {
        const columns = tableColumns(db, 'thread_items');
        if (!['thread_id', 'rollout_ordinal', 'item_type', 'item_json'].every(column => columns.has(column))) return;
        const updated = columns.has('updated_at_ordinal') ? 'AND COALESCE(updated_at_ordinal, rollout_ordinal) < ?' : '';
        const cutoff = base.end_ordinal_exclusive;
        if (!Number.isSafeInteger(cutoff) || cutoff < 1) throw new LinkError('SOURCE_HISTORY_MISSING');
        const rows = db.prepare(`SELECT * FROM thread_items WHERE thread_id=? AND rollout_ordinal < ? ${updated} AND item_type IN ('userMessage','agentMessage') ORDER BY rollout_ordinal, item_id`);
        rows.setReadBigInts(true);
        for (const row of rows.iterate(...(updated ? [base.thread_id, cutoff, cutoff] : [base.thread_id, cutoff]))) {
          signal?.throwIfAborted();
          const item = asRecord(JSON.parse(String(row.item_json))), role = row.item_type === 'userMessage' ? 'user' : 'assistant';
          const ref = await builder.record(portableRow(row), { table: 'thread_items', history_base: base.thread_id });
          await builder.event(ref, 'message', { role, native_type: String(row.item_type), native_id: String(row.item_id),
            content: await normalizeBlocks(role === 'user' ? item.content : item.text, builder, ref, [source.root, ...(source.resourceRoots ?? [])]),
            ...(number(row.created_at_ms) === undefined ? {} : { timestamp: number(row.created_at_ms) }) });
          restored++;
        }
      }, signal);
      builder.issue(restored ? 'history_index_recovery' : 'missing_dialogue_history', restored ? 'Inherited dialogue restored from the source history index' : 'An earlier source history segment is no longer available');
    };
    const append = async (file: string, prefixBytes?: number): Promise<void> => {
      if (visited.has(file) || visited.size >= 32) throw new LinkError('SOURCE_HISTORY_MISSING');
      visited.add(file);
      const snapshot = await builder.originalFile(file, `history-${visited.size}.jsonl`, signal, prefixBytes);
      let first: any; for await (const row of readJsonl(snapshot, { signal })) { first = row; break; }
      const base = first?.type === 'session_meta' ? first.payload?.history_base : undefined;
      if (base) { const previous = await historyBase(base, file); if (previous) await append(previous, base.end_byte_offset); else await appendIndex(base); }
      let index = 0;
      for await (const value of readJsonl(snapshot, { signal, lossless: true })) {
        const row = asRecord(value), ref = await builder.record(row, { file: path.basename(file), record_index: index++ });
        if (row.type === 'response_item' && row.payload && typeof row.payload === 'object') {
          await normalizeResponse(asRecord(row.payload), builder, ref, [source.root, ...(source.resourceRoots ?? [])], true, row.timestamp);
        } else {
          if (row.type === 'compacted' || row.type === 'compaction') builder.issue('context_compaction', 'Model-context compaction does not remove the recorded dialogue');
          await builder.event(ref, row.type === 'session_meta' ? 'metadata' : row.type === 'compacted' ? 'compaction' : 'lifecycle', { native_type: String(row.type), projection: 'auxiliary' });
        }
      }
    };
    await append(source.file);
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
