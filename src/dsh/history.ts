import { createHash } from 'node:crypto';
import { Session, SessionId, SessionLogOffset, SessionSeq, SESSION_FORMAT_VERSION,
  type SessionEvent, type SessionHeader } from '@deepseek-ai/dsh-session';
import { createAssistantMessage, createUserMessage, createSystemMessage, AssistantStreamAccumulator,
  type ContentBlock, type Message } from '@deepseek-ai/dsh-llm';
import type {} from '@deepseek-ai/dsh-session-title';

export interface ImportMessage {
  role: 'user' | 'assistant';
  text: string;
  content?: ContentBlock[];
  timestamp?: number;
}
export interface HistoryInput {
  id: string; cwd: string; title: string; agentPreset: string; createdAt: number;
  messages: ImportMessage[];
}
export interface FrozenHistory {
  header: SessionHeader;
  events: SessionEvent[];
  expectedMessagesDigest: string;
  eventsDigest: string;
}
export function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function messageDigest(messages: readonly Message[]): string {
  return digest(messages.map(m => ({ role: m.role, content: m.content })));
}

export function createImportedHistory(input: HistoryInput): FrozenHistory {
  const header: SessionHeader = { version: SESSION_FORMAT_VERSION, id: SessionId(input.id),
    createdAt: input.createdAt, cwd: input.cwd, agentPreset: input.agentPreset, isSeeded: false };
  const events: SessionEvent[] = [];
  let time = input.createdAt;
  type InputEvent = SessionEvent extends infer E ? E extends SessionEvent ? Omit<E, 'seq' | 'time'> : never : never;
  const add = (event: InputEvent) => {
    events.push({ ...event, seq: SessionSeq(events.length), time } as SessionEvent);
  };
  for (const [index, item] of input.messages.entries()) {
    const turn = index + 1, step = 1;
    time = item.timestamp ?? input.createdAt;
    const content: ContentBlock[] = item.content ?? [{ type: 'text', text: item.text }];
    add({ type: 'turn/start', data: { turn } });
    add({ type: 'step/start', data: { turn, step } });
    // v4 reserves the first surface node for DSH's own prompt on continuation.
    if (index === 0) add({ type: 'system/message', data: { turn, step, message: createSystemMessage('') }, surfaceOp: 'append' });
    if (item.role === 'user') {
      add({ type: 'user/message', data: createUserMessage({ source: { kind: 'user' }, content }), surfaceOp: 'append' });
    } else {
      const stream = new AssistantStreamAccumulator();
      content.forEach((block, i) => {
        stream.push({ time, chunk: { type: 'block-start', index: i, blockType: block.type } });
        if (block.type === 'text') stream.push({ time, chunk: { type: 'text-delta', index: i, text: block.text } });
        stream.push({ time, chunk: { type: 'block-end', index: i, block } });
      });
      stream.push({ time, chunk: { type: 'finish', reason: { kind: 'stop' } } });
      const message = createAssistantMessage({ source: { provider: 'dsh-alink', model: 'imported-history' }, content });
      add({ type: 'assistant/message', data: { turn, step, message, stream: [...stream.snapshot()] }, surfaceOp: 'append' });
    }
    add({ type: 'step/end', data: { turn, step } });
    add({ type: 'turn/end', data: { turn, reason: { kind: 'completed' } } });
  }
  time = input.createdAt;
  add({ type: 'session/title', data: { title: input.title.trim() || '迁入的会话', messageSeqs: [], source: { kind: 'user' } } });
  const session = Session.create(header.id, events, header, SessionLogOffset(0));
  return { header, events, expectedMessagesDigest: messageDigest(session.deriveMessages()), eventsDigest: digest(events) };
}
