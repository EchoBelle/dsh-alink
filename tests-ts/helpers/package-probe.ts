import type { Context } from '@deepseek-ai/cordis';
import { Session, SessionId } from '@deepseek-ai/dsh-session';
import { LlmAdapter, createUserMessage, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm';
import type {} from '@deepseek-ai/dsh-agent-loop';
import type {} from '@deepseek-ai/dsh-agent-preset-registry';
import type {} from '@deepseek-ai/dsh-session-persistence';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
export const name = 'dsh-alink-package-probe';
export const inject = ['llm', 'agents', 'agentLoop', 'sessions', 'sessionPersistence', 'agentPresets'];
export function apply(ctx: Context) {
  const home = process.env.DSH_HOME!;
  let calls = 0;
  class LocalModel extends LlmAdapter {
    override async listModels() { return [{ provider: 'dsh-alink-test', id: 'memory-test', name: 'Memory test', inputModalities: ['text' as const] }]; }
    override async resolveModel() { return { provider: 'dsh-alink-test', id: 'memory-test', name: 'Memory test', context: { contextWindow: 32000 }, defaultMaxTokens: 1000 }; }
    async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
      calls++;
      const text = JSON.stringify(options.messages);
      if (/source-(tool|env|reasoning|compaction)-secret/.test(text)) throw new Error('Non-dialogue source data reached the resumed model');
      if (!text.includes('项目代号：海星') || !text.includes('已记录海星。') || !text.includes('项目代号是什么')) throw new Error('Migrated history absent from native continuation request');
      const block = { type: 'text' as const, text: '续聊已读取：海星' };
      yield { type: 'block-start', index: 0, blockType: 'text' };
      yield { type: 'text-delta', index: 0, text: block.text };
      yield { type: 'block-end', index: 0, block };
      yield { type: 'finish', reason: { kind: 'stop' } };
    }
  }
  ctx.llm.registerAdapter(['dsh-alink-test'], new LocalModel());
  const run = async () => {
    let request: { ids: string[]; round: string };
    try { request = JSON.parse(await readFile(path.join(home, 'continuation-request.json'), 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    const results = [];
    for (const raw of request.ids) {
      const id = SessionId(raw), snapshot = await ctx.sessionPersistence.stat(id);
      if (!snapshot) throw new Error('Imported session missing');
      const before = calls;
      const handle = await ctx.agents.resume({ resumeSessionId: id, agentOptions: { provider: 'dsh-alink-test', model: 'memory-test' },
        setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, snapshot.header.agentPreset); },
      });
      try {
        handle.agent.send(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '项目代号是什么？' }] }), 'next-turn', true);
        await handle.agent.whenIdle(); await ctx.sessions.flush(handle.agent.session);
        if (calls - before !== 1) throw new Error('Expected exactly one local model request');
      } finally { await handle.dispose(); }
      const reader = await ctx.sessionPersistence.open(id, 'read');
      try {
        const read = await reader.read();
        const restored = Session.fromRestore(reader.id, read.events, reader.header, reader.inheritedEventCount, read.eventState);
        if (!restored.deriveMessages().some(m => m.role === 'assistant' && m.content.some(b => b.type === 'text' && b.text === '续聊已读取：海星'))) throw new Error('Continued reply did not survive native cold read');
      } finally { await reader.close(); }
      results.push({ sessionId: id, requestCount: calls - before, coldRead: true });
    }
    await writeFile(path.join(home, 'continuation-result.json'), JSON.stringify({ passed: true, round: request.round, calls, results }));
  };
  const task = run().catch(async error => { await writeFile(path.join(home, 'continuation-result.json'), JSON.stringify({ passed: false, error: String(error), stack: error.stack })); });
  ctx.effect(() => () => task);
}
