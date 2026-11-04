import { parentPort } from 'node:worker_threads';
import { validateArchive, importArchive, exportArchive } from '../archive.js';
import { captureLegacy } from './dsh-legacy.js';
import { SourceRegistry } from './registry.js';
import type { ArchiveTask } from './worker-client.js';
parentPort!.once('message', async (task: ArchiveTask) => {
  try {
    let value: unknown;
    if (task.kind === 'legacy-file') {
      const source = await new SourceRegistry(task.roots).assertActive(task.sourceId);
      value = await captureLegacy({ ...source, file: task.path }, task.destination);
    }
    else if (task.kind === 'sources') value = await new SourceRegistry(task.roots).sources();
    else if (task.kind === 'sessions') value = await new SourceRegistry(task.roots).sessions(task.app, task.query);
    else if (task.kind === 'active') value = await new SourceRegistry(task.roots).assertActive(task.sourceId);
    else if (task.kind === 'capture') value = await new SourceRegistry(task.roots, task.resourceRoots).capture(task.sourceId, task.destination);
    else if (task.kind === 'validate') { await validateArchive(task.path); value = { valid: true }; }
    else if (task.kind === 'import') value = await importArchive(task.path, task.destination, new AbortController().signal);
    else { await exportArchive(task.path, task.destination); value = { file: task.destination }; }
    parentPort!.postMessage({ ok: true, value });
  } catch (error) { parentPort!.postMessage({ ok: false, code: error && typeof error === 'object' && 'code' in error ? error.code : 'SOURCE_ERROR', error: error instanceof Error ? error.message : 'Worker failed' }); }
  finally { parentPort!.close(); }
});
