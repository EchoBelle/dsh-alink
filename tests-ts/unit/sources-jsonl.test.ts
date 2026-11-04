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
  await expect(registry.capture(source.sourceId, path.join(root, 'capture'))).rejects.toMatchObject({ code: 'SOURCE_HISTORY_MISSING' });
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

it('reconstructs paginated Codex dialogue to the exact history cutoff and permits context compaction', async () => {
  const root = await temp(), codex = path.join(root, 'codex'), id = '00000000-0000-4000-8000-000000000001';
  await mkdir(codex);
  const previous = path.join(codex, 'sessions/old/rollout-' + id + '.jsonl');
  const current = path.join(codex, 'sessions/new/rollout-' + id + '.jsonl');
  const message = (role: string, text: string) => ({ type: 'response_item', payload: { type: 'message', role, content: [{ type: 'input_text', text }] } });
  const prefix = [{ type: 'session_meta', payload: { id } }, message('user', 'earlier question'), message('assistant', 'earlier answer')];
  const bytes = Buffer.byteLength(prefix.map(row => JSON.stringify(row)).join('\n') + '\n');
  await jsonl(previous, [...prefix, message('user', 'beyond the fork cutoff')]);
  await jsonl(current, [{ type: 'session_meta', payload: { id, history_mode: 'paginated', history_base: { thread_id: id, end_byte_offset: bytes, end_ordinal_exclusive: prefix.length } } },
    { type: 'compacted', message: 'private model summary' }, message('user', 'current question'), message('assistant', 'current answer')]);
  const db = new DatabaseSync(path.join(codex, 'state_5.sqlite'));
  db.exec('CREATE TABLE threads(id TEXT,title TEXT,cwd TEXT,rollout_path TEXT,archived INTEGER)');
  db.prepare('INSERT INTO threads VALUES (?,?,?,?,?)').run(id, 'Paged', root, current, 0); db.close();
  const registry = new SourceRegistry({ codex });
  const capture = await registry.capture((await registry.sessions('codex')).items[0].sourceId, path.join(root, 'capture'));
  const { buildMigrationPlan } = await import('../../src/mapping.js');
  const plan = await buildMigrationPlan(capture.archivePath, { cwd: root, agentPreset: 'standard' });
  expect(plan.report.counts.blocked).toBe(0);
  expect(plan.messages.flatMap(m => m.content.map(b => b.type === 'text' ? b.text : ''))).toEqual(['earlier question', 'earlier answer', 'current question', 'current answer']);
  const manifest = await readManifest(capture.archivePath);
  for (const file of manifest.original_files) expect(await readFile(path.join(capture.archivePath, file.path), 'utf8')).not.toContain('beyond the fork cutoff');
});

it('recovers inherited dialogue from the native index when the prior rollout is no longer on disk', async () => {
  const root = await temp(), codex = path.join(root, 'codex'), parent = '00000000-0000-4000-8000-000000000001', id = '00000000-0000-4000-8000-000000000002';
  await mkdir(codex); const file = path.join(codex, 'sessions/rollout-' + id + '.jsonl');
  await jsonl(file, [{ type: 'session_meta', payload: { id, history_base: { thread_id: parent, end_byte_offset: 1000, end_ordinal_exclusive: 10 } } }, { type: 'response_item', payload: { type: 'message', role: 'user', content: 'current question' } }]);
  const db = new DatabaseSync(path.join(codex, 'state_5.sqlite'));
  db.exec('CREATE TABLE threads(id TEXT,title TEXT,cwd TEXT,rollout_path TEXT,archived INTEGER)');
  db.prepare('INSERT INTO threads VALUES (?,?,?,?,?)').run(id, 'Inherited', root, file, 0); db.close();
  const index = new DatabaseSync(path.join(codex, 'thread_history_1.sqlite'));
  index.exec('CREATE TABLE thread_items(thread_id TEXT,item_id TEXT,rollout_ordinal INTEGER,updated_at_ordinal INTEGER,item_type TEXT,item_json TEXT,created_at_ms INTEGER)');
  for (const [ordinal, updated, type, data] of [
    [1, 1, 'userMessage', { content: [{ type: 'text', text: 'indexed question' }] }],
    [2, 2, 'agentMessage', { text: 'indexed answer' }],
    [3, 3, 'commandExecution', { aggregatedOutput: 'tool output' }],
    [4, 11, 'agentMessage', { text: 'answer changed after the cutoff' }],
  ] as const) index.prepare('INSERT INTO thread_items VALUES (?,?,?,?,?,?,?)').run(parent, String(ordinal), ordinal, updated, type, JSON.stringify(data), 1);
  index.close();
  const registry = new SourceRegistry({ codex }), capture = await registry.capture((await registry.sessions('codex')).items[0].sourceId, path.join(root, 'capture'));
  const { buildMigrationPlan } = await import('../../src/mapping.js');
  const plan = await buildMigrationPlan(capture.archivePath, { cwd: root, agentPreset: 'standard' });
  expect(plan.messages.flatMap(m => m.content.map(b => b.type === 'text' ? b.text : ''))).toEqual(['indexed question', 'indexed answer', 'current question']);
  expect(plan.report.counts.blocked).toBe(0);
});
