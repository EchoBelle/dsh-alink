import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { build } from 'esbuild';
import { WorkerRunner } from '../../src/sources/worker-client.js';

it('performs archive work off the host and closes the worker after completion', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-worker-'));
  try {
    const workerFile = path.resolve('lib/source-worker.js');
    await build({ entryPoints: ['src/sources/worker.ts'], outfile: workerFile, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
    const runner = new WorkerRunner(new URL('../../lib/source-worker.js', import.meta.url));
    await expect(runner.run({ kind: 'validate', path: path.resolve('examples/demo.alink') })).resolves.toEqual({ valid: true });
    await runner.close();
    await expect(runner.run({ kind: 'validate', path: path.resolve('examples/demo.alink') })).rejects.toThrow(/closed/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('cancels an in-flight worker and settles its caller', async () => {
  const runner = new WorkerRunner(new URL('../../lib/source-worker.js', import.meta.url));
  const controller = new AbortController();
  const pending = runner.run({ kind: 'validate', path: path.resolve('examples/demo.alink') }, controller.signal);
  controller.abort();
  await expect(pending).rejects.toThrow(/canceled/);
  await runner.close();
});
