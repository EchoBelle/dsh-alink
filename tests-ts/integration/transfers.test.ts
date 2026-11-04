import { beforeAll, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { Context } from '@deepseek-ai/cordis';
import { Session } from '@deepseek-ai/dsh-session';
import * as Persistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import AttachmentLocal from '@deepseek-ai/dsh-attachment-local';
import { build } from 'esbuild';
import { MigrationService } from '../../src/operations.js';
import { Transfers } from '../../src/transfers.js';
import { WorkerRunner } from '../../src/sources/worker-client.js';
import { sourceKey } from '../../src/sources/types.js';
import { importArchives } from '../../src/archive.js';
import { createImportedHistory, digest } from '../../src/dsh/history.js';
import { persistHistory } from '../../src/dsh/persistence.js';
import type { MigrationPlan } from '../../src/mapping.js';
import type { Preview } from '../../src/contracts.js';

beforeAll(async () => { await build({ entryPoints: ['src/sources/worker.ts'], outfile: 'lib/source-worker.js', bundle: true, platform: 'node', format: 'esm', packages: 'external' }); });
async function fixture(attach = async (_cwd: string, _id: string) => {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'alink-batch-')), wb = path.join(root, 'wb');
  await mkdir(path.join(wb, 'projects/p'), { recursive: true });
  const db = new DatabaseSync(path.join(wb, 'workbuddy.db'));
  db.exec('CREATE TABLE sessions(id TEXT,title TEXT,cwd TEXT,status TEXT,deleted_at INTEGER,updated_at INTEGER)');
  for (const id of ['a', 'b', 'archived']) {
    db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?,?)').run(id, id, root, id === 'archived' ? 'archived' : 'completed', null, 1);
    await writeFile(path.join(wb, 'projects/p', id + '.jsonl'), [
      { type: 'message', role: 'user', content: '# AGENTS.md instructions\n<INSTRUCTIONS>private rules</INSTRUCTIONS>' },
      { type: 'message', role: 'user', content: 'question ' + id },
      { type: 'function_call', call_id: 'c', name: 'exec', arguments: 'private tool arguments' },
      { type: 'function_call_output', call_id: 'c', output: 'private tool output' },
      { type: 'message', role: 'assistant', content: 'answer ' + id },
    ].map(row => JSON.stringify({ ...row, sessionId: id })).join('\n') + '\n');
  }
  const ctx = new Context(), persistence = await ctx.plugin(Persistence, { root: path.join(root, 'sessions'), compression: 'none' }), attachments = await ctx.plugin(AttachmentLocal, { dshHome: root });
  const service = await MigrationService.create({ directory: path.join(root, 'data'), namespace: root, roots: { workbuddy: wb }, worker: new WorkerRunner(new URL('../../lib/source-worker.js', import.meta.url)), store: ctx.sessionPersistence, attachments: ctx.attachments, resolveTarget: async target => target, attach });
  const transfers = await Transfers.create(path.join(root, 'transfers'), service);
  const ids = (names: string[]) => names.map(id => sourceKey('workbuddy', wb, id));
  return { root, db, ctx, service, transfers, ids, cleanup: async () => { await transfers.close(); await service.close(); await attachments.dispose(); await persistence.dispose(); db.close(); await rm(root, { recursive: true, force: true }); } };
}
async function finish(transfers: Transfers, id: string) {
  await expect.poll(() => transfers.get(id).state, { timeout: 20000, interval: 30 }).not.toMatch(/^(queued|running)$/);
  return transfers.get(id);
}
async function messages(f: Awaited<ReturnType<typeof fixture>>, id: string) {
  const reader = await f.ctx.sessionPersistence.open(id as never, 'read');
  try { const read = await reader.read(); return Session.fromRestore(reader.id, read.events, reader.header, reader.inheritedEventCount, read.eventState).deriveMessages(); }
  finally { await reader.close(); }
}

