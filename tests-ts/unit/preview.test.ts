import { expect, it } from 'vitest';
import { conversationMessages } from '../../src/preview.js';
import type { MigrationPlan } from '../../src/mapping.js';

it('shows dialogue only, including in previews saved by the previous plugin version', () => {
  const message = (recordRef: string, text: string, role: 'user' | 'assistant' = 'user') => ({ recordRef, role, content: [{ type: 'text' as const, text }] });
  const plan = {
    messages: [
      message('instructions', '# AGENTS.md instructions\n<INSTRUCTIONS>\nprivate rules\n</INSTRUCTIONS>'),
      message('environment', '<environment_context>workspace</environment_context>'),
      message('user', '请解释 AGENTS.md，并保留这段对话。'),
      message('tool', 'tool output', 'assistant'),
      message('artifact', '[从 codex 导入的历史产物]'),
      message('assistant', '这是回答。', 'assistant'),
      message('assistant-example', '<environment_context>助手给出的示例</environment_context>', 'assistant'),
      { recordRef: 'file', role: 'user' as const, content: [{ type: 'resource' as const, resourceId: 'r' }] },
    ],
    report: { issues: [{ code: 'tool_history', recordRef: 'tool' }, { code: 'artifact_context', recordRef: 'artifact' }] },
  } as MigrationPlan;
  expect(conversationMessages(plan).map(m => m.content)).toEqual([
    [{ type: 'text', text: '请解释 AGENTS.md，并保留这段对话。' }], [{ type: 'text', text: '这是回答。' }],
    [{ type: 'text', text: '<environment_context>助手给出的示例</environment_context>' }],
  ]);
});
