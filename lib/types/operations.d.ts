import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import { Ledger } from './ledger.js';
import type { CaptureResult, CommitRequest, Operation, Preview, SourceApp, SourceSession, Page, TargetSelection } from './contracts.js';
import { type MappingLimits } from './mapping.js';
import { WorkerRunner } from './sources/worker-client.js';
import { type SourceRoots, type SourceLocator } from './sources/types.js';
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
    private readonly inspections;
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
    source(sourceId: string, signal?: AbortSignal): Promise<SourceLocator>;
    captureSource(sourceId: string, destination: string, signal?: AbortSignal): Promise<CaptureResult>;
    inspect(sourceId: string, signal?: AbortSignal): Promise<{
        title: string;
        inspectionId: `${string}-${string}-${string}-${string}-${string}`;
        total: number;
        offset: number;
        items: {
            content: {
                type: "text";
                text: string;
            }[];
            role: "user" | "assistant";
        }[];
    }>;
    inspectionPage(id: string, offset?: number): Promise<{
        inspectionId: string;
        total: number;
        offset: number;
        items: {
            role: "user" | "assistant";
            content: {
                type: "text";
                text: string;
            }[];
        }[];
    }>;
    preview(sourceId: string, target: TargetSelection, signal?: AbortSignal): Promise<Preview>;
    private stored;
    previewPage(id: string, offset?: number): {
        total: number;
        offset: number;
        items: {
            content: {
                type: string;
                text: string;
            }[];
            role: "user" | "assistant";
        }[];
        preview?: Preview | undefined;
    };
    commit(request: CommitRequest): Promise<Operation>;
    private run;
    operation(id: string): Operation;
    operations(): Operation[];
    wait(id: string, signal?: AbortSignal): Promise<Operation>;
    retryOperation(id: string): Promise<Operation>;
    removeOperation(id: string): void;
    cancel(id: string): Operation;
    download(id: string): Promise<string>;
    registerFiles(input: string, format: 'alink' | 'dsh', signal?: AbortSignal): Promise<{
        sources: SourceSession[];
        errors: string[];
    }>;
    registerFile(input: string, format: 'alink' | 'dsh', signal?: AbortSignal): Promise<SourceSession>;
    close(): Promise<void>;
}
export {};