it('imports a batch without a preview step, excludes archived sources and writes only dialogue', async () => {
  const f = await fixture();
  try {
    const request = { requestId: randomUUID(), kind: 'import' as const, sourceIds: f.ids(['a', 'archived', 'b']), target: { agentPreset: 'standard' } };
    const [first, duplicate] = await Promise.all([f.transfers.start(request), f.transfers.start(request)]);
    expect(duplicate.id).toBe(first.id);
    const result = await finish(f.transfers, first.id);
    expect(result.state).toBe('partial'); expect(result.items.map(i => i.state)).toEqual(['completed', 'failed', 'completed']);
    expect(result.items[1].errorCode).toBe('SOURCE_INACTIVE'); expect(await f.ctx.sessionPersistence.list()).toHaveLength(2);
    for (const op of f.service.operations()) {
      const content = await messages(f, op.targetSessionId);
      expect(content.map(m => m.role)).toEqual(['user', 'assistant']);
      expect(JSON.stringify(content)).not.toMatch(/private|工具历史|INSTRUCTIONS/);
    }
  } finally { await f.cleanup(); }
});

it('exports before any import, reads multi-session packages, and rechecks archival on upload and download', async () => {
  const f = await fixture();
  try {
    const job = await f.transfers.start({ requestId: randomUUID(), kind: 'export', sourceIds: f.ids(['a', 'b']) });
    expect((await finish(f.transfers, job.id)).downloadable).toBe(true);
    expect(f.service.operations()).toHaveLength(0); expect(await f.ctx.sessionPersistence.list()).toHaveLength(0);
    const file = await f.transfers.download(job.id), archives = await importArchives(file, path.join(f.root, 'unpacked'), new AbortController().signal);
    expect(archives).toHaveLength(2);
    expect(await readFile(path.join(archives[0].archivePath, 'records.jsonl'), 'utf8')).toContain('private tool');
    f.db.exec("UPDATE sessions SET status='archived' WHERE id='b'");
    await expect(f.transfers.download(job.id)).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
    const registered = await f.service.registerFiles(file, 'alink');
    expect(registered.sources).toHaveLength(1); expect(registered.errors).toEqual(['SOURCE_INACTIVE']);
    const imported = await f.transfers.start({ requestId: randomUUID(), kind: 'import', sourceIds: registered.sources.map(s => s.sourceId), target: { agentPreset: 'standard' } });
    expect((await finish(f.transfers, imported.id)).state).toBe('completed');
    expect(await f.ctx.sessionPersistence.list()).toHaveLength(1);
  } finally { await f.cleanup(); }
});

it('rechecks queued sessions and retries only unfinished items without duplicates', async () => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { entered = resolve; });
  const f = await fixture(async () => { entered(); await gate; });
  try {
    const job = await f.transfers.start({ requestId: randomUUID(), kind: 'import', sourceIds: f.ids(['a', 'b']), target: { agentPreset: 'standard' } });
    await reached; expect(() => f.service.removeOperation(f.service.operations()[0].operationId)).toThrow('IMPORT_BUSY'); f.db.exec("UPDATE sessions SET status='archived' WHERE id='b'"); release();
    expect((await finish(f.transfers, job.id)).state).toBe('partial');
    const firstId = f.service.operations()[0].targetSessionId;
    await f.transfers.retry(job.id); expect((await finish(f.transfers, job.id)).state).toBe('partial');
    f.db.exec("UPDATE sessions SET status='completed' WHERE id='b'");
    await f.transfers.retry(job.id); expect((await finish(f.transfers, job.id)).state).toBe('completed');
    expect(await f.ctx.sessionPersistence.list()).toHaveLength(2);
    expect(f.service.operations().map(op => op.targetSessionId)).toContain(firstId);
  } finally { release(); await f.cleanup(); }
});

it('deletes only the migration record and retains duplicate protection and the DSH session', async () => {
  const f = await fixture();
  try {
    const request = { kind: 'import' as const, sourceIds: f.ids(['a']), target: { agentPreset: 'standard' } };
    const job = await f.transfers.start({ ...request, requestId: randomUUID() }); await finish(f.transfers, job.id);
    const op = f.service.operations()[0]; f.service.removeOperation(op.operationId);
    expect(f.service.operations()).toEqual([]); expect(await f.ctx.sessionPersistence.stat(op.targetSessionId as never)).toBeDefined();
    const again = await f.transfers.start({ ...request, requestId: randomUUID() }); await finish(f.transfers, again.id);
    expect(f.service.operations()[0].targetSessionId).toBe(op.targetSessionId); expect(await f.ctx.sessionPersistence.list()).toHaveLength(1);
  } finally { await f.cleanup(); }
});

