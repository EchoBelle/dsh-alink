import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ArchiveBuilder } from '../../src/archive.js';
import { buildMigrationPlan, freezeHistory } from '../../src/mapping.js';
import { Session, SessionLogOffset } from '@deepseek-ai/dsh-session';

it('keeps text exact, renders historical tools, and excludes inactive and privileged messages', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-mapping-'));
  try {
    const b = await ArchiveBuilder.create(path.join(root, 'p'), 'codex', 'rollout-jsonl', { native_id: 's', title: 'Imported' });
    const ref = await b.record({}, {});
    for (const [role, text, active] of [['user', '你好\nsecond', true], ['assistant', '答复', true], ['system', 'source policy', true], ['assistant', 'old', false]] as const) await b.event(ref, 'message', { role, active, content: [{ type: 'text', text }] });
    await b.event(ref, 'tool_call', { content: [{ type: 'tool_call', call_id: 'x', name: 'edit', arguments: 'patch' }] });
    await b.event(ref, 'tool_result', { content: [{ type: 'tool_result', call_id: 'x', output: 'saved' }] });
    const archive = await b.finish();
    const plan = await buildMigrationPlan(archive.archivePath, { cwd: root, agentPreset: 'standard' });
    const history = await freezeHistory(plan, 'mapping-test', {});
    const messages = Session.create(history.header.id, history.events, history.header, SessionLogOffset(0)).deriveMessages();
    expect(messages.slice(0, 2).map(m => m.content)).toEqual([[{ type: 'text', text: '你好\nsecond' }], [{ type: 'text', text: '答复' }]]);
    const text = JSON.stringify(messages);
    expect(text).toContain('[从 codex 导入的工具历史；不会执行]');
    expect(text).toContain('patch'); expect(text).toContain('saved');
    expect(text).not.toContain('source policy'); expect(text).not.toContain('"old"');
    expect(history.events.some(e => e.type === 'tool/call')).toBe(false);
    expect(plan.report.issues.filter(i => i.code === 'tool_history')).toHaveLength(2);
    expect(plan.report.issues.some(i => i.code === 'reconstructed_history')).toBe(true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('blocks unresolved history, stale target previews and oversized text without truncation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-blocked-'));
  try {
    const b = await ArchiveBuilder.create(path.join(root, 'p'), 'codex', 'rollout-jsonl', {});
    const ref = await b.record({}, {}); await b.event(ref, 'message', { role: 'user', content: [{ type: 'text', text: 'long message' }] });
    b.issue('unresolved_history', 'external history'); const result = await b.finish();
    const plan = await buildMigrationPlan(result.archivePath, { cwd: root, agentPreset: 'standard' });
    expect(plan.report.counts.blocked).toBeGreaterThan(0);
    await expect(freezeHistory(plan, 'blocked', {})).rejects.toMatchObject({ code: 'HISTORY_BLOCKED' });
    await expect(buildMigrationPlan(result.archivePath, { cwd: root, agentPreset: 'standard' }, { maxTextBytes: 2, maxMessages: 100 })).rejects.toMatchObject({ code: 'CONTENT_LIMIT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
