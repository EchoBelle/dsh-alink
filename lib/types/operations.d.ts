import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import { Ledger } from './ledger.js';
import type { CommitRequest, Operation, Preview, SourceApp, SourceSession, Page, TargetSelection } from './contracts.js';
import { type MappingLimits } from './mapping.js';
import { WorkerRunner } from './sources/worker-client.js';
import { type SourceRoots } from './sources/types.js';
interface Options {
    directory: string;
    namespace: string;
    roots: SourceRoots;
    resourceRoots?: readonly string[];
    limits?: MappingLimits;
    worker: WorkerRunner;
    store: SessionPersistence;
    attachments: AttachmentStore;
    resolveTarget(target: TargetSelection): Promise<TargetSelection>;
    attach(cwd: string, sessionId: string): Promise<void>;
}
export declare function atomicJson(file: string, value: unknown): Promise<void>;
export declare class MigrationService {
    readonly options: Options;
    readonly ledger: Ledger;
    private readonly jobs;
    private accepting;
    private readonly exports;
    private constructor();
    static create(options: Options): Promise<MigrationService>;
    private ready;
    sources(): Promise<unknown>;
    sessions(app: SourceApp, query?: {
        text?: string;
        cursor?: string;
        limit?: number;
    }): Promise<Page<SourceSession>>;
    private upload;
    private active;
    preview(sourceId: string, target: TargetSelection, signal?: AbortSignal): Promise<Preview>;
    private stored;
    previewPage(id: string, offset?: number): {
        total: number;
        offset: number;
        items: {
            content: ({
                type: "resource";
                resourceId: string;
            } | {
                type: string;
                text: string;
            })[];
            role: "user" | "assistant";
        }[];
        preview?: Preview | undefined;
    };
    commit(request: CommitRequest): Promise<Operation>;
    private run;
    operation(id: string): Operation;
    operations(): Operation[];
    cancel(id: string): Operation;
    download(id: string): Promise<string>;
    registerFile(input: string, format: 'alink' | 'dsh', signal?: AbortSignal): Promise<SourceSession>;
    close(): Promise<void>;
}
export {};