it('rejects old prepared plans and reimports an old completed record into a new clean session', async () => {
  const f = await fixture();
  try {
    const preview = await f.service.preview(f.ids(['a'])[0], { cwd: f.root, agentPreset: 'standard' });
    const saved = f.service.ledger.preview<{ preview: Preview; plan: MigrationPlan; sourceId: string }>(preview.previewId)!;
    const oldId = randomUUID(); saved.preview.previewId = oldId; saved.plan.report.mappingVersion = '1'; saved.preview.report.mappingVersion = '1';
    f.service.ledger.savePreview(oldId, saved);
    await expect(f.service.commit({ previewId: oldId, reportHash: saved.preview.report.reportHash, requestId: 'old-request' })).rejects.toMatchObject({ code: 'MAPPING_CHANGED' });
    const op = f.service.ledger.reserve(oldId, digest({ old: oldId }), 'old-completed', 'old import');
    const history = createImportedHistory({ id: op.targetSessionId, cwd: f.root, title: 'old import', createdAt: Date.now(), agentPreset: 'standard', messages: [{ role: 'assistant', text: 'old tool output' }] });
    await persistHistory(f.ctx.sessionPersistence, history); op.state = 'completed'; f.service.ledger.update(op);
    const clean = await f.service.retryOperation(op.operationId); await f.service.wait(clean.operationId);
    expect(clean.targetSessionId).not.toBe(op.targetSessionId);
    expect(JSON.stringify(await messages(f, clean.targetSessionId))).not.toMatch(/old tool|private/);
    expect(JSON.stringify(await messages(f, op.targetSessionId))).toContain('old tool output');
  } finally { await f.cleanup(); }
});

it('persists cancellation and can resume unfinished batch items after reopening the service', async () => {
  const f = await fixture();
  try {
    const job = await f.transfers.start({ requestId: randomUUID(), kind: 'import', sourceIds: f.ids(['a', 'b']), target: { agentPreset: 'standard' } });
    f.transfers.cancel(job.id);
    expect((await finish(f.transfers, job.id)).state).toBe('canceled');
    await f.transfers.close();
    const reopened = await Transfers.create(path.join(f.root, 'transfers'), f.service);
    try {
      expect(reopened.get(job.id).state).toBe('canceled');
      await reopened.retry(job.id);
      expect((await finish(reopened, job.id)).state).toBe('completed');
      expect(await f.ctx.sessionPersistence.list()).toHaveLength(2);
    } finally { await reopened.close(); }
  } finally { await f.cleanup(); }
});

it('recovers a batch using its saved preview after native commit but before the item receipt was saved', async () => {
  const f = await fixture();
  try {
    const job = await f.transfers.start({ requestId: randomUUID(), kind: 'import', sourceIds: f.ids(['a']), target: { agentPreset: 'standard' } });
    await finish(f.transfers, job.id); const targetId = f.service.operations()[0].targetSessionId;
    await f.transfers.close();
    const file = path.join(f.root, 'transfers', job.id + '.json'), saved = JSON.parse(await readFile(file, 'utf8'));
    saved.state = 'running'; saved.items[0].state = 'running'; delete saved.items[0].operationId;
    await writeFile(file, JSON.stringify(saved));
    await writeFile(path.join(f.root, 'wb/projects/p/a.jsonl'), JSON.stringify({ type: 'message', role: 'user', content: 'changed after the committed import', sessionId: 'a' }) + '\n');
    const reopened = await Transfers.create(path.join(f.root, 'transfers'), f.service);
    try {
      expect(reopened.get(job.id).errorCode).toBe('INTERRUPTED');
      await reopened.retry(job.id); expect((await finish(reopened, job.id)).state).toBe('completed');
      expect(await f.ctx.sessionPersistence.list()).toHaveLength(1);
      expect(f.service.operations()[0].targetSessionId).toBe(targetId);
      expect(JSON.stringify(await messages(f, targetId))).not.toContain('changed after');
    } finally { await reopened.close(); }
  } finally { await f.cleanup(); }
});
