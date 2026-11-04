export declare function friendlyError(value: unknown): string;
export declare function call<T>(endpoint: string, payload?: unknown, signal?: AbortSignal): Promise<T>;
