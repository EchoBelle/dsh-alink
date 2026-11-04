import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Session, SessionId, SessionLogOffset } from '@deepseek-ai/dsh-session';
import { Context } from '@deepseek-ai/cordis';
import * as JsonlPersistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import { createImportedHistory } from '../../src/dsh/history.js';
import { persistHistory, verifyHistory } from '../../src/dsh/persistence.js';

const cleanup: Array<() => Promise<unknown>> = [];
afterEach(async () => { for (const dispose of cleanup.reverse()) await dispose(); cleanup.length = 0; });

describe('dsh-alink published DSH contract', () => {
  it('preserves Unicode text and message roles through the native v4 projection', () => {
    const history = createImportedHistory({ id: 'dsh-alink-test', cwd: '/tmp', title: '迁入测试', agentPreset: 'standard', createdAt: 1000,
      messages: [{ role: 'user', text: '项目代号：海星\n第二行 🐟' }, { role: 'assistant', text: '已记录海星。' }] });
    const session = Session.create(SessionId(history.header.id), history.events, history.header, SessionLogOffset(0));
    expect(session.deriveMessages().map(m => [m.role, m.content])).toEqual([
      ['user', [{ type: 'text', text: '项目代号：海星\n第二行 🐟' }]],
      ['assistant', [{ type: 'text', text: '已记录海星。' }]],
    ]);
    expect(history.header.version).toBe(4);
    expect(history.header.isSeeded).toBe(false);
    expect(history.events.some(e => e.type === 'tool/call')).toBe(false);
  });

  it('writes through DSH handles and restores from a fresh backend', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dsh-alink-contract-'));
    cleanup.push(() => rm(root, { recursive: true, force: true }));
    const history = createImportedHistory({ id: 'dsh-alink-durable', cwd: root, title: 'Durable import', agentPreset: 'standard', createdAt: 1000,
      messages: [{ role: 'user', text: 'Remember sea-star' }, { role: 'assistant', text: 'Saved.' }] });
    let ctx = new Context();
    const backend = await ctx.plugin(JsonlPersistence, { root: path.join(root, 'sessions'), compression: 'none' });
    await persistHistory(ctx.sessionPersistence, history);
    await verifyHistory(ctx.sessionPersistence, history);
    expect((await ctx.sessionPersistence.list()).map(s => s.header.id)).toContain('dsh-alink-durable');
    await backend.dispose();
    ctx = new Context();
    const restarted = await ctx.plugin(JsonlPersistence, { root: path.join(root, 'sessions'), compression: 'none' });
    cleanup.push(() => restarted.dispose());
    await verifyHistory(ctx.sessionPersistence, history);
    const handle = await ctx.sessionPersistence.open(SessionId('dsh-alink-durable'), 'read');
    const read = await handle.read();
    const restored = Session.fromRestore(handle.id, read.events, handle.header, handle.inheritedEventCount, read.eventState);
    expect(restored.deriveMessages().map(m => m.role)).toEqual(['user', 'assistant']);
    await handle.close();
  });
});
