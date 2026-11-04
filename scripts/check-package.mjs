import { execFileSync } from 'node:child_process';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
await mkdir('.local/releases', { recursive: true });
const file = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve('.local/releases/dsh-alink-0.1.0.tgz');
if (!process.argv[2]) {
  execFileSync('pnpm', ['build'], { stdio: 'pipe' });
  execFileSync('pnpm', ['pack', '--pack-destination', '.local/releases'], { stdio: 'pipe' });
}
const files = execFileSync('tar', ['-tzf', file], { encoding: 'utf8' }).trim().split('\n');
for (const name of files) {
  if (!/^package\/(package\.json|README\.md|cordis\.patch\.yml|lib\/|schemas\/)/.test(name) || /\/(legacy|\.local|node_modules|tests-ts)\//.test(name) || /\.(py|sqlite|jsonl|aiff)$/.test(name)) throw new Error('Unexpected release file: ' + name);
}
for (const name of ['lib/index.js','lib/client.js','lib/source-worker.js','lib/types/index.d.ts','lib/types/client/index.d.ts','schemas/manifest.json','cordis.patch.yml']) if (!files.includes('package/'+name)) throw new Error('Missing release file: '+name);
const pkg = JSON.parse(execFileSync('tar', ['-xOf', file, 'package/package.json'], { encoding: 'utf8' }));
if (pkg.name !== 'dsh-alink' || pkg.version !== '0.1.0' || pkg.bin || pkg.engines.dsh !== '0.2.1-rc.5') throw new Error('Invalid release manifest');
const client = execFileSync('tar', ['-xOf', file, 'package/lib/client.js'], { encoding: 'utf8' });
const vm = await import('node:vm'); let registration;
vm.runInNewContext(client, { window: { __ModuleLoader__: { load(value) { registration = value; } } } });
if (registration?.id !== 'dsh-alink' || typeof registration.factory !== 'function') throw new Error('Browser module did not register lazily');
console.log(JSON.stringify({ package: file, files: files.length, bytes: (await stat(file)).size, lazyClient: true, standaloneRuntime: false }, null, 2));
