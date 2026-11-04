import type { MigrationPlan } from './mapping.js';

// Source harnesses can store their own setup instructions as user messages.
function isHarnessContext(text: string): boolean {
  return /^\s*# AGENTS\.md instructions[^\n]*\r?\n\s*<INSTRUCTIONS>/.test(text)
    || /^\s*<(?:environment_context|permissions instructions|collaboration_mode|turn_aborted|system_reminder)>/.test(text);
}

export function conversationMessages(plan: MigrationPlan) {
  const toolRecords = new Set(plan.report.issues.filter(i => i.code === 'tool_history').map(i => i.recordRef));
  return plan.messages.flatMap(message => {
    if (message.presentation === 'context' || (message.presentation === undefined && toolRecords.has(message.recordRef))) return [];
    const content = message.content.filter(b => b.type === 'text' && b.text.trim()
      && !(message.role === 'user' && isHarnessContext(b.text)) && !/^\[(?:从 .+ 导入的历史产物|历史资源未迁入：)/.test(b.text));
    return content.length ? [{ role: message.role, content }] : [];
  });
}
