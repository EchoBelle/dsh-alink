import { DatabaseSync } from 'node:sqlite';
import { open as openFile, mkdtemp, stat, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { snapshotFile } from './jsonl.js';

export async function withReadonlyDatabase<T>(file: string, operation: (db: DatabaseSync) => T | Promise<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  let db: DatabaseSync | undefined, temporary: string | undefined;
  const open = (p: string) => {
    const connection = new DatabaseSync(p, { readOnly: true });
    try { connection.exec('PRAGMA query_only=ON; BEGIN'); return connection; }
    catch (error) { connection.close(); throw error; }
  };
  try {
    try { db = open(file); db.prepare('SELECT name FROM sqlite_master LIMIT 1').get(); }
    catch (error) {
      db?.close(); db = undefined;
      const source = await openFile(file, 'r');
      const bytes = Buffer.alloc(16);
      try { await source.read(bytes, 0, 16, 0); } finally { await source.close(); }
      const header = bytes.toString('binary');
      if (header !== 'SQLite format 3\0') throw new Error('Encrypted or non-SQLite source');
      if ((await stat(file)).size > 64 * 1024 ** 2) throw error;
      temporary = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-db-'));
      const copy = path.join(temporary, 'snapshot.sqlite');
      const revision = async () => Promise.all([file, file + '-wal'].map(async p => {
        try { const s = await stat(p, { bigint: true }); return `${s.size}:${s.mtimeNs}`; }
        catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return ''; throw e; }
      }));
      let stable = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const before = await revision();
        for (const suffix of ['', '-wal']) {
          await rm(copy + suffix, { force: true });
          if (before[suffix ? 1 : 0]) await snapshotFile(file + suffix, copy + suffix, 64 * 1024 ** 2, signal);
        }
        if (JSON.stringify(before) === JSON.stringify(await revision())) { stable = true; break; }
      }
      if (!stable) throw new Error('SOURCE_CHANGED');
      // Only the private snapshot may create its SHM/WAL support files.
      db = new DatabaseSync(copy); db.exec('PRAGMA query_only=ON; BEGIN');
    }
    signal?.throwIfAborted();
    return await operation(db);
  } finally { db?.close(); if (temporary) await rm(temporary, { recursive: true, force: true }); }
}
export function tableColumns(db: DatabaseSync, table: string): Set<string> {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) throw new Error('Invalid table');
  return new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map(r => String(r.name)));
}
export function portableRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Uint8Array ? { $binary: Buffer.from(v).toString('base64'), encoding: 'base64' } : v]));
}

export async function captureNativeRows(builder: import('../archive.js').ArchiveBuilder, file: string,
  queries: ReadonlyArray<readonly [string, string, string]>, signal?: AbortSignal): Promise<void> {
  if (!await stat(file).catch(() => undefined)) return;
  await withReadonlyDatabase(file, async db => {
    for (const [table, column, value] of queries) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column) || !tableColumns(db, table).has(column)) continue;
      const definition = db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(table);
      const schema = await builder.record({ table, sql: definition?.sql ?? null }, { database: path.basename(file), kind: 'schema' });
      await builder.event(schema, 'metadata', { native_type: 'table_schema', projection: 'auxiliary' });
      const statement = db.prepare(`SELECT * FROM "${table}" WHERE "${column}"=?`); statement.setReadBigInts(true);
      for (const row of statement.iterate(value)) {
        signal?.throwIfAborted();
        const ref = await builder.record(portableRow(row), { database: path.basename(file), table });
        await builder.event(ref, 'metadata', { native_type: table, projection: 'auxiliary' });
      }
    }
  }, signal);
}
