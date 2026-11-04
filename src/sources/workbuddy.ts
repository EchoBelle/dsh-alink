import path from 'node:path';
import { readdir, stat, realpath } from 'node:fs/promises';
import { ArchiveBuilder } from '../archive.js';
import { readJsonl } from './jsonl.js';
import { tableColumns, withReadonlyDatabase, captureNativeRows } from './sqlite.js';
import { sourceKey, eligibility, workBuddyActiveStatuses, number, asRecord, type SourceLocator } from './types.js';
import { normalizeResponse } from './resources.js';

export async function discoverWorkBuddy(root: string): Promise<SourceLocator[]> {
  const database = path.join(root, 'workbuddy.db');
  try { await stat(database); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; }
  const files = new Map<string, string>();
  for (const directory of await readdir(path.join(root, 'projects'), { withFileTypes: true }).catch(() => [])) {
    if (!directory.isDirectory()) continue;
    for (const file of await readdir(path.join(root, 'projects', directory.name), { withFileTypes: true })) {
      if (file.isFile() && file.name.endsWith('.jsonl')) files.set(file.name.slice(0, -6), path.join(root, 'projects', directory.name, file.name));
    }
  }
  return withReadonlyDatabase(database, db => {
    const cols = tableColumns(db, 'sessions');
    if (!cols.has('id')) throw new Error('UNSUPPORTED_SOURCE');
    const selected = ['id', 'title', 'custom_title', 'cwd', 'status', 'deleted_at', 'updated_at', 'archived', 'is_archived', 'archived_at'].filter(k => cols.has(k));
    return db.prepare(`SELECT ${selected.map(k => '"' + k + '"').join(',')} FROM sessions`).all().map(row => {
      const nativeId = String(row.id), file = files.get(nativeId);
      if (!file) return undefined;
      return { sourceId: sourceKey('workbuddy', root, nativeId), app: 'workbuddy' as const, nativeId, root, file,
        title: String(row.custom_title || row.title || '未命名会话'), cwd: row.cwd ? String(row.cwd) : undefined,
        updatedAt: number(row.updated_at), eligibility: eligibility(row, cols.has('deleted_at') && row.deleted_at === null && typeof row.status === 'string' && workBuddyActiveStatuses.has(row.status)) };
    }).filter((row): row is NonNullable<typeof row> => row !== undefined);
  });
}
export async function captureWorkBuddy(source: SourceLocator, destination: string, signal?: AbortSignal) {
  const roots = [await realpath(source.root), ...(source.resourceRoots ?? [])];
  const builder = await ArchiveBuilder.create(destination, 'workbuddy', 'responses-jsonl', { native_id: source.nativeId, title: source.title, ...(source.cwd ? { cwd: source.cwd } : {}) });
  builder.manifest.source.location = source.file;
  try {
    const snapshot = await builder.originalFile(source.file, undefined, signal);
    let index = 0;
    for await (const value of readJsonl(snapshot, { signal, lossless: true })) {
      const row = asRecord(value), ref = await builder.record(row, { file: path.basename(source.file), record_index: index++ });
      await normalizeResponse(row, builder, ref, roots);
    }
    await captureNativeRows(builder, path.join(source.root, 'workbuddy.db'), [
      ['sessions', 'id', source.nativeId], ['session_usage', 'session_id', source.nativeId],
    ], signal);
    const artifact = path.join(source.root, 'artifact-index', source.nativeId + '.json');
    if (await stat(artifact).catch(() => undefined)) {
      const snapshot = await builder.originalFile(artifact, 'artifact-index.json', signal);
      const { readFile } = await import('node:fs/promises');
      const data = JSON.parse(await readFile(snapshot, 'utf8'));
      const ref = await builder.record(data, { file: 'artifact-index.json' });
      const content = [];
      for (const resource of data.artifacts ?? []) if (typeof resource.uri === 'string') content.push({ type: 'resource', resource_id: await builder.resource(resource.uri, ref, roots, resource.mimeType) });
      await builder.event(ref, 'artifact', { content, native_type: 'artifact-index' });
    }
    builder.issue('resource_discovery_scope', 'Only recognized resource references within configured source roots are collected');
    return await builder.finish();
  } catch (error) { await builder.close(); throw error; }
}
