import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ArchiveBuilder } from '../../src/archive.js';
import { buildMigrationPlan, freezeHistory } from '../../src/mapping.js';
import { Session, SessionLogOffset } from '@deepseek-ai/dsh-session';

it('writes only user and assistant dialogue into native DSH history', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-mapping-'));
  try {
    const b = await ArchiveBuilder.create(path.join(root, 'p'), 'codex', 'rollout-jsonl', { native_id: 's', title: 'Imported' });
    const ref = await b.record({}, {});
    for (const [role, text, active] of [['user', '你好\nsecond', true], ['assistant', '答复', true], ['system', 'source policy', true], ['assistant', 'old', false]] as const) await b.event(ref, 'message', { role, active, content: [{ type: 'text', text }] });
    await b.event(ref, 'tool_call', { content: [{ type: 'tool_call', call_id: 'x', name: 'edit', arguments: 'patch' }] });
    await b.event(ref, 'tool_result', { content: [{ type: 'tool_result', call_id: 'x', output: 'saved' }] });
    await b.event(ref, 'message', { role: 'user', content: [{ type: 'text', text: '# AGENTS.md instructions\n<INSTRUCTIONS>hidden rules</INSTRUCTIONS>' }] });
    await b.event(ref, 'message', { role: 'user', content: [{ type: 'text', text: '<environment_context>private setup</environment_context>' }] });
    await b.event(ref, 'artifact', { content: [{ type: 'text', text: 'generated artifact' }] });
    const archive = await b.finish();
    const plan = await buildMigrationPlan(archive.archivePath, { cwd: root, agentPreset: 'standard' });
    const history = await freezeHistory(plan, 'mapping-test', {});
    const messages = Session.create(history.header.id, history.events, history.header, SessionLogOffset(0)).deriveMessages();
    expect(messages.map(m => m.content)).toEqual([[{ type: 'text', text: '你好\nsecond' }], [{ type: 'text', text: '答复' }]]);
    const text = JSON.stringify(messages);
    for (const forbidden of ['工具历史', 'patch', 'saved', 'hidden rules', 'private setup', 'generated artifact']) expect(text).not.toContain(forbidden);
    expect(text).not.toContain('source policy'); expect(text).not.toContain('"old"');
    expect(history.events.some(e => e.type === 'tool/call')).toBe(false);
    expect(plan.report.mappingVersion).toBe('2');
    expect(plan.report.issues.some(i => i.code === 'reconstructed_history')).toBe(true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('imports available dialogue while reporting unavailable older history, and rejects oversized text', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-blocked-'));
  try {
    const b = await ArchiveBuilder.create(path.join(root, 'p'), 'codex', 'rollout-jsonl', {});
    const ref = await b.record({}, {}); await b.event(ref, 'message', { role: 'user', content: [{ type: 'text', text: 'long message' }] });
    b.issue('unresolved_history', 'external history'); const result = await b.finish();
    const plan = await buildMigrationPlan(result.archivePath, { cwd: root, agentPreset: 'standard' });
    expect(plan.report.counts.blocked).toBe(0);
    expect(plan.report.counts.missing).toBeGreaterThan(0);
    expect((await freezeHistory(plan, 'available', {})).events.length).toBeGreaterThan(0);
    await expect(buildMigrationPlan(result.archivePath, { cwd: root, agentPreset: 'standard' }, { maxTextBytes: 2, maxMessages: 100 })).rejects.toMatchObject({ code: 'CONTENT_LIMIT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
