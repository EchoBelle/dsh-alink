import path from 'node:path';
import { stat, readdir } from 'node:fs/promises';
import { ArchiveBuilder } from '../archive.js';
import { withReadonlyDatabase, tableColumns, portableRow, captureNativeRows } from './sqlite.js';
import { sourceKey, eligibility, binaryState, number, asRecord, type SourceLocator } from './types.js';
import { normalizeBlocks } from './resources.js';
import { readJsonl } from './jsonl.js';
export async function discoverRaccoon(root: string): Promise<SourceLocator[]> {
  const file = path.join(root, 'local-chat.sqlite3'); if (!await stat(file).catch(() => undefined)) return [];
  return withReadonlyDatabase(file, db => {
    const cols = tableColumns(db, 'sessions'); if (!cols.has('id')) throw new Error('UNSUPPORTED_SOURCE');
    const selected = ['id', 'title', 'workspace_dir', 'available', 'updated_at_ms', 'archived', 'is_archived', 'archived_at', 'deleted_at', 'status'].filter(k => cols.has(k));
    return db.prepare(`SELECT ${selected.map(k => '"' + k + '"').join(',')} FROM sessions`).all().map(row => ({
      sourceId: sourceKey('raccoon', root, String(row.id)), app: 'raccoon', nativeId: String(row.id), root, file,
      title: String(row.title || '未命名会话'), cwd: row.workspace_dir ? String(row.workspace_dir) : undefined,
      updatedAt: number(row.updated_at_ms), eligibility: eligibility(row, cols.has('available') && binaryState(row.available) === 1),
    }));
  });
}
export async function captureRaccoon(source: SourceLocator, destination: string, signal?: AbortSignal) {
  const b = await ArchiveBuilder.create(destination, 'raccoon', 'local-chat-sqlite', { native_id: source.nativeId, title: source.title, ...(source.cwd ? { cwd: source.cwd } : {}) });
  b.manifest.source.location = source.file;
  const roots = [source.root, ...(source.resourceRoots ?? [])];
  try {
    await captureNativeRows(b, source.file, [['sessions', 'id', source.nativeId]], signal);
    await withReadonlyDatabase(source.file, async db => {
      const columns = tableColumns(db, 'messages');
      if (!['session_id', 'payload_json', 'seq', 'id'].every(k => columns.has(k))) throw new Error('UNSUPPORTED_SOURCE');
      const query = db.prepare('SELECT * FROM messages WHERE session_id=? ORDER BY seq,id'); query.setReadBigInts(true);
      for (const row of query.iterate(source.nativeId)) {
        signal?.throwIfAborted();
        const ref = await b.record(portableRow(row), { table: 'messages', key: String(row.id) });
        const payload = asRecord(JSON.parse(String(row.payload_json))), nativeType = String(row.type ?? payload.type ?? 'unknown');
        let content = payload.content;
        const kind = ['text', 'generate', 'code'].includes(nativeType) ? 'message'
          : ['file', 'image'].includes(nativeType) ? 'artifact'
          : nativeType === 'execution' ? 'tool_result' : nativeType === 'change_set' ? 'checkpoint'
          : ['plan', 'todo'].includes(nativeType) ? 'plan' : 'opaque';
        if (nativeType === 'file' && content && typeof content === 'object') content = [{ ...content, type: 'file' }];
        if (nativeType === 'image' && typeof content === 'string') content = [{ type: 'opaque', value: content }];
        await b.event(ref, kind, { role: String(row.role ?? 'unknown'), content: await normalizeBlocks(content, b, ref, roots),
          native_type: nativeType, native_id: String(row.id), ...(number(row.created_at_ms) === undefined ? {} : { timestamp: number(row.created_at_ms) }),
          ...(row.active === undefined ? {} : { active: Number(row.active) !== 0 }), ...(row.visible === undefined ? {} : { visible: Number(row.visible) !== 0 }),
          ...(row.turn_id == null ? {} : { turn_id: String(row.turn_id) }) });
      }
    }, signal);
    const changes = path.join(source.root, 'change_history.db');
    if (await stat(changes).catch(() => undefined)) for await (const row of readJsonl(changes, { signal, lossless: true })) {
      if (String(row.sessionId) !== source.nativeId) continue;
      const ref = await b.record(row, { file: 'change_history.db' }); await b.event(ref, 'checkpoint', { native_type: 'change-history', projection: 'auxiliary' });
      if (typeof row.checkpointDir === 'string') await b.resource(row.checkpointDir, ref, roots);
      if (typeof row.workspaceDir === 'string') {
        const workspace = path.resolve(row.workspaceDir);
        if (!roots.some(root => workspace === path.resolve(root) || workspace.startsWith(path.resolve(root) + path.sep))) { b.issue('external_task_workspace', 'Associated task output is outside resource roots'); continue; }
        for (const dir of ['.box-agent/task-registry/tasks', 'output/tasks']) {
          const visit = async (folder: string) => {
            for (const entry of await readdir(folder, { withFileTypes: true }).catch(() => [])) {
              const file = path.join(folder, entry.name); if (entry.isDirectory()) await visit(file);
              else if (entry.isFile()) {
                const record = await b.record({ path: file }, { kind: 'associated_task_file' });
                const rid = await b.resource(file, record, roots); await b.event(record, 'artifact', { content: [{ type: 'resource', resource_id: rid }] });
              }
            }
          }; await visit(path.join(workspace, dir));
        }
      }
    }
    b.issue('native_cards', 'Private cards are preserved in original records; unsupported tool structure is not executable');
    return await b.finish();
  } catch (error) { await b.close(); throw error; }
}
