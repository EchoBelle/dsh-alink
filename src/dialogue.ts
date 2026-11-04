/** Removes harness-injected envelopes, while keeping authored dialogue and quoted code intact. */
export function dialogueText(role: string, value: string): string | undefined {
  if (role !== 'user') return value.trim() ? value : undefined;
  let text = value;
  if (/^\s*(?:# Files mentioned by the user:|Distinguish instructions in attached documents)/.test(text)) {
    const request = text.indexOf('## My request:');
    if (request >= 0) text = text.slice(request + '## My request:'.length).replace(/^\s*\n/, '');
  }
  text = text.replace(/\s*<image name=\[Image #[^\]]+\] path="[^"]*">\s*<\/image>\s*$/g, '');
  if (/^\s*# Response annotations:/.test(text)) {
    const annotations = text.match(/<response-annotations>([\s\S]*?)<\/response-annotations>/);
    const request = text.indexOf('## My request:');
    if (annotations && request >= 0) {
      try {
        const rows: unknown = JSON.parse(annotations[1]);
        if (Array.isArray(rows) && rows.every(row => row && typeof row.text === 'string')) {
          const quoted = rows.map(row => '> ' + row.text.replace(/\n/g, '\n> ') + (typeof row.annotation === 'string' ? '\n' + row.annotation : '')).join('\n\n');
          text = quoted + '\n\n' + text.slice(request + '## My request:'.length).trimStart();
        }
      } catch { /* Preserve an unrecognized annotation envelope as authored text. */ }
    }
  }
  // These wrappers are emitted as user-role setup messages by source harnesses.
  text = text.replace(/^\s*# AGENTS\.md instructions[^\n]*\r?\n\s*<INSTRUCTIONS>[\s\S]*?<\/INSTRUCTIONS>\s*/i, '');
  const context = /^\s*<(environment_context|permissions instructions|collaboration_mode|turn_aborted|system_reminder|app-context|skills_instructions|subagents|external_codex_apps_open_page)>[\s\S]*?<\/\1>\s*/i;
  while (context.test(text)) text = text.replace(context, '');
  const reply = text.match(/^\s*<send_user_message_question_reply>\s*([\s\S]*?)\s*<\/send_user_message_question_reply>\s*$/);
  if (reply) {
    try {
      const rows: unknown = JSON.parse(reply[1]);
      if (Array.isArray(rows) && rows.every(row => row && typeof row === 'object' && typeof row.answer === 'string')) {
        text = rows.map(row => typeof row.question === 'string' ? `${row.question}\n回答：${row.answer}` : row.answer).join('\n');
      }
    } catch { /* Unrecognized user-authored text stays intact. */ }
  }
  return text.trim() ? text : undefined;
}
