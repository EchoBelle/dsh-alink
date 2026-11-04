import type { ArchiveManifest, CaptureResult, ObjectRef, PortableEvent, SourceApp } from './contracts.js';
export declare function fileHash(file: string): Promise<string>;
export declare function readManifest(root: string): Promise<ArchiveManifest>;
export declare function readEvents(root: string): Promise<PortableEvent[]>;
export declare function archiveDigest(root: string): Promise<string>;
export declare class ArchiveBuilder {
    readonly root: string;
    readonly maxBytes: number;
    private records;
    private events;
    private bytes;
    readonly manifest: ArchiveManifest;
    private constructor();
    static create(root: string, app: SourceApp, format: string, session: ArchiveManifest['session'], maxBytes?: number): Promise<ArchiveBuilder>;
    private line;
    record(value: unknown, locator: Record<string, unknown>): Promise<string>;
    event(record_ref: string, kind: string, attrs?: Partial<PortableEvent>): Promise<void>;
    issue(code: string, detail: string): void;
    object(data: Uint8Array): Promise<ObjectRef>;
    objectFile(file: string, signal?: AbortSignal): Promise<ObjectRef>;
    originalFile(file: string, name?: string, signal?: AbortSignal): Promise<string>;
    resource(uri: string, record_ref: string, allowedRoots: readonly string[], media_type?: string): Promise<string>;
    close(): Promise<void>;
    finish(): Promise<CaptureResult>;
}
export declare function validateArchive(root: string): Promise<void>;
export declare function exportArchive(root: string, destination: string): Promise<void>;
export declare function importArchive(input: string, destination: string, signal: AbortSignal, limits?: {
    maxBytes: number;
    maxEntries: number;
}): Promise<CaptureResult>;
