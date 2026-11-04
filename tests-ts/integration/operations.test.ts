import { beforeAll, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { Context } from '@deepseek-ai/cordis';
import * as Persistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import AttachmentLocal from '@deepseek-ai/dsh-attachment-local';
import { build } from 'esbuild';
import { MigrationService } from '../../src/operations.js';
import { WorkerRunner } from '../../src/sources/worker-client.js';
import { sourceKey } from '../../src/sources/types.js';
beforeAll(async () => { await build({ entryPoints: ['src/sources/worker.ts'], outfile: 'lib/source-worker.js', bundle: true, platform: 'node', format: 'esm', packages: 'external' }); });
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-operations-')), wb = path.join(root, 'wb');
  await mkdir(path.join(wb, 'projects/p'), { recursive: true });
  const db = new DatabaseSync(path.join(wb, 'workbuddy.db'));
  db.exec('create table sessions(id text,title text,cwd text,status text,deleted_at integer,updated_at integer)');
  db.prepare('insert into sessions values (?,?,?,?,?,?)').run('s', 'Active source', root, 'completed', null, 10);
  await writeFile(path.join(wb, 'projects/p/s.jsonl'), [
    { type: 'message', role: 'user', content: '保留这段历史', sessionId: 's' },
    { type: 'message', role: 'assistant', content: '已保留。', sessionId: 's' },
  ].map(r => JSON.stringify(r)).join('\n') + '\n');
  const ctx = new Context(); const storage = await ctx.plugin(Persistence, { root: path.join(root, 'sessions'), compression: 'none' });
  const attachments = await ctx.plugin(AttachmentLocal, { dshHome: root });
  const create = (attach = async () => {}, store = ctx.sessionPersistence, attachmentStore = ctx.attachments) => MigrationService.create({ directory: path.join(root, 'data'), namespace: root, roots: { workbuddy: wb },
    worker: new WorkerRunner(new URL('../../lib/source-worker.js', import.meta.url)), store, attachments: attachmentStore,
    resolveTarget: async target => target, attach });
  return { root, wb, db, ctx, create, cleanup: async () => { db.close(); await attachments.dispose(); await storage.dispose(); await rm(root, { recursive: true, force: true }); } };
}
async function finish(service: MigrationService, id: string) {
  for (let i = 0; i < 300; i++) { const op = service.operation(id); if (!['prepared', 'writing', 'verifying'].includes(op.state)) return op; await new Promise(r => setTimeout(r, 20)); }
  throw new Error('migration did not finish');
}
it('refuses a source archived after preview before any target session write', async () => {
  const f = await fixture(), service = await f.create();
  try {
    const preview = await service.preview(sourceKey('workbuddy', f.wb, 's'), { cwd: f.root, agentPreset: 'standard' });
    f.db.exec("update sessions set status='archived'");
    await expect(service.commit({ previewId: preview.previewId, reportHash: preview.report.reportHash, requestId: 'r1' })).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
    expect(await f.ctx.sessionPersistence.list()).toHaveLength(0);
  } finally { await service.close(); await f.cleanup(); }
});
it('recovers a committed native session after receipt/association failure without duplication', async () => {
  const f = await fixture(); let service = await f.create(async () => { throw new Error('association interrupted'); });
  try {
    const preview = await service.preview(sourceKey('workbuddy', f.wb, 's'), { cwd: f.root, agentPreset: 'standard' });
    const request = { previewId: preview.previewId, reportHash: preview.report.reportHash, requestId: 'r1' };
    const first = await service.commit(request), failed = await finish(service, first.operationId);
    expect(failed.state).toBe('needs-attention'); expect(await f.ctx.sessionPersistence.list()).toHaveLength(1);
    await service.close(); service = await f.create();
    const retry = await service.commit(request); expect(retry.targetSessionId).toBe(first.targetSessionId);
    expect(await finish(service, retry.operationId)).toMatchObject({ state: 'completed' });
    expect((await service.commit(request)).operationId).toBe(first.operationId);
    expect(await f.ctx.sessionPersistence.list()).toHaveLength(1);
    await expect(service.commit({ ...request, reportHash: 'changed' })).rejects.toMatchObject({ code: 'PREVIEW_CHANGED' });
  } finally { await service.close(); await f.cleanup(); }
});

