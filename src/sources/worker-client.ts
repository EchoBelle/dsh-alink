import { Worker } from 'node:worker_threads';
import { LinkError } from '../transport.js';
import type { SourceRoots } from './types.js';
import type { SourceApp } from '../contracts.js';
export type ArchiveTask = { kind: 'validate'; path: string }
  | { kind: 'import'; path: string; destination: string }
  | { kind: 'export'; path: string; destination: string }
  | { kind: 'legacy-file'; roots: SourceRoots; sourceId: string; path: string; destination: string }
  | { kind: 'sources'; roots: SourceRoots }
  | { kind: 'sessions'; roots: SourceRoots; app: SourceApp; query?: { text?: string; cursor?: string; limit?: number } }
  | { kind: 'active'; roots: SourceRoots; sourceId: string }
  | { kind: 'capture'; roots: SourceRoots; resourceRoots?: readonly string[]; sourceId: string; destination: string };
export class WorkerRunner {
  private readonly active = new Set<Worker>();
  private closed = false;
  constructor(private readonly file: URL) {}
  run<T>(task: ArchiveTask, signal?: AbortSignal): Promise<T> {
    if (this.closed) return Promise.reject(new Error('Worker runner is closed'));
    signal?.throwIfAborted();
    return new Promise<T>((resolve, reject) => {
      const worker = new Worker(this.file);
      this.active.add(worker);
      let settled = false;
      const finish = async (error?: Error, value?: T) => {
        if (settled) return;
        settled = true; this.active.delete(worker); signal?.removeEventListener('abort', abort);
        await worker.terminate();
        if (error) reject(error); else resolve(value!);
      };
      const abort = () => { void finish(new Error('Operation canceled')); };
      signal?.addEventListener('abort', abort, { once: true });
      worker.once('message', result => { void finish(result.ok ? undefined : new LinkError(result.code ?? 'SOURCE_ERROR', result.error), result.value); });
      worker.once('error', error => { void finish(error); });
      worker.once('exit', () => { if (!settled) void finish(new Error('Worker stopped')); });
      worker.postMessage(task);
    });
  }
  async close(): Promise<void> {
    this.closed = true;
    await Promise.all([...this.active].map(worker => worker.terminate()));
  }
}
