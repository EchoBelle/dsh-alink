import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createSources } from '../tests-ts/helpers/fixtures.mjs';
const project = path.resolve('.');
const pkg = JSON.parse(await readFile(path.join(project, 'package.json'), 'utf8'));
const requested = process.argv[2] || `.local/releases/${pkg.name}-${pkg.version}.tgz`;
const fromGit = requested.startsWith('github:');
const packageFile = fromGit ? requested : path.resolve(requested);
const home = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-release-'));
const cli = process.env.DSH_ALINK_TEST_CLI || path.join(project, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
const env = { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, LANG: 'en_US.UTF-8', DSH_HOME: home };
const evidence = path.join(project, '.local/verification');
await mkdir(evidence, { recursive: true });
await mkdir(path.join(project, '.local/releases'), { recursive: true });
const summary = { home, cli, package: packageFile, source: fromGit ? 'github' : 'tarball', ...(fromGit ? {} : { sha256: createHash('sha256').update(await readFile(packageFile)).digest('hex') }), phase: 'setup' };
const save = async phase => { summary.phase=phase; await writeFile(path.join(project,'.local/releases/latest-smoke.json'),JSON.stringify(summary,null,2)); console.log(phase); };
async function run(command, args, options={}) {
  const child=spawn(command,args,{cwd:options.cwd||home,env:{...env,...options.env},stdio:['ignore','pipe','pipe']});
  const liveLog=options.log?createWriteStream(path.join(evidence,options.log)):undefined;
  let output=''; for(const stream of [child.stdout,child.stderr]) stream.on('data',b=>{output+=b;liveLog?.write(b);});
  const [code,signal]=await once(child,'exit');
  liveLog?.end();
  if(code!==0) throw new Error(`${path.basename(command)} failed (${code||signal}): ${output.slice(-5000)}`);
  return output;
}
let server;
async function start(label) {
  const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const log=createWriteStream(path.join(evidence,`release-${label}.log`));
  const child=spawn(process.execPath,[cli,'--profile','web','--patch',path.join(home,'web.patch.yml'),'--no-open','--port',String(port)],{cwd:home,env,stdio:['ignore','pipe','pipe']});
  server=child;
  await new Promise((resolve,reject)=>{
    let text='',ready=false;const timeout=setTimeout(()=>reject(new Error('DSH boot timed out')),45000);
    for(const stream of [child.stdout,child.stderr]) stream.on('data',bytes=>{
      log.write(bytes); text+=bytes.toString();
      const urls=text.match(new RegExp(`http://127\\.0\\.0\\.1:${port}[^\\s\\x1b]*`,'g'));
      if(urls?.length&&!ready){ready=true;clearTimeout(timeout);writeFile(path.join(home,'host.json'),JSON.stringify({url:urls.at(-1),pid:child.pid}),{mode:0o600}).then(resolve,reject);}
    });
    child.on('exit',code=>{log.end();clearTimeout(timeout);if(!ready)reject(new Error('DSH exited before boot: '+code));});
  });
}
async function stop() {
  if(!server||server.exitCode!==null)return;
  const child=server, exited=once(child,'exit');child.kill('SIGTERM');const timeout=setTimeout(()=>child.kill('SIGKILL'),15000);await exited;clearTimeout(timeout);server=undefined;
}
async function continuation(round,ids) {
  await rm(path.join(home,'continuation-result.json'),{force:true});
  await writeFile(path.join(home,'continuation-request.json'),JSON.stringify({round,ids}));
  await start(round);
  for(let i=0;i<300;i++){
    try{const value=JSON.parse(await readFile(path.join(home,'continuation-result.json'),'utf8'));if(!value.passed)throw new Error(value.error);if(value.round===round)return value;}catch(error){if(error.code!=='ENOENT')throw error;}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Native continuation timed out');
}
try {
  await save('Preparing clean DSH home');
  summary.dshVersion = (await run(process.execPath, [cli, '--version'])).trim();
  await writeFile(path.join(home,'package.json'),JSON.stringify({name:'dsh-alink-release-fixture',private:true,type:'module',peerDependencies:pkg.peerDependencies}));
  await writeFile(path.join(home,'.dsh-alink-test'),'synthetic data only');
  const roots=await createSources(home);
  await build({entryPoints:[path.join(project,'tests-ts/helpers/crash-reservation.ts')],outfile:path.join(home,'crash-reservation.mjs'),bundle:true,platform:'node',format:'esm'});
  await build({entryPoints:[path.join(project,'tests-ts/helpers/package-probe.ts')],outfile:path.join(home,'package-probe.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'test-host-sdk',setup(builder){builder.onResolve({filter:/^@deepseek-ai\//},args=>({path:pathToFileURL(createRequire(import.meta.url).resolve(args.path)).href,external:true}));}}]});
  await run(process.execPath,[cli,'--profile','web','--dump-config'],{log:'release-default-config.log'});
  await writeFile(path.join(home,'profiles/web/.npmrc'),'store-dir=/tmp/dsh-alink-pnpm-store\n');
  await save('Installing plugin through dsh plugin into clean profile');
  await run(process.execPath,[cli,'plugin','--profile','web','add','--workspace-root',packageFile],{log:'release-install.log'});
  const manifest=JSON.parse(await readFile(path.join(home,'profiles/web/package.json'),'utf8'));
  const dependency = String(manifest.dependencies?.['dsh-alink']);
  if (!manifest.dsh.profile.bundles.includes('dsh-alink') || dependency.startsWith('link:') || (fromGit ? !/github|codeload/.test(dependency) : !dependency.startsWith('file:'))) throw new Error('Profile must install the requested remote or packed dependency, not a source link');
  summary.installedDependency = dependency;
  const installedRoot = path.join(home, 'profiles/web/node_modules/dsh-alink');
  for (const file of ['lib/index.js', 'lib/client.js', 'lib/source-worker.js']) {
    if (createHash('sha256').update(await readFile(path.join(installedRoot, file))).digest('hex') !== createHash('sha256').update(await readFile(path.join(project, file))).digest('hex')) throw new Error('Installed artifact differs: ' + file);
  }
  await writeFile(path.join(home,'web.patch.yml'),[
    '- id: session-log-deepseek\n  disabled: true','- id: session-telemetry-otel\n  disabled: true','- id: desktop-product-telemetry\n  disabled: true','- id: product-analytics\n  disabled: true',
    `- insert:\n    - id: package-probe\n      name: ${JSON.stringify(path.join(home,'package-probe.mjs'))}`,
    `- id: dsh-alink\n  config:\n    dataDir: ${JSON.stringify(path.join(home,'link-data'))}\n    sourceRoots:\n${Object.entries(roots).map(([key,value])=>'      '+key+': '+JSON.stringify(value)).join('\n')}`,
  ].join('\n')+'\n');
  await start('import');await save('Testing four source applications through native UI');
  await run(path.join(project,'node_modules/.bin/playwright'),['test','tests-ts/e2e/00-batch.spec.ts','tests-ts/e2e/all-sources.spec.ts','tests-ts/e2e/archive-guard.spec.ts','tests-ts/e2e/recovery-ui.spec.ts','tests-ts/e2e/plugin-shell.spec.ts','tests-ts/e2e/presentation.spec.ts','tests-ts/e2e/ui-feedback.spec.ts','tests-ts/e2e/multi-selection.spec.ts'],{cwd:project,env:{DSH_ALINK_TEST_HOME:home,DSH_ALINK_PACKAGE_MATRIX:'1'},log:'release-browser.log'});
  await stop();
  const db=new DatabaseSync(path.join(home,'link-data/operations.sqlite'),{readOnly:true});
  const ops=db.prepare('SELECT value FROM operations').all().map(row=>JSON.parse(row.value));db.close();
  const ids=ops.filter(op=>op.state==='completed'&&op.title!=='恢复入口验收').map(op=>op.targetSessionId);
  if(ids.length!==5)throw new Error('Expected four external sources plus legacy DSH, got '+ids.length);
  await save('Cold-resuming installed-package conversations through native DSH');
  summary.installedContinuation=await continuation('installed',ids);await stop();
  await save('Removing dsh-alink and validating native continuation again');
  await run(process.execPath,[cli,'plugin','--profile','web','remove','--workspace-root','dsh-alink'],{log:'release-remove.log'});
  const patch=(await readFile(path.join(home,'web.patch.yml'),'utf8')).split('\n- id: dsh-alink\n')[0]+'\n';await writeFile(path.join(home,'web.patch.yml'),patch);
  summary.removedContinuation=await continuation('removed',ids);
  await run(path.join(project,'node_modules/.bin/playwright'),['test','tests-ts/e2e/plugin-disabled.spec.ts'],{cwd:project,env:{DSH_ALINK_TEST_HOME:home,DSH_ALINK_DISABLED:'1'},log:'release-browser-removed.log'});
  await stop();
  summary.sourceImports=5;summary.passed=true;await save('Release package verification passed');
} finally { await stop(); }