it('resumes only an exact partial log prefix after an interrupted append', async () => {
  const f = await fixture(); let interrupted = false;
  const store = new Proxy(f.ctx.sessionPersistence, { get(target, key) {
    if (key === 'create') return async (...args: Parameters<typeof target.create>) => {
      const handle = await target.create(...args);
      return new Proxy(handle, { get(h, member) {
        if (member === 'append') return async (events: Parameters<typeof h.append>[0]) => {
          if (!interrupted) { interrupted = true; await h.append(events.slice(0, 2)); throw new Error('append interrupted'); }
          return h.append(events);
        };
        const value = Reflect.get(h, member, h); return typeof value === 'function' ? value.bind(h) : value;
      } });
    };
    const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
  } });
  let service = await f.create(async () => {}, store);
  try {
    const preview = await service.preview(sourceKey('workbuddy', f.wb, 's'), { cwd: f.root, agentPreset: 'standard' });
    const request = { previewId: preview.previewId, reportHash: preview.report.reportHash, requestId: 'partial' };
    const first = await service.commit(request); expect((await finish(service, first.operationId)).state).toBe('needs-attention');
    await service.close(); service = await f.create();
    const retry = await service.commit(request); expect(retry.targetSessionId).toBe(first.targetSessionId);
    expect(await finish(service, retry.operationId)).toMatchObject({ state: 'completed' });
    expect(await f.ctx.sessionPersistence.list()).toHaveLength(1);
  } finally { await service.close(); await f.cleanup(); }
});

it('rechecks source archival after attachment work and before creating the target', async () => {
  const f = await fixture();
  await writeFile(path.join(f.wb, 'note.txt'), 'file');
  await writeFile(path.join(f.wb, 'projects/p/s.jsonl'), JSON.stringify({ type: 'message', role: 'user', content: [{ type: 'text', text: 'attached' }, { type: 'file', path: path.join(f.wb, 'note.txt') }] }) + '\n');
  const attachments = new Proxy(f.ctx.attachments, { get(target, key) {
    if (key === 'saveFileStream') return async (...args: Parameters<typeof target.saveFileStream>) => {
      const value = await target.saveFileStream(...args); f.db.exec("update sessions set status='archived'"); return value;
    };
    const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
  } });
  const service = await f.create(async () => {}, f.ctx.sessionPersistence, attachments);
  try {
    const preview = await service.preview(sourceKey('workbuddy', f.wb, 's'), { cwd: f.root, agentPreset: 'standard' });
    const op = await service.commit({ previewId: preview.previewId, reportHash: preview.report.reportHash, requestId: 'during' });
    expect(await finish(service, op.operationId)).toMatchObject({ state: 'failed', errorCode: 'SOURCE_INACTIVE' });
    expect(await f.ctx.sessionPersistence.list()).toHaveLength(0);
  } finally { await service.close(); await f.cleanup(); }
});

it('canceling a queued import creates no target session', async () => {
  const f = await fixture(), service = await f.create();
  try {
    const preview = await service.preview(sourceKey('workbuddy', f.wb, 's'), { cwd: f.root, agentPreset: 'standard' });
    const op = await service.commit({ previewId: preview.previewId, reportHash: preview.report.reportHash, requestId: 'cancel' });
    service.cancel(op.operationId);
    expect((await finish(service, op.operationId)).state).toBe('canceled');
    expect(await f.ctx.sessionPersistence.list()).toHaveLength(0);
  } finally { await service.close(); await f.cleanup(); }
});

