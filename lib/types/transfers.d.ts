import type { Transfer, TransferRequest } from './contracts.js';
import { MigrationService } from './operations.js';
export declare class Transfers {
    readonly directory: string;
    private readonly service;
    private readonly values;
    private readonly controllers;
    private tail;
    private closed;
    private constructor();
    static create(directory: string, service: MigrationService): Promise<Transfers>;
    private save;
    private public;
    list(): Transfer[];
    get(id: string): Transfer;
    private stored;
    start(request: TransferRequest): Promise<Transfer>;
    private enqueue;
    retry(id: string): Promise<Transfer>;
    cancel(id: string): Transfer;
    download(id: string): Promise<string>;
    private run;
    close(): Promise<void>;
}
