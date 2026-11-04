import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { chmodSync } from 'node:fs';
import type { Operation } from './contracts.js';
import { LinkError } from './transport.js';
export class Ledger {
  private readonly writer: DatabaseSync;
  private readonly reader: DatabaseSync;
  private writing = false;
  constructor(file: string) {
    this.writer = new DatabaseSync(file);
    this.writer.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=0;
      CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY, dedup TEXT UNIQUE NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, preview TEXT NOT NULL, operation TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS previews(id TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    chmodSync(file, 0o600);
    this.reader = new DatabaseSync(file, { readOnly: true }); this.reader.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=0');
  }
  savePreview(id: string, value: unknown): void {
    if (this.writing) throw new LinkError('IMPORT_BUSY');
    try { this.writer.prepare('INSERT INTO previews VALUES (?,?)').run(id, JSON.stringify(value)); }
    catch (error) { if (String(error).includes('locked')) throw new LinkError('IMPORT_BUSY'); throw error; }
  }
  preview<T>(id: string): T | undefined {
    const row = this.reader.prepare('SELECT value FROM previews WHERE id=?').get(id);
    return row ? JSON.parse(String(row.value)) as T : undefined;
  }
  operation(id: string): Operation | undefined {
    const row = this.reader.prepare('SELECT value FROM operations WHERE id=?').get(id);
    return row ? JSON.parse(String(row.value)) : undefined;
  }
  operations(): Operation[] { return this.reader.prepare('SELECT value FROM operations ORDER BY rowid DESC LIMIT 100').all().map(row => JSON.parse(String(row.value))); }
  reserve(preview: string, dedup: string, requestId: string, title: string): Operation {
    const request = this.reader.prepare('SELECT * FROM requests WHERE id=?').get(requestId);
    if (request) {
      if (request.preview !== preview) throw new LinkError('REQUEST_CONFLICT');
      return this.operation(String(request.operation))!;
    }
    if (this.writing) throw new LinkError('IMPORT_BUSY');
    try { this.writer.exec('BEGIN IMMEDIATE'); } catch { throw new LinkError('IMPORT_BUSY'); }
    try {
      const existing = this.writer.prepare('SELECT value FROM operations WHERE dedup=?').get(dedup);
      const op: Operation = existing ? JSON.parse(String(existing.value)) : { operationId: randomUUID(), previewId: preview, title,
        targetSessionId: 'dsh-alink-' + randomUUID(), state: 'prepared', stage: 'queued' };
      if (!existing) this.writer.prepare('INSERT INTO operations VALUES (?,?,?)').run(op.operationId, dedup, JSON.stringify(op));
      this.writer.prepare('INSERT INTO requests VALUES (?,?,?)').run(requestId, preview, op.operationId);
      this.writer.exec('COMMIT'); return op;
    } catch (error) { this.writer.exec('ROLLBACK'); throw error; }
  }
  update(operation: Operation): void {
    this.writer.prepare('UPDATE operations SET value=? WHERE id=?').run(JSON.stringify(operation), operation.operationId);
  }
  async withWriter<T>(action: () => Promise<T>): Promise<T> {
    if (this.writing) throw new LinkError('IMPORT_BUSY');
    try { this.writer.exec('BEGIN IMMEDIATE'); } catch { throw new LinkError('IMPORT_BUSY'); }
    this.writing = true;
    try { const result = await action(); this.writer.exec('COMMIT'); return result; }
    catch (error) { this.writer.exec('ROLLBACK'); throw error; }
    finally { this.writing = false; }
  }
  reconcile(active: ReadonlySet<string> = new Set()): void {
    if (this.writing) return;
    try { this.writer.exec('BEGIN IMMEDIATE'); } catch { return; }
    try {
      for (const row of this.writer.prepare('SELECT value FROM operations').all()) {
        const op: Operation = JSON.parse(String(row.value));
        if (!active.has(op.operationId) && ['prepared', 'writing', 'verifying'].includes(op.state)) {
          op.state = 'needs-attention'; op.stage = 'interrupted'; op.errorCode = 'INTERRUPTED'; this.update(op);
        }
      }
      this.writer.exec('COMMIT');
    } catch (error) { this.writer.exec('ROLLBACK'); throw error; }
  }
  close(): void { this.reader.close(); this.writer.close(); }
}
