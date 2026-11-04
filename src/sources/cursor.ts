import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stat } from 'node:fs/promises';
import { ArchiveBuilder } from '../archive.js';
import { withReadonlyDatabase, tableColumns, portableRow, captureNativeRows } from './sqlite.js';
import { sourceKey, eligibility, binaryState, number, asRecord, type SourceLocator, type NativeRow } from './types.js';
import { normalizeBlocks } from './resources.js';
function project(meta: NativeRow): { cwd?: string; project?: Record<string, unknown> } {
  const ws = meta.workspaceIdentifier;
  if (!ws || typeof ws !== 'object') return {};
  const uri = ws.folder ?? ws.configPath ?? ws.workspace;
  if (typeof uri !== 'string') return {};
  if (ws.folder && uri.startsWith('file:')) {
    try { const cwd = fileURLToPath(uri); return { cwd, project: { path: cwd, name: path.basename(cwd), kind: 'directory', uri } }; } catch { return {}; }
  }
  return { project: { path: '', name: meta.name || '来源工作区', kind: ws.folder ? 'remote' : 'workspace_file', uri } };
}
export async function discoverCursor(root: string): Promise<SourceLocator[]> {
  const file = path.join(root, 'User/globalStorage/state.vscdb'); if (!await stat(file).catch(() => undefined)) return [];
  return withReadonlyDatabase(file, db => {
    const cols = tableColumns(db, 'composerHeaders');
    if (!cols.has('composerId') || !cols.has('value')) throw new Error('UNSUPPORTED_SOURCE');
    const selected = ['composerId', 'value', 'isArchived', 'isSubagent', 'lastUpdatedAt', 'isDeleted'].filter(k => cols.has(k));
    return db.prepare(`SELECT ${selected.map(k => '"' + k + '"').join(',')} FROM composerHeaders`).all()
      .filter(r => !Number(r.isSubagent ?? 0)).map(row => {
        const header = asRecord(JSON.parse(String(row.value))), nativeId = String(row.composerId);
        return { sourceId: sourceKey('cursor', root, nativeId), app: 'cursor' as const, nativeId, root, file,
          title: String(header.name || '未命名会话'), cwd: project(header).cwd, updatedAt: number(row.lastUpdatedAt), eligibility: eligibility({ ...header, ...row }, cols.has('isArchived') && binaryState(row.isArchived) !== undefined) };
      });
  });
}
export async function captureCursor(source: SourceLocator, destination: string, signal?: AbortSignal) {
  const b = await ArchiveBuilder.create(destination, 'cursor', 'composer-disk-kv', { native_id: source.nativeId, title: source.title, ...(source.cwd ? { cwd: source.cwd } : {}) });
  b.manifest.source.location = source.file;
  const roots = [source.root, ...(source.resourceRoots ?? [])];
  try {
    await captureNativeRows(b, source.file, [['composerHeaders', 'composerId', source.nativeId]], signal);
    await withReadonlyDatabase(source.file, async db => {
      const row = db.prepare('SELECT key,value FROM cursorDiskKV WHERE key=?').get('composerData:' + source.nativeId);
      if (!row) throw new Error('Composer not found');
      const meta = asRecord(JSON.parse(String(row.value)));
      Object.assign(b.manifest.session, project(meta));
      const ref = await b.record(portableRow(row), { table: 'cursorDiskKV', key: row.key }); await b.event(ref, 'metadata', { native_type: 'composerData', projection: 'auxiliary' });
      if (!Array.isArray(meta.fullConversationHeadersOnly)) b.issue('unresolved_history', 'Composer has no verified active message order');
      const ids: string[] = (meta.fullConversationHeadersOnly ?? []).map((h: NativeRow) => String(h.bubbleId));
      const active = new Set(ids), rows = new Map<string, Record<string, unknown>>();
      for (const type of ['bubbleId', 'checkpointId', 'agentKv']) {
        const prefix = type + ':' + source.nativeId + ':';
        for (const r of db.prepare('SELECT key,value FROM cursorDiskKV WHERE key>=? AND key<? ORDER BY key').iterate(prefix, prefix + '\uffff')) rows.set(String(r.key), r);
      }
      const ordered = ids.map(id => 'bubbleId:' + source.nativeId + ':' + id);
      const listed = new Set(ordered); ordered.push(...[...rows.keys()].filter(k => !listed.has(k)));
      for (const key of ordered) {
        signal?.throwIfAborted();
        const row = rows.get(key);
        if (!row) { b.issue('unresolved_history', 'Active composer header refers to a missing bubble'); continue; }
        const ref = await b.record(portableRow(row), { table: 'cursorDiskKV', key });
        if (!key.startsWith('bubbleId:')) { await b.event(ref, key.startsWith('checkpointId:') ? 'checkpoint' : 'opaque', { projection: 'auxiliary' }); continue; }
        const bubble = asRecord(JSON.parse(String(row.value))), id = String(bubble.bubbleId ?? key.split(':').at(-1));
        const attrs = { native_id: id, active: active.has(id), ...(number(bubble.createdAt) === undefined ? {} : { timestamp: number(bubble.createdAt) }) };
        await b.event(ref, 'message', { ...attrs, native_type: 'bubble', role: Number(bubble.type) === 1 ? 'user' : Number(bubble.type) === 2 ? 'assistant' : 'unknown', content: await normalizeBlocks(bubble.text ?? '', b, ref, roots) });
        const tool = bubble.toolFormerData;
        if (tool && typeof tool === 'object') {
          await b.event(ref, 'tool_call', { ...attrs, role: 'assistant', native_type: 'toolFormerData', content: [{ type: 'tool_call', call_id: String(tool.toolCallId ?? ''), name: String(tool.name ?? ''), arguments: tool.rawArgs ?? tool.params ?? '', argument_encoding: typeof tool.rawArgs === 'string' ? 'json_string' : 'json' }] });
          if ('result' in tool) await b.event(ref, 'tool_result', { ...attrs, role: 'tool', content: [{ type: 'tool_result', call_id: String(tool.toolCallId ?? ''), output: tool.result }] });
        }
      }
    }, signal);
    b.issue('cursor_dependency_closure', 'Per-composer records retained; shared blobs and external histories are not assumed collected');
    return await b.finish();
  } catch (error) { await b.close(); throw error; }
}
