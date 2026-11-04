import type { SourceRoots } from './types.js';
import type { SourceApp } from '../contracts.js';
export type ArchiveTask = {
    kind: 'validate';
    path: string;
} | {
    kind: 'import';
    path: string;
    destination: string;
} | {
    kind: 'export';
    path: string;
    destination: string;
} | {
    kind: 'legacy-file';
    roots: SourceRoots;
    sourceId: string;
    path: string;
    destination: string;
} | {
    kind: 'sources';
    roots: SourceRoots;
} | {
    kind: 'sessions';
    roots: SourceRoots;
    app: SourceApp;
    query?: {
        text?: string;
        cursor?: string;
        limit?: number;
    };
} | {
    kind: 'active';
    roots: SourceRoots;
    sourceId: string;
} | {
    kind: 'capture';
    roots: SourceRoots;
    resourceRoots?: readonly string[];
    sourceId: string;
    destination: string;
};
export declare class WorkerRunner {
    private readonly file;
    private readonly active;
    private closed;
    constructor(file: URL);
    run<T>(task: ArchiveTask, signal?: AbortSignal): Promise<T>;
    close(): Promise<void>;
}
