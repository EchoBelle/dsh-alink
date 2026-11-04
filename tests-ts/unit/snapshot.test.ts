import { expect, it } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { readJsonl, snapshotFile } from '../../src/sources/jsonl.js';
import { withReadonlyDatabase } from '../../src/sources/sqlite.js';

it('rejects oversized or torn JSONL and copies exact stable bytes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-snapshot-'));
  try {
    const file = path.join(root, 'source.jsonl');
    await writeFile(file, '{"x":"你好"}\n');
    await snapshotFile(file, path.join(root, 'copy'), 1000);
    expect(await readFile(path.join(root, 'copy'), 'utf8')).toBe('{"x":"你好"}\n');
    await writeFile(file, 'a'.repeat(17 * 1024 * 1024));
    await expect(async () => { for await (const _ of readJsonl(file)) { /* read */ } }).rejects.toThrow(/limit|large/i);
    await writeFile(file, '{"x":');
    await expect(async () => { for await (const _ of readJsonl(file)) { /* read */ } }).rejects.toThrow();
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('reads committed WAL records while refusing source mutations', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-db-'));
  const file = path.join(root, 'source.sqlite');
  const source = new DatabaseSync(file);
  try {
    source.exec('pragma journal_mode=WAL; create table messages(text); insert into messages values (\'new\');');
    const result = await withReadonlyDatabase(file, db => {
      expect(() => db.exec("insert into messages values ('bad')")).toThrow();
      return db.prepare('select text from messages').all();
    });
    expect(result).toEqual([{ text: 'new' }]);
    expect(source.prepare('select count(*) as n from messages').get()).toMatchObject({ n: 1 });
  } finally { source.close(); await rm(root, { recursive: true, force: true }); }
});

it('keeps the readonly transaction alive through asynchronous capture work', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-async-db-'));
  const file = path.join(root, 'source.sqlite'); const db = new DatabaseSync(file);
  db.exec('create table t(n); insert into t values (1)'); db.close();
  try {
    const n = await withReadonlyDatabase(file, async connection => {
      await Promise.resolve();
      return connection.prepare('select n from t').get()!.n;
    });
    expect(n).toBe(1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
