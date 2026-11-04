import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { SourceRegistry } from '../../src/sources/registry.js';
import { sourceKey } from '../../src/sources/types.js';
import { readEvents, readManifest } from '../../src/archive.js';
const roots: string[] = [];
async function temp() { const p = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-sources-')); roots.push(p); return p; }
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function jsonl(file: string, rows: unknown[]) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, rows.map(r => JSON.stringify(r)).join('\n') + '\n'); }

it('WorkBuddy excludes archived/deleted/orphan files and rechecks before capture', async () => {
  const root = await temp(), wb = path.join(root, 'wb'); await mkdir(wb);
  const db = new DatabaseSync(path.join(wb, 'workbuddy.db'));
  db.exec('create table sessions(id text,title text,custom_title text,cwd text,status text,deleted_at integer,updated_at integer)');
  for (const [id, status, deleted] of [['active', 'completed', null], ['archived', 'archived', null], ['deleted', 'completed', 1]] as const) {
    db.prepare('insert into sessions values (?,?,?,?,?,?,?)').run(id, id, null, root, status, deleted, 10);
  }
  for (const id of ['active', 'archived', 'deleted', 'orphan']) await jsonl(path.join(wb, 'projects/p', id + '.jsonl'), [
    { id: 'm1', sessionId: id, type: 'message', role: 'user', content: [{ type: 'input_text', text: '你好\nsecond' }] },
  ]);
  const registry = new SourceRegistry({ workbuddy: wb });
  const list = await registry.sessions('workbuddy');
  expect(list.items.map(x => x.nativeId)).toEqual(['active']);
  await expect(registry.capture(sourceKey('workbuddy', wb, 'archived'), path.join(root, 'bad'))).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
  const capture = await registry.capture(list.items[0].sourceId, path.join(root, 'capture'));
  expect((await readManifest(capture.archivePath)).session.cwd).toBe(root);
  expect((await readEvents(capture.archivePath)).filter(e => e.kind === 'message')[0].content).toEqual([{ type: 'text', text: '你好\nsecond' }]);
  db.prepare("update sessions set status='archived' where id='active'").run();
  await expect(registry.assertActive(list.items[0].sourceId)).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
  db.close();
});

it('Codex only lists active main sessions and never duplicates mirror messages', async () => {
  const root = await temp(), codex = path.join(root, 'codex'); await mkdir(codex);
  const db = new DatabaseSync(path.join(codex, 'state_5.sqlite'));
  db.exec('create table threads(id text,title text,name text,cwd text,rollout_path text,updated_at integer,archived integer,source text,thread_source text)');
  for (const [id, archived, kind] of [['live', 0, 'user'], ['old', 1, 'user'], ['child', 0, 'subagent']] as const) {
    const file = path.join(codex, 'sessions', id + '.jsonl');
    db.prepare('insert into threads values (?,?,?,?,?,?,?,?,?)').run(id, id, '', root, file, 1, archived, 'vscode', kind);
    await jsonl(file, [
      { type: 'session_meta', payload: { id, cwd: root } },
      { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'one' }] } },
      { type: 'event_msg', payload: { type: 'user_message', message: 'one' } },
      { type: 'response_item', payload: { type: 'custom_tool_call', call_id: 'x', name: 'edit', input: 'raw patch' } },
      { type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'x', output: 'done' } },
    ]);
  }
  db.close(); const registry = new SourceRegistry({ codex });
  const list = await registry.sessions('codex'); expect(list.items.map(x => x.nativeId)).toEqual(['live']);
  await expect(registry.capture(sourceKey('codex', codex, 'old'), path.join(root, 'blocked'))).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
  const capture = await registry.capture(list.items[0].sourceId, path.join(root, 'capture'));
  const events = await readEvents(capture.archivePath);
  expect(events.filter(e => e.kind === 'message')).toHaveLength(1);
  expect(events.find(e => e.kind === 'tool_call')!.content[0]).toMatchObject({ argument_encoding: 'text', arguments: 'raw patch' });
  const second = await registry.capture(list.items[0].sourceId, path.join(root, 'second'));
  expect(second.snapshotDigest).toBe(capture.snapshotDigest);
});

