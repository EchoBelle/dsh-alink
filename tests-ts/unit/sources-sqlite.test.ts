import { afterEach, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SourceRegistry } from '../../src/sources/registry.js';
import { sourceKey } from '../../src/sources/types.js';
import { readEvents, readManifest } from '../../src/archive.js';
const roots: string[] = [];
async function temp() { const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-sqlite-')); roots.push(root); return root; }
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });

it('Raccoon includes only available sessions and excludes inactive message versions', async () => {
  const root = await temp(), raccoon = path.join(root, 'raccoon'); await mkdir(raccoon);
  const db = new DatabaseSync(path.join(raccoon, 'local-chat.sqlite3'));
  db.exec('create table sessions(id text,title text,workspace_dir text,available integer,updated_at_ms integer); create table messages(id text,session_id text,seq integer,type text,role text,payload_json text,created_at_ms integer,active integer,visible integer,turn_id text)');
  db.prepare('insert into sessions values (?,?,?,?,?)').run('live', 'Live', root, 1, 10);
  db.prepare('insert into sessions values (?,?,?,?,?)').run('archive', 'Archive', root, 0, 20);
  for (const [id, seq, active, text] of [['z', 1, 1, 'first\n中文'], ['a', 2, 0, 'superseded']] as const) {
    db.prepare('insert into messages values (?,?,?,?,?,?,?,?,?,?)').run(id, 'live', seq, 'text', 'user', JSON.stringify({ content: text, extra: null }), 10, active, 1, 't');
  }
  const registry = new SourceRegistry({ raccoon });
  const list = await registry.sessions('raccoon'); expect(list.items.map(x => x.nativeId)).toEqual(['live']);
  await expect(registry.capture(sourceKey('raccoon', raccoon, 'archive'), path.join(root, 'bad'))).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
  const result = await registry.capture(list.items[0].sourceId, path.join(root, 'capture'));
  const events = (await readEvents(result.archivePath)).filter(e => e.kind === 'message');
  expect(events.map(e => e.content[0].text)).toEqual(['first\n中文', 'superseded']);
  expect(events[1].active).toBe(false);
  db.prepare('update sessions set available=0 where id=?').run('live'); db.close();
  await expect(registry.assertActive(list.items[0].sourceId)).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
});

it('Cursor hides archived sessions, orders bubbles by headers and preserves inactive tools', async () => {
  const root = await temp(), cursor = path.join(root, 'cursor'); await mkdir(path.join(cursor, 'User/globalStorage'), { recursive: true });
  const db = new DatabaseSync(path.join(cursor, 'User/globalStorage/state.vscdb'));
  db.exec('create table composerHeaders(composerId text,value text,isArchived integer,isSubagent integer,lastUpdatedAt integer); create table cursorDiskKV(key text,value)');
  for (const [id, archived] of [['live', 0], ['old', 1]] as const) {
    const meta = { name: id, workspaceIdentifier: { folder: 'file://' + root }, fullConversationHeadersOnly: [{ bubbleId: 'z' }, { bubbleId: 'a' }] };
    db.prepare('insert into composerHeaders values (?,?,?,?,?)').run(id, JSON.stringify(meta), archived, 0, 10);
    db.prepare('insert into cursorDiskKV values (?,?)').run('composerData:' + id, JSON.stringify(meta));
  }
  for (const [id, type, text] of [['a', 2, 'second'], ['z', 1, 'first'], ['inactive', 2, 'old answer']] as const) db.prepare('insert into cursorDiskKV values (?,?)').run('bubbleId:live:' + id, JSON.stringify({ bubbleId: id, type, text, ...(id === 'inactive' ? { toolFormerData: { toolCallId: 'c', name: 'edit', rawArgs: 'x', result: 'y' } } : {}) }));
  const registry = new SourceRegistry({ cursor }); const source = (await registry.sessions('cursor')).items[0];
  expect((await registry.sessions('cursor')).items.map(x => x.nativeId)).toEqual(['live']);
  await expect(registry.capture(sourceKey('cursor', cursor, 'old'), path.join(root, 'bad'))).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
  const capture = await registry.capture(source.sourceId, path.join(root, 'capture'));
  const events = await readEvents(capture.archivePath);
  expect(events.filter(e => e.kind === 'message' && e.active).map(e => e.content[0].text)).toEqual(['first', 'second']);
  expect(events.find(e => e.kind === 'tool_call')!.active).toBe(false);
  expect((await readManifest(capture.archivePath)).session.cwd).toBe(root);
  db.prepare('update composerHeaders set isArchived=1 where composerId=?').run('live'); db.close();
  await expect(registry.assertActive(source.sourceId)).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
});

it('Cursor NULL archive flags remain unknown and cannot pass direct capture checks', async () => {
  const root = await temp(), cursor = path.join(root,'cursor'); await mkdir(path.join(cursor,'User/globalStorage'),{recursive:true});
  const db = new DatabaseSync(path.join(cursor,'User/globalStorage/state.vscdb'));
  db.exec('create table composerHeaders(composerId text,value text,isArchived,isSubagent integer,lastUpdatedAt integer)');
  for(const [id,flag] of [['null',null],['empty',''],['valid',0]] as const) db.prepare('insert into composerHeaders values (?,?,?,?,?)').run(id,JSON.stringify({name:id}),flag,0,1);
  db.close(); const registry = new SourceRegistry({cursor});
  expect((await registry.sessions('cursor')).items.map(x=>x.nativeId)).toEqual(['valid']);
  await expect(registry.assertActive(sourceKey('cursor',cursor,'null'))).rejects.toMatchObject({code:'SOURCE_INACTIVE'});
});
