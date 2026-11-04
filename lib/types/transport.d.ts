import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection';
export declare class LinkError extends Error {
    readonly code: string;
    constructor(code: string, message?: string);
}
export declare function makeRpcHandler(dispatch: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>): ConnectionRpcHandler;
export declare function validateRequest(value: unknown): {
    endpoint: string;
    payload: Record<string, any>;
};
export declare function errorResult(error: unknown): {
    ok: false;
    error: {
        code: string;
        message: string;
        details: {};
    };
};
