import { type SessionEvent, type SessionHeader } from '@deepseek-ai/dsh-session';
import { type ContentBlock, type Message } from '@deepseek-ai/dsh-llm';
export interface ImportMessage {
    role: 'user' | 'assistant';
    text: string;
    content?: ContentBlock[];
    timestamp?: number;
}
export interface HistoryInput {
    id: string;
    cwd: string;
    title: string;
    agentPreset: string;
    createdAt: number;
    messages: ImportMessage[];
}
export interface FrozenHistory {
    header: SessionHeader;
    events: SessionEvent[];
    expectedMessagesDigest: string;
    eventsDigest: string;
}
export declare function digest(value: unknown): string;
export declare function messageDigest(messages: readonly Message[]): string;
export declare function createImportedHistory(input: HistoryInput): FrozenHistory;
