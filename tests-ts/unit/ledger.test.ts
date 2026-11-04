import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Ledger } from '../../src/ledger.js';
it('persists a target ID before writing and enforces request identity across restarts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-ledger-'));
  try {
    let ledger = new Ledger(path.join(root, 'operations.sqlite'));
    const first = ledger.reserve('p1', 'dedup', 'req1', 'title');
    expect(ledger.reserve('p1', 'dedup', 'req1', 'title').operationId).toBe(first.operationId);
    expect(() => ledger.reserve('p2', 'different', 'req1', 'title')).toThrow(/REQUEST_CONFLICT/);
    expect(ledger.reserve('p1', 'dedup', 'req2', 'title').targetSessionId).toBe(first.targetSessionId);
    ledger.close(); ledger = new Ledger(path.join(root, 'operations.sqlite'));
    expect(ledger.operation(first.operationId)?.targetSessionId).toBe(first.targetSessionId);
    ledger.close();
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('holds a cross-connection write lock without losing the durable reservation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-lock-'));
  const one = new Ledger(path.join(root, 'operations.sqlite')), two = new Ledger(path.join(root, 'operations.sqlite'));
  try {
    const op = one.reserve('p', 'dedup', 'req', 'title');
    await one.withWriter(async () => {
      expect(two.operation(op.operationId)?.state).toBe('prepared');
      await expect(two.withWriter(async () => {})).rejects.toMatchObject({ code: 'IMPORT_BUSY' });
      throw new Error('crash');
    }).catch(() => {});
    expect(two.operation(op.operationId)?.targetSessionId).toBe(op.targetSessionId);
    await expect(two.withWriter(async () => {})).resolves.toBeUndefined();
  } finally { one.close(); two.close(); await rm(root, { recursive: true, force: true }); }
});
