import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Ledger } from '../../src/ledger.js';
const [file, previewId, dedup, output] = process.argv.slice(2);
if (!file || !existsSync(path.join(path.dirname(path.dirname(file)), '.dsh-alink-test'))) throw new Error('Refusing non-test ledger');
const ledger = new Ledger(file);
const op = ledger.reserve(previewId, dedup, 'crash-' + previewId, '恢复入口验收');
writeFileSync(output, JSON.stringify(op));
await ledger.withWriter(async () => { process.kill(process.pid, 'SIGKILL'); await new Promise(() => {}); });
