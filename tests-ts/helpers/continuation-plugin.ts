import { Session } from '@deepseek-ai/dsh-session';
import type { Context } from '@deepseek-ai/cordis';
import { LlmAdapter, createUserMessage, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm';
import type {} from '@deepseek-ai/dsh-agent-loop';
import type {} from '@deepseek-ai/dsh-workspace';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createImportedHistory } from '../../src/dsh/history.js';
import { persistHistory, verifyHistory } from '../../src/dsh/persistence.js';

export const name = 'dsh-alink-continuation-contract';
export const inject = ['llm', 'agents', 'agentLoop', 'sessionPersistence', 'workspaceRegistry', 'sessions'];
export function apply(ctx: Context) {
  const root = process.env.DSH_HOME!;
  let requests = 0;
  class TestModel extends LlmAdapter {
    override async listModels() { return [{ provider: 'dsh-alink-test', id: 'memory-test', name: 'Memory test', inputModalities: ['text' as const] }]; }
    override async resolveModel() { return { provider: 'dsh-alink-test', id: 'memory-test', name: 'Memory test', context: { contextWindow: 32000 }, defaultMaxTokens: 1000 }; }
    async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
      requests++;
      const text = JSON.stringify(options.messages);
      if (!text.includes('海星') || !text.includes('项目代号是什么')) throw new Error('Imported context did not reach the native model request');
      const block = { type: 'text' as const, text: '续聊已读取：海星' };
      yield { type: 'block-start', index: 0, blockType: 'text' };
      yield { type: 'text-delta', index: 0, text: block.text };
      yield { type: 'block-end', index: 0, block };
      yield { type: 'finish', reason: { kind: 'stop' } };
    }
  }
  ctx.llm.registerAdapter(['dsh-alink-test'], new TestModel());
  if (existsSync(path.join(root, 'skip-contract'))) return;
  const run = async () => {
    const history = createImportedHistory({ id: 'dsh-alink-continuation-' + Date.now(), cwd: root, title: 'dsh-alink 验收 ' + Date.now(), agentPreset: 'standard', createdAt: Date.now(),
      messages: [{ role: 'user', text: '项目代号：海星\n请保留。' }, { role: 'assistant', text: '已记录海星。' }] });
    if (!await ctx.sessionPersistence.stat(history.header.id)) await persistHistory(ctx.sessionPersistence, history);
    await verifyHistory(ctx.sessionPersistence, history);
    const workspace = await ctx.workspaceRegistry.create(root);
    await workspace.attachSession(history.header.id);
    const handle = await ctx.agents.resume({ resumeSessionId: history.header.id, agentOptions: { provider: 'dsh-alink-test', model: 'memory-test' } });
    try {
      handle.agent.send(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '项目代号是什么？' }] }), 'next-turn', true);
      await handle.agent.whenIdle();
      await ctx.sessions.flush(handle.agent.session);
      const messages = handle.agent.session.deriveMessages();
      const continued = messages.some(m => m.role === 'assistant' && m.content.some(b => b.type === 'text' && b.text === '续聊已读取：海星'));
      if (!continued || requests !== 1) throw new Error(`Continuation failed: ${requests} requests`);

    } finally { await handle.dispose(); }
    const reader = await ctx.sessionPersistence.open(history.header.id, 'read');
    try {
      const read = await reader.read();
      const restored = Session.fromRestore(reader.id, read.events, reader.header, reader.inheritedEventCount, read.eventState);
      if (!JSON.stringify(restored.deriveMessages()).includes('续聊已读取：海星')) throw new Error('Persisted continuation missing');
    } finally { await reader.close(); }
    await writeFile(path.join(root, 'continuation-result.json'), JSON.stringify({ passed: true, requests, sessionId: history.header.id, title: history.events.at(-1)!.data, workspaceAttached: workspace.sessionIds.includes(history.header.id), coldRead: true }));
  };
  const pending = run().catch(async error => {
    await writeFile(path.join(root, 'continuation-result.json'), JSON.stringify({ passed: false, error: String(error), stack: error.stack }));
  });
  ctx.effect(() => () => pending);
}
