import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const version = JSON.parse(readFileSync(require.resolve('@deepseek-ai/dsh/package.json'), 'utf8')).version;
if (version !== '0.2.1-rc.5' || Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Expected DSH 0.2.1-rc.5 and Node 24');
console.log(`DSH ${version}; Node ${process.versions.node}`);
