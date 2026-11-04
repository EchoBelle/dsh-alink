import { mkdir, readFile, readdir, rm, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Transfer, TransferRequest } from './contracts.js';
import { MigrationService, atomicJson } from './operations.js';
import { LinkError } from './transport.js';
import { digest } from './dsh/history.js';

interface StoredTransfer extends Transfer { request: TransferRequest; requestHash: string; archives: Record<string, string>; previews: Record<string, string> }
const unfinished = (job: Transfer) => ['queued', 'running'].includes(job.state);
const codeOf = (error: unknown) => error instanceof LinkError ? error.code : 'IMPORT_FAILED';
export class Transfers {
  private readonly values = new Map<string, StoredTransfer>();
  private readonly controllers = new Map<string, AbortController>();
  private tail: Promise<void> = Promise.resolve();
  private closed = false;
  private constructor(readonly directory: string, private readonly service: MigrationService) {}
  static async create(directory: string, service: MigrationService): Promise<Transfers> {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const transfers = new Transfers(directory, service);
    for (const name of await readdir(directory)) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
      const value: StoredTransfer = JSON.parse(await readFile(path.join(directory, name), 'utf8'));
      if (unfinished(value)) {
        value.state = 'failed'; value.errorCode = 'INTERRUPTED';
        for (const item of value.items) if (['pending', 'running'].includes(item.state)) { item.state = 'failed'; item.errorCode = 'INTERRUPTED'; }
        await transfers.save(value);
      }
      transfers.values.set(value.id, value);
    }
    return transfers;
  }
  private save(value: StoredTransfer) { return atomicJson(path.join(this.directory, value.id + '.json'), value); }
  private public(value: StoredTransfer): Transfer {
    const { request: _request, requestHash: _hash, archives: _archives, previews: _previews, ...result } = value;
    return structuredClone(result);
  }
  list(): Transfer[] { return [...this.values.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 100).map(value => this.public(value)); }
  get(id: string): Transfer { return this.public(this.stored(id)); }
  private stored(id: string): StoredTransfer { const value = this.values.get(id); if (!value) throw new LinkError('TRANSFER_NOT_FOUND'); return value; }
  async start(request: TransferRequest): Promise<Transfer> {
    if (this.closed) throw new LinkError('PLUGIN_CLOSED');
    const requestHash = digest(request), existing = this.values.get(request.requestId);
    if (existing) { if (existing.requestHash !== requestHash) throw new LinkError('REQUEST_CONFLICT'); return this.public(existing); }
    const value: StoredTransfer = { id: request.requestId, kind: request.kind, state: 'queued', createdAt: Date.now(), request, requestHash, archives: {}, previews: {},
      items: [...new Set(request.sourceIds)].map(sourceId => ({ sourceId, title: request.titles && Object.hasOwn(request.titles, sourceId) ? request.titles[sourceId] : '', state: 'pending' })) };
    this.values.set(value.id, value);
    try { await this.save(value); } catch (error) { this.values.delete(value.id); throw error; }
    this.enqueue(value);
    return this.public(value);
  }
  private enqueue(value: StoredTransfer) {
    const controller = new AbortController(); this.controllers.set(value.id, controller);
    this.tail = this.tail.then(() => this.run(value, controller.signal)).finally(() => this.controllers.delete(value.id));
    // run records failures; this keeps later queued work available if a storage write itself failed.
    this.tail = this.tail.catch(() => { value.state = 'failed'; value.errorCode = 'IMPORT_FAILED'; });
  }
  async retry(id: string): Promise<Transfer> {
    if (this.closed) throw new LinkError('PLUGIN_CLOSED');
    const value = this.stored(id);
    if (unfinished(value)) return this.public(value);
    for (const item of value.items) if (item.state !== 'completed') { item.state = 'pending'; delete item.errorCode; }
    value.state = 'queued'; delete value.errorCode; value.downloadable = false;
    await this.save(value); this.enqueue(value); return this.public(value);
  }
  cancel(id: string): Transfer { this.controllers.get(id)?.abort(); return this.get(id); }
  async download(id: string): Promise<string> {
    const value = this.stored(id);
    if (value.kind !== 'export' || !value.downloadable) throw new LinkError('EXPORT_NOT_READY');
    for (const item of value.items) if (item.state === 'completed') await this.service.source(item.sourceId);
    const file = path.join(this.directory, id, 'export.zip'); await stat(file); return file;
  }
  private async run(value: StoredTransfer, signal: AbortSignal): Promise<void> {
    const folder = path.join(this.directory, value.id);
    try {
      await mkdir(folder, { recursive: true, mode: 0o700 });
      value.state = 'running'; await this.save(value);
      for (const [index, item] of value.items.entries()) {
        if (item.state === 'completed') continue;
        if (signal.aborted) { item.state = 'canceled'; continue; }
        item.state = 'running'; await this.save(value);
        try {
          const source = await this.service.source(item.sourceId, signal); item.title = source.title;
          if (value.kind === 'import') {
            let operation;
            if (item.operationId) operation = await this.service.retryOperation(item.operationId);
            else {
              const target = value.request.target!;
              if (!target.cwd && !source.cwd) throw new LinkError('INVALID_TARGET');
              const savedId = value.previews[item.sourceId];
              const preview = savedId ? this.service.previewPage(savedId).preview! : await this.service.preview(item.sourceId, { cwd: target.cwd || source.cwd!, agentPreset: target.agentPreset }, signal);
              if (preview.report.counts.blocked) throw new LinkError('HISTORY_BLOCKED');
              if (preview.report.issues.some(issue => ['missing_dialogue_history', 'unresolved_history', 'external_history_base'].includes(issue.code) && issue.disposition === 'missing')) item.warning = '较早的来源记录已不可用，已迁入当前可读取的对话。';
              value.previews[item.sourceId] = preview.previewId; await this.save(value);
              operation = await this.service.commit({ previewId: preview.previewId, reportHash: preview.report.reportHash, requestId: value.id + ':' + index });
            }
            item.operationId = operation.operationId; await this.save(value);
            operation = await this.service.wait(operation.operationId, signal);
            if (operation.state !== 'completed') throw new LinkError(operation.errorCode || 'IMPORT_FAILED');
          } else {
            const destination = path.join(folder, 'source-' + index); await rm(destination, { recursive: true, force: true });
            const capture = await this.service.captureSource(item.sourceId, destination, signal);
            value.archives[item.sourceId] = capture.archivePath;
          }
          item.state = 'completed'; delete item.errorCode;
        } catch (error) { item.state = signal.aborted ? 'canceled' : 'failed'; item.errorCode = signal.aborted ? 'CANCELED' : codeOf(error); }
        await this.save(value);
      }
      if (value.kind === 'export' && !signal.aborted) {
        for (const item of value.items) if (item.state === 'completed') {
          try { await this.service.source(item.sourceId, signal); }
          catch (error) { item.state = 'failed'; item.errorCode = signal.aborted ? 'CANCELED' : codeOf(error); }
        }
        const roots = value.items.filter(item => item.state === 'completed').map(item => value.archives[item.sourceId]);
        if (roots.length) {
          const temporary = path.join(folder, 'export-' + randomUUID() + '.tmp');
          try {
            await this.service.options.worker.run({ kind: 'export-many', paths: roots, destination: temporary }, signal);
            await rename(temporary, path.join(folder, 'export.zip')); value.downloadable = true;
          } finally { await rm(temporary, { force: true }); }
        }
      }
      const successes = value.items.filter(item => item.state === 'completed').length;
      value.state = signal.aborted ? 'canceled' : successes === value.items.length ? 'completed' : successes ? 'partial' : 'failed';
    } catch (error) { value.state = signal.aborted ? 'canceled' : 'failed'; value.errorCode = codeOf(error); }
    finally { await this.save(value); }
  }
  async close(): Promise<void> { this.closed = true; for (const controller of this.controllers.values()) controller.abort(); await this.tail; }
}
