import { Session } from '@deepseek-ai/dsh-session';
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence';
import { digest, messageDigest, type FrozenHistory } from './history.js';

export async function persistHistory(store: SessionPersistence, history: FrozenHistory, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  if (digest(history.events) !== history.eventsDigest) throw new Error('HISTORY_CHANGED');
  const handle = await store.create(history.header, { signal });
  try {
    await handle.append(history.events, { signal });
    await handle.flush({ signal });
  } finally {
    await handle.close();
  }
}

export async function verifyHistory(store: SessionPersistence, history: FrozenHistory, signal?: AbortSignal): Promise<void> {
  const handle = await store.open(history.header.id, 'read', { signal });
  try {
    const read = await handle.read(0, undefined, { signal });
    if (digest(read.events.slice(0, history.events.length)) !== history.eventsDigest) throw new Error('HISTORY_MISMATCH');
    if (handle.header.cwd !== history.header.cwd || handle.header.agentPreset !== history.header.agentPreset) throw new Error('TARGET_MISMATCH');
    const session = Session.fromRestore(handle.id, read.events.slice(0, history.events.length), handle.header, handle.inheritedEventCount, read.eventState);
    if (messageDigest(session.deriveMessages()) !== history.expectedMessagesDigest) throw new Error('MESSAGES_MISMATCH');
  } finally {
    await handle.close();
  }
}
