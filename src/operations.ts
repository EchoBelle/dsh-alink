import { mkdir, readFile, writeFile, open, rename, rm, realpath, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import { SessionId } from '@deepseek-ai/dsh-session';
import { Ledger } from './ledger.js';
import { LinkError } from './transport.js';
import type { CaptureResult, CommitRequest, Operation, Preview, SourceApp, SourceSession, Page, TargetSelection } from './contracts.js';
import { buildMigrationPlan, freezeHistory, type MappingLimits, type MigrationPlan } from './mapping.js';
import { validatePlannedImages, admitResources } from './dsh/attachments.js';
import { digest, type FrozenHistory } from './dsh/history.js';
import { verifyHistory } from './dsh/persistence.js';
import { readManifest, archiveDigest } from './archive.js';
import { WorkerRunner } from './sources/worker-client.js';
import { sourceKey, type SourceRoots, type SourceLocator } from './sources/types.js';
import { legacyRows } from './sources/dsh-legacy.js';
interface Options {
  directory: string; namespace: string; roots: SourceRoots; resourceRoots?: readonly string[]; limits?: MappingLimits;
  worker: WorkerRunner; store: SessionPersistence; attachments: AttachmentStore;
  resolveTarget(target: TargetSelection): Promise<TargetSelection>;
  attach(cwd: string, sessionId: string): Promise<void>;
}
interface StoredPreview { preview: Preview; plan: MigrationPlan; sourceId: string }
interface UploadSource { nativeSourceId: string; archivePath: string; title: string }
export async function atomicJson(file: string, value: unknown): Promise<void> {
  const temp = file + '.' + randomUUID() + '.tmp';
  const handle = await open(temp, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); } finally { await handle.close(); }
  await rename(temp, file);
  const directory = await open(path.dirname(file), 'r'); try { await directory.sync(); } finally { await directory.close(); }
}
export class MigrationService {
  readonly ledger: Ledger;
  private readonly jobs = new Map<string, { operation: Operation; controller: AbortController; promise: Promise<void> }>();
  private accepting = true;
  private readonly exports = new Map<string, Promise<string>>();
  private constructor(readonly options: Options) { this.ledger = new Ledger(path.join(options.directory, 'operations.sqlite')); }
  static async create(options: Options): Promise<MigrationService> {
    for (const folder of ['', 'snapshots', 'operations', 'uploads', 'exports']) await mkdir(path.join(options.directory, folder), { recursive: true, mode: 0o700 });
    const service = new MigrationService(options); service.ledger.reconcile(); return service;
  }
  private ready() { if (!this.accepting) throw new LinkError('PLUGIN_CLOSED'); }
  sources() { this.ready(); return this.options.worker.run({ kind: 'sources', roots: this.options.roots }); }
  sessions(app: SourceApp, query?: { text?: string; cursor?: string; limit?: number }): Promise<Page<SourceSession>> {
    this.ready(); return this.options.worker.run({ kind: 'sessions', roots: this.options.roots, app, query });
  }
  private async upload(sourceId: string): Promise<UploadSource | undefined> {
    if (!sourceId.startsWith('upload:')) return undefined;
    const id = sourceId.slice(7); if (!/^[a-f0-9-]{36}$/.test(id)) throw new LinkError('INVALID_SOURCE');
    try { return JSON.parse(await readFile(path.join(this.options.directory, 'uploads', id, 'source.json'), 'utf8')); }
    catch { throw new LinkError('INVALID_SOURCE'); }
  }
  private async active(sourceId: string, signal?: AbortSignal): Promise<SourceLocator> {
    const upload = await this.upload(sourceId);
    return this.options.worker.run({ kind: 'active', roots: this.options.roots, sourceId: upload?.nativeSourceId ?? sourceId }, signal);
  }
  async preview(sourceId: string, target: TargetSelection, signal?: AbortSignal): Promise<Preview> {
    this.ready(); const resolved = await this.options.resolveTarget(target);
    const cwd = await realpath(resolved.cwd);
    if (!(await stat(cwd)).isDirectory()) throw new LinkError('INVALID_TARGET');
    await this.active(sourceId, signal);
    const previewId = randomUUID(), destination = path.join(this.options.directory, 'snapshots', previewId);
    try {
      const upload = await this.upload(sourceId);
      const captured = upload ? await this.options.worker.run<CaptureResult>({ kind: 'import', path: upload.archivePath, destination }, signal)
        : await this.options.worker.run<CaptureResult>({ kind: 'capture', roots: this.options.roots, resourceRoots: this.options.resourceRoots, sourceId, destination }, signal);
      await this.active(sourceId, signal);
      const plan = await buildMigrationPlan(captured.archivePath, { cwd, agentPreset: resolved.agentPreset }, this.options.limits);
      await validatePlannedImages(plan, this.options.attachments);
      this.ready();
      const preview = { previewId, snapshotDigest: captured.snapshotDigest, target: plan.target, report: plan.report };
      this.ledger.savePreview(previewId, { preview, plan, sourceId } satisfies StoredPreview);
      return preview;
    } catch (error) { await rm(destination, { recursive: true, force: true }); throw error; }
  }
  private stored(id: string): StoredPreview {
    const value = this.ledger.preview<StoredPreview>(id); if (!value) throw new LinkError('PREVIEW_NOT_FOUND'); return value;
  }
  previewPage(id: string, offset = 0) {
    const stored = this.stored(id), { plan } = stored;
    if (!Number.isSafeInteger(offset) || offset < 0) throw new LinkError('INVALID_QUERY');
    return { ...(offset === 0 ? { preview: stored.preview } : {}), total: plan.messages.length, offset, items: plan.messages.slice(offset, offset + 80).map(m => ({ ...m,
      content: m.content.map(b => b.type === 'text' && b.text.length > 20000 ? { type: 'text', text: b.text.slice(0, 20000) + '\n…（仅预览截断，迁入保留完整内容）' } : b) })) };
  }
  async commit(request: CommitRequest): Promise<Operation> {
    this.ready();
    const value = this.stored(request.previewId);
    if (request.reportHash !== value.preview.report.reportHash) throw new LinkError('PREVIEW_CHANGED');
    if (value.preview.report.counts.blocked) throw new LinkError('HISTORY_BLOCKED');
    if (!request.requestId || request.requestId.length > 128) throw new LinkError('INVALID_REQUEST');
    await this.active(value.sourceId);
    const target = await this.options.resolveTarget(value.plan.target);
    if (await realpath(target.cwd) !== value.plan.target.cwd || target.agentPreset !== value.plan.target.agentPreset) throw new LinkError('TARGET_CHANGED');
    const key = digest({ snapshot: value.plan.snapshotDigest, target: value.plan.target, mapping: '1', namespace: this.options.namespace });
    const operation = this.ledger.reserve(request.previewId, key, request.requestId, value.plan.title);
    if (operation.state === 'completed') {
      if (!await this.options.store.stat(SessionId(operation.targetSessionId))) throw new LinkError('TARGET_MISSING');
      return operation;
    }
    if (!this.jobs.has(operation.operationId)) {
      operation.state = 'prepared'; operation.stage = 'queued'; delete operation.errorCode;
      const controller = new AbortController();
      const job = { operation, controller, promise: Promise.resolve() };
      this.jobs.set(operation.operationId, job);
      job.promise = Promise.resolve().then(() => this.run(operation, this.stored(operation.previewId), controller.signal)).finally(() => this.jobs.delete(operation.operationId));
    }
    return { ...this.jobs.get(operation.operationId)!.operation };
  }
  private async run(operation: Operation, saved: StoredPreview, signal: AbortSignal): Promise<void> {
    let touched = false;
    try {
      await this.ledger.withWriter(async () => {
        try {
          const directory = path.join(this.options.directory, 'operations', operation.operationId); await mkdir(directory, { recursive: true, mode: 0o700 });
          const historyFile = path.join(directory, 'history.json');
          touched = !!await this.options.store.stat(SessionId(operation.targetSessionId));
          operation.state = 'writing'; operation.stage = 'checking-source'; delete operation.errorCode;
          await this.active(saved.sourceId, signal);
          await this.options.worker.run({ kind: 'validate', path: saved.plan.archivePath }, signal);
          if (await archiveDigest(saved.plan.archivePath) !== saved.plan.snapshotDigest) throw new LinkError('SNAPSHOT_CHANGED');
          let history: FrozenHistory;
          try { history = JSON.parse(await readFile(historyFile, 'utf8')); }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || touched) throw new LinkError('HISTORY_MISSING');
            operation.stage = 'attachments';
            const resources = await admitResources(saved.plan, this.options.attachments, signal);
            history = await freezeHistory(saved.plan, operation.targetSessionId, resources);
            await atomicJson(historyFile, history);
          }
          if (digest(history.events) !== history.eventsDigest || history.header.id !== operation.targetSessionId || history.header.cwd !== saved.plan.target.cwd || history.header.agentPreset !== saved.plan.target.agentPreset) throw new LinkError('HISTORY_CHANGED');
          await this.active(saved.sourceId, signal); signal.throwIfAborted();
          operation.stage = 'persisting';
          const exists = await this.options.store.stat(history.header.id);
          const handle = exists ? await this.options.store.open(history.header.id, 'write', { signal }) : await this.options.store.create(history.header, { signal });
          touched = true;
          try {
            if (handle.header.cwd !== history.header.cwd || handle.header.agentPreset !== history.header.agentPreset || handle.header.createdAt !== history.header.createdAt || handle.header.isSeeded !== false || handle.header.version !== history.header.version) throw new LinkError('TARGET_CHANGED');
            const { events } = await handle.read();
            if (events.length > history.events.length || digest(events) !== digest(history.events.slice(0, events.length))) throw new LinkError('TARGET_CHANGED');
            for (let offset = events.length; offset < history.events.length; offset += 1000) { signal.throwIfAborted(); await handle.append(history.events.slice(offset, offset + 1000), { signal }); }
            await handle.flush({ signal });
          } finally { await handle.close(); }
          operation.state = 'verifying'; operation.stage = 'verifying';
          await verifyHistory(this.options.store, history, signal);
          await this.options.attach(history.header.cwd!, history.header.id);
          operation.state = 'completed'; operation.stage = 'complete'; delete operation.errorCode;
        } catch (error) {
          operation.state = touched ? 'needs-attention' : signal.aborted ? 'canceled' : 'failed';
          operation.stage = operation.state;
          operation.errorCode = error instanceof LinkError ? error.code : error instanceof Error && error.name === 'SessionAlreadyOwnedError' ? 'TARGET_BUSY' : signal.aborted ? 'CANCELED' : 'IMPORT_FAILED';
        }
        this.ledger.update(operation);
      });
    } catch (error) {
      operation.state = 'needs-attention'; operation.stage = 'retry'; operation.errorCode = error instanceof LinkError ? error.code : 'IMPORT_FAILED';
      // Another process may own the ledger. Its durable reservation is authoritative.
    }
  }
  operation(id: string): Operation {
    this.ledger.reconcile(new Set(this.jobs.keys()));
    const op = this.jobs.get(id)?.operation ?? this.ledger.operation(id); if (!op) throw new LinkError('OPERATION_NOT_FOUND'); return { ...op };
  }
  operations(): Operation[] { this.ledger.reconcile(new Set(this.jobs.keys())); return this.ledger.operations().map(op => ({ ...(this.jobs.get(op.operationId)?.operation ?? op) })); }
  cancel(id: string): Operation {
    const active = this.jobs.get(id); if (active) active.controller.abort();
    return this.operation(id);
  }
  async download(id: string): Promise<string> {
    if (this.exports.has(id)) return this.exports.get(id)!;
    const operation = this.operation(id), saved = this.stored(operation.previewId);
    const destination = path.join(this.options.directory, 'exports', operation.operationId + '.alink.zip');
    const pending = (async () => {
      if (await stat(destination).catch(() => undefined)) return destination;
      const temporary = destination + '.' + randomUUID() + '.tmp';
      try {
        await this.options.worker.run({ kind: 'export', path: saved.plan.archivePath, destination: temporary });
        await rename(temporary, destination); return destination;
      } finally { await rm(temporary, { force: true }); }
    })();
    this.exports.set(id, pending);
    try { return await pending; } finally { this.exports.delete(id); }
  }
  async registerFile(input: string, format: 'alink' | 'dsh', signal?: AbortSignal): Promise<SourceSession> {
    this.ready(); const id = randomUUID(), directory = path.join(this.options.directory, 'uploads', id); await mkdir(directory, { mode: 0o700 });
    try {
      let capture: CaptureResult, nativeSourceId: string;
      if (format === 'alink') {
        capture = await this.options.worker.run({ kind: 'import', path: input, destination: path.join(directory, 'archive') }, signal);
        const manifest = await readManifest(capture.archivePath), root = this.options.roots[manifest.source.app];
        if (!root || !manifest.session.native_id) throw new LinkError('SOURCE_INACTIVE');
        nativeSourceId = sourceKey(manifest.source.app, root, manifest.session.native_id);
      } else {
        let header; for await (const row of legacyRows(input, signal)) { header = row; break; }
        if (header?.version !== 0 || typeof header.id !== 'string' || !this.options.roots.dsh) throw new LinkError('UNSUPPORTED_SOURCE');
        nativeSourceId = sourceKey('dsh', this.options.roots.dsh, header.id);
        capture = await this.options.worker.run({ kind: 'legacy-file', roots: this.options.roots, sourceId: nativeSourceId, path: input, destination: path.join(directory, 'archive') }, signal);
      }
      const native = await this.options.worker.run<SourceLocator>({ kind: 'active', roots: this.options.roots, sourceId: nativeSourceId }, signal);
      const meta = await readManifest(capture.archivePath);
      await atomicJson(path.join(directory, 'source.json'), { nativeSourceId, archivePath: capture.archivePath, title: meta.session.title ?? native.title } satisfies UploadSource);
      return { sourceId: 'upload:' + id, app: native.app, nativeId: native.nativeId, title: meta.session.title ?? native.title, cwd: meta.session.cwd };
    } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
  }
  async close(): Promise<void> {
    if (!this.accepting) return;
    this.accepting = false;
    for (const job of this.jobs.values()) job.controller.abort();
    await Promise.allSettled([...this.jobs.values()].map(j => j.promise));
    await this.options.worker.close(); this.ledger.close();
  }
}
