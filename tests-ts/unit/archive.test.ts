import { afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ArchiveBuilder, validateArchive, importArchive, exportArchive, readEvents } from '../../src/archive.js';
const roots: string[] = [];
async function temp() { const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-archive-')); roots.push(root); return root; }
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });

it('retains file bytes, large integers and visible Unicode through ZIP import', async () => {
  const root = await temp();
  const file = path.join(root, 'source.jsonl');
  const bytes = '{"type":"message","n":9007199254740993,"text":"你好\\n🐟"}\n';
  await writeFile(file, bytes);
  const b = await ArchiveBuilder.create(path.join(root, 'capture'), 'workbuddy', 'responses-jsonl', { native_id: 's1' });
  await b.originalFile(file);
  const ref = await b.record({ n: 9007199254740993n, unknown: null, empty: [], zero: 0, blob: { $binary: 'AQI=', encoding: 'base64' } }, { file: 'source.jsonl' });
  await b.event(ref, 'message', { role: 'user', content: [{ type: 'text', text: '你好\n🐟' }] });
  const result = await b.finish();
  await validateArchive(result.archivePath);
  const zip = path.join(root, 'saved.zip');
  await exportArchive(result.archivePath, zip);
  const copy = await importArchive(zip, path.join(root, 'unpacked'), new AbortController().signal);
  const m = JSON.parse(await readFile(path.join(copy.archivePath, 'manifest.json'), 'utf8'));
  expect(await readFile(path.join(copy.archivePath, m.original_files[0].path), 'utf8')).toBe(bytes);
  expect(await readFile(path.join(copy.archivePath, 'records.jsonl'), 'utf8')).toContain('9007199254740993');
  expect((await readEvents(copy.archivePath))[0].content).toEqual([{ type: 'text', text: '你好\n🐟' }]);
  expect(copy.snapshotDigest).toBe(result.snapshotDigest);
});

it('rejects corrupt streams and dangling resources rather than accepting partial history', async () => {
  const root = await temp();
  const b = await ArchiveBuilder.create(path.join(root, 'p'), 'codex', 'rollout-jsonl', { native_id: 'c1' });
  const ref = await b.record({}, {});
  await b.event(ref, 'message', { role: 'user', content: [{ type: 'resource', resource_id: 'missing' }] });
  await expect(b.finish()).rejects.toThrow(/resource/i);
});

it('refuses to overwrite an existing archive and refuses symbolic object links', async () => {
  const root = await temp();
  const b = await ArchiveBuilder.create(path.join(root, 'p'), 'codex', 'rollout-jsonl', { native_id: 'c1' });
  await expect(ArchiveBuilder.create(path.join(root, 'p'), 'codex', 'rollout-jsonl', {})).rejects.toThrow();
  const ref = await b.record({}, {});
  await b.resource('data:text/plain;base64,aGk=', ref, []);
  const { archivePath } = await b.finish();
  const m = JSON.parse(await readFile(path.join(archivePath, 'manifest.json'), 'utf8'));
  const obj = path.join(archivePath, m.resources[0].path);
  await rm(obj); await writeFile(path.join(root, 'elsewhere'), 'hi'); await symlink(path.join(root, 'elsewhere'), obj);
  await expect(validateArchive(archivePath)).rejects.toThrow();
});

it('rejects ZIP traversal and enforces extraction budgets', async () => {
  const root = await temp();
  const { default: yazl } = await import('yazl');
  const make = async (file: string, data: string) => {
    const zip = new yazl.ZipFile(); const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => { zip.outputStream.on('data', c => chunks.push(c)); zip.outputStream.on('end', () => resolve(Buffer.concat(chunks))); zip.outputStream.on('error', reject); });
    zip.addBuffer(Buffer.from(data), 'escape.txt'); zip.end(); await writeFile(file, await done);
  };
  const bad = path.join(root, 'bad.zip'); await make(bad, 'bad');
  const bytes = await readFile(bad); await writeFile(bad, Buffer.from(bytes.toString('latin1').replaceAll('escape.txt', '../bad.txt'), 'latin1'));
  await expect(importArchive(bad, path.join(root, 'unsafe'), new AbortController().signal)).rejects.toThrow();
  const bomb = path.join(root, 'large.zip'); await make(bomb, 'x'.repeat(100000));
  await expect(importArchive(bomb, path.join(root, 'limited'), new AbortController().signal, { maxBytes: 10000, maxEntries: 10 })).rejects.toThrow(/limit/i);
});

it('detects stream tampering after a successful capture', async () => {
  const root = await temp(); const b = await ArchiveBuilder.create(path.join(root, 'p'), 'codex', 'rollout-jsonl', {});
  const ref = await b.record({}, {}); await b.event(ref, 'message', { role: 'user', content: [{ type: 'text', text: 'original' }] });
  const result = await b.finish(); await writeFile(path.join(result.archivePath, 'events.jsonl'), '{}\n');
  await expect(validateArchive(result.archivePath)).rejects.toThrow(/Integrity/);
});

it('rejects unhashed resource paths before directory or ZIP-preview copying', async () => {
  const root = await temp(); const source = path.join(root, 'input'), destParent = path.join(root, 'output');
  const b = await ArchiveBuilder.create(source, 'workbuddy', 'responses-jsonl', { native_id: 'active' });
  const ref = await b.record({}, {}); await b.event(ref, 'message', { role: 'user', content: [{ type: 'text', text: 'safe' }] }); await b.finish();
  const manifestFile = path.join(source, 'manifest.json'), manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  manifest.resources.push({ id: 'external', uri: 'external:test', record_ref: ref, status: 'external', path: '../escape.txt' });
  await writeFile(manifestFile, JSON.stringify(manifest)); await writeFile(path.join(root, 'escape.txt'), 'private outside input');
  const { mkdir, stat } = await import('node:fs/promises'); await mkdir(destParent);
  await expect(validateArchive(source)).rejects.toThrow();
  await expect(importArchive(source, path.join(destParent, 'capture'), new AbortController().signal)).rejects.toThrow();
  await expect(stat(path.join(destParent, 'escape.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
});

it('rejects malicious manifest paths after ZIP extraction, before a later directory preview', async () => {
  const root = await temp(); const b = await ArchiveBuilder.create(path.join(root,'p'),'workbuddy','responses-jsonl',{ native_id:'s' });
  const ref = await b.record({},{}); await b.finish();
  const file = path.join(root,'p/manifest.json'), manifest = JSON.parse(await readFile(file,'utf8'));
  manifest.resources.push({ id:'rsc',uri:'external:test',record_ref:ref,status:'external',path:'../escape.txt' }); await writeFile(file,JSON.stringify(manifest));
  const { default: yazl } = await import('yazl'), zip = new yazl.ZipFile(); const chunks: Buffer[]=[];
  const done = new Promise<Buffer>((resolve,reject)=>{ zip.outputStream.on('data',c=>chunks.push(c));zip.outputStream.on('end',()=>resolve(Buffer.concat(chunks)));zip.outputStream.on('error',reject); });
  for(const name of ['manifest.json','events.jsonl','records.jsonl']) zip.addFile(path.join(root,'p',name),name); zip.end();
  const archive=path.join(root,'bad.zip');await writeFile(archive,await done);
  await expect(importArchive(archive,path.join(root,'unpacked'),new AbortController().signal)).rejects.toThrow(/reference|path/);
});
