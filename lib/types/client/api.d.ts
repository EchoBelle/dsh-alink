import type { Context } from '@deepseek-ai/cordis';
export declare function friendlyError(value: unknown): string;
export declare function call<T>(_ctx: Context, endpoint: string, payload?: unknown, signal?: AbortSignal): Promise<T>;
