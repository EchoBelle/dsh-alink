import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence';
import { type FrozenHistory } from './history.js';
export declare function persistHistory(store: SessionPersistence, history: FrozenHistory, signal?: AbortSignal): Promise<void>;
export declare function verifyHistory(store: SessionPersistence, history: FrozenHistory, signal?: AbortSignal): Promise<void>;
