import type { MigrationPlan } from './mapping.js';

import { dialogueText } from './dialogue.js';

export function conversationMessages(plan: MigrationPlan) {
  const toolRecords = new Set(plan.report.issues.filter(i => i.code === 'tool_history').map(i => i.recordRef));
  return plan.messages.flatMap(message => {
    if (message.presentation === 'context' || (message.presentation === undefined && toolRecords.has(message.recordRef))) return [];
    const content = message.content.flatMap(b => {
      if (b.type !== 'text' || /^\[(?:从 .+ 导入的历史产物|历史资源未迁入：)/.test(b.text)) return [];
      const text = dialogueText(message.role, b.text);
      return text === undefined ? [] : [{ type: 'text' as const, text }];
    });
    return content.length ? [{ role: message.role, content }] : [];
  });
}