it('marks unresolved Codex history and rejects missing archival status', async () => {
  const root = await temp(), codex = path.join(root, 'codex'); await mkdir(codex);
  const db = new DatabaseSync(path.join(codex, 'state_9.sqlite'));
  const file = path.join(codex, 'sessions/live.jsonl');
  db.exec('create table threads(id text,title text,cwd text,rollout_path text,updated_at integer,archived integer)');
  db.prepare('insert into threads values (?,?,?,?,?,?)').run('live', 'Live', root, file, 1, 0); db.close();
  await jsonl(file, [{ type: 'session_meta', payload: { id: 'live', history_base: { session_id: 'missing' } } }, { type: 'compacted', content: 'summary' }]);
  const registry = new SourceRegistry({ codex });
  const source = (await registry.sessions('codex')).items[0];
  const capture = await registry.capture(source.sourceId, path.join(root, 'capture'));
  expect((await readManifest(capture.archivePath)).issues.map(x => x.code)).toContain('unresolved_history');
  await expect(registry.sessions('codex', { limit: 101 })).rejects.toThrow();
  await expect(registry.capture('../../private', path.join(root, 'bad'))).rejects.toThrow();
});

it('keeps Codex auxiliary rows and rejects sessions whose archive state is unknown', async () => {
  const root = await temp(), codex = path.join(root, 'codex'); await mkdir(codex);
  const db = new DatabaseSync(path.join(codex, 'state_5.sqlite'));
  const file = path.join(codex, 'sessions/s.jsonl');
  db.exec('create table threads(id text,title text,cwd text,rollout_path text,archived integer,counter integer)');
  db.prepare('insert into threads values (?,?,?,?,?,?)').run('s', 'S', root, file, 0, 9007199254740993n); db.close();
  const auxiliary = new DatabaseSync(path.join(codex, 'thread_history_1.sqlite'));
  auxiliary.exec('create table thread_items(thread_id text,value text);'); auxiliary.prepare('insert into thread_items values (?,?)').run('s', 'retained-sidecar'); auxiliary.close();
  await jsonl(file, [{ type: 'session_meta', payload: { id: 's' } }]);
  const registry = new SourceRegistry({ codex }); const src = (await registry.sessions('codex')).items[0];
  const capture = await registry.capture(src.sourceId, path.join(root, 'p'));
  const raw = await readFile(path.join(capture.archivePath, 'records.jsonl'), 'utf8');
  expect(raw).toContain('retained-sidecar'); expect(raw).toContain('9007199254740993'); expect(raw).toContain('CREATE TABLE');
  const change = new DatabaseSync(path.join(codex, 'state_5.sqlite'));
  change.exec('alter table threads drop column archived'); change.close();
  expect((await registry.sessions('codex')).items).toHaveLength(0);
  await expect(registry.assertActive(src.sourceId)).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
});

it('requires explicit per-row archive status rather than trusting the column alone', async () => {
  const root = await temp(), codex = path.join(root, 'codex'); await mkdir(codex);
  const db = new DatabaseSync(path.join(codex, 'state_5.sqlite'));
  db.exec('create table threads(id text,title text,cwd text,rollout_path text,archived)');
  for (const [id, archived] of [['null', null], ['empty', ''], ['unknown', 'maybe'], ['valid', 0]] as const) {
    const file = path.join(codex, 'sessions', id+'.jsonl'); await jsonl(file, [{ type: 'session_meta', payload: { id } }]);
    db.prepare('insert into threads values (?,?,?,?,?)').run(id,id,root,file,archived);
  } db.close();
  const registry = new SourceRegistry({ codex });
  expect((await registry.sessions('codex')).items.map(x => x.nativeId)).toEqual(['valid']);
  for (const id of ['null','empty','unknown']) await expect(registry.assertActive(sourceKey('codex',codex,id))).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
});

it('WorkBuddy missing, empty and unrecognized status values are not active', async () => {
  const root = await temp(), wb = path.join(root,'wb'); await mkdir(wb);
  const db = new DatabaseSync(path.join(wb,'workbuddy.db'));
  db.exec('create table sessions(id text,status,deleted_at integer,title text)');
  for(const [id,status] of [['null',null],['empty',''],['unknown','mystery'],['valid','completed']] as const) {
    db.prepare('insert into sessions values (?,?,?,?)').run(id,status,null,id); await jsonl(path.join(wb,'projects/p',id+'.jsonl'),[{type:'message',role:'user',content:'text'}]);
  } db.close(); const registry = new SourceRegistry({workbuddy:wb});
  expect((await registry.sessions('workbuddy')).items.map(x=>x.nativeId)).toEqual(['valid']);
  await expect(registry.assertActive(sourceKey('workbuddy',wb,'null'))).rejects.toMatchObject({code:'SOURCE_INACTIVE'});
});
