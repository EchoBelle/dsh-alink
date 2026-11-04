import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.env.DSH_ALINK_TEST_HOME || '.local/dsh-alink-contract-home');
mkdirSync(root, { recursive: true });
mkdirSync(resolve('.local/verification'), { recursive: true });
const log = createWriteStream(resolve('.local/verification/web.log'));
const child = spawn(process.execPath, [resolve('node_modules/@deepseek-ai/dsh/lib/bin.js'), '--profile', 'web', '--patch', resolve(process.env.DSH_ALINK_TEST_PATCH || 'tests-ts/helpers/web.patch.yml'), '--no-open', '--port', '31873'], {
  cwd: root, env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, LANG: 'en_US.UTF-8', DSH_HOME: root }, stdio: ['ignore', 'pipe', 'pipe']
});
let text = '', reported = false;
for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => {
  log.write(bytes); text += bytes.toString();
  const urls = text.match(/http:\/\/127\.0\.0\.1:31873[^\s\x1b]*/g);
  if (urls?.length) {
    const url = urls.at(-1);
    writeFileSync(root + '/host.json', JSON.stringify({ url, pid: child.pid }));
    if (!reported) { process.stdout.write('DSH test Web host ready on loopback port 31873\n'); reported = true; }
  }
});
child.on('exit', code => { log.end(); process.stdout.write(`DSH test Web host exited: ${code}\n`); process.exitCode = code ?? 1; });
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