it('refuses a reserved target whose immutable header changed before recovery', async () => {
  const f = await fixture(), service = await f.create();
  try {
    const preview = await service.preview(sourceKey('workbuddy', f.wb, 's'), { cwd: f.root, agentPreset: 'standard' });
    const reserved = service.ledger.reserve(preview.previewId, 'seeded-reservation', 'header-conflict', 'title');
    const { freezeHistory } = await import('../../src/mapping.js');
    const { atomicJson } = await import('../../src/operations.js');
    const stored = service.ledger.preview<{ plan: import('../../src/mapping.js').MigrationPlan }>(preview.previewId)!;
    const history = await freezeHistory(stored.plan, reserved.targetSessionId, {});
    const directory = path.join(f.root, 'data/operations', reserved.operationId); await mkdir(directory, { recursive: true }); await atomicJson(path.join(directory, 'history.json'), history);
    const other = await f.ctx.sessionPersistence.create({ ...history.header, cwd: os.tmpdir() }); await other.flush(); await other.close();
    const op = await service.commit({ previewId: preview.previewId, reportHash: preview.report.reportHash, requestId: 'header-conflict' });
    expect((await finish(service, op.operationId)).state).toBe('needs-attention');
    const reader = await f.ctx.sessionPersistence.open(history.header.id, 'read');
    try { expect((await reader.read()).events).toHaveLength(0); } finally { await reader.close(); }
  } finally { await service.close(); await f.cleanup(); }
});

it('turns an orphaned durable reservation into a recoverable UI state after restart', async () => {
  const f = await fixture(); let service = await f.create();
  try {
    const preview = await service.preview(sourceKey('workbuddy',f.wb,'s'),{cwd:f.root,agentPreset:'standard'});
    const op = service.ledger.reserve(preview.previewId,'crash-reservation','crashed','title');
    await service.close(); service = await f.create();
    expect(service.operation(op.operationId)).toMatchObject({ state: 'needs-attention', targetSessionId: op.targetSessionId });
    expect(service.operations().some(o => ['prepared','writing','verifying'].includes(o.state))).toBe(false);
    const retry = await service.commit({ previewId:preview.previewId,reportHash:preview.report.reportHash,requestId:'crashed' });
    expect(retry.targetSessionId).toBe(op.targetSessionId);
    expect((await finish(service,retry.operationId)).state).toBe('completed');
  } finally { await service.close(); await f.cleanup(); }
});

it('does not let archived sources bypass checks through a backup or its prepared preview', async () => {
  const f = await fixture(), service = await f.create();
  try {
    const preview = await service.preview(sourceKey('workbuddy', f.wb, 's'), { cwd: f.root, agentPreset: 'standard' });
    const saved = service.ledger.preview<{ plan: { archivePath: string } }>(preview.previewId)!;
    const uploaded = await service.registerFile(saved.plan.archivePath, 'alink');
    const backupPreview = await service.preview(uploaded.sourceId, { cwd: f.root, agentPreset: 'standard' });
    f.db.exec("update sessions set status='archived'");
    expect((await service.sessions('workbuddy')).items).toEqual([]);
    await expect(service.registerFile(saved.plan.archivePath, 'alink')).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
    await expect(service.preview(uploaded.sourceId, { cwd: f.root, agentPreset: 'standard' })).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
    await expect(service.commit({ previewId: backupPreview.previewId, reportHash: backupPreview.report.reportHash, requestId: 'backup-bypass' })).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
    expect(await f.ctx.sessionPersistence.list()).toHaveLength(0);
  } finally { await service.close(); await f.cleanup(); }
});

it('does not resume a failed migration if its source has since been archived', async () => {
  const f = await fixture(); let service = await f.create(async () => { throw new Error('association failure'); });
  try {
    const preview = await service.preview(sourceKey('workbuddy', f.wb, 's'), { cwd: f.root, agentPreset: 'standard' });
    const request = { previewId: preview.previewId, reportHash: preview.report.reportHash, requestId: 'retry-bypass' };
    const op = await service.commit(request); expect((await finish(service, op.operationId)).state).toBe('needs-attention');
    const id = (await f.ctx.sessionPersistence.list())[0].header.id;
    const before = await f.ctx.sessionPersistence.open(id, 'read'); const snapshot = JSON.stringify((await before.read()).events); await before.close();
    await service.close(); f.db.exec("update sessions set status='archived'"); service = await f.create();
    await expect(service.commit(request)).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
    const after = await f.ctx.sessionPersistence.open(id, 'read');
    try { expect(JSON.stringify((await after.read()).events)).toBe(snapshot); } finally { await after.close(); }
    expect(await f.ctx.sessionPersistence.list()).toHaveLength(1);
  } finally { await service.close(); await f.cleanup(); }
});
