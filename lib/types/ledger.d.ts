import type { Operation } from './contracts.js';
export declare class Ledger {
    private readonly writer;
    private readonly reader;
    private writing;
    constructor(file: string);
    savePreview(id: string, value: unknown): void;
    preview<T>(id: string): T | undefined;
    operation(id: string): Operation | undefined;
    operations(): Operation[];
    reserve(preview: string, dedup: string, requestId: string, title: string): Operation;
    hide(id: string): void;
    update(operation: Operation): void;
    withWriter<T>(action: () => Promise<T>): Promise<T>;
    reconcile(active?: ReadonlySet<string>): void;
    close(): void;
}
