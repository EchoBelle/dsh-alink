import { DatabaseSync } from 'node:sqlite';
export declare function withReadonlyDatabase<T>(file: string, operation: (db: DatabaseSync) => T | Promise<T>, signal?: AbortSignal): Promise<T>;
export declare function tableColumns(db: DatabaseSync, table: string): Set<string>;
export declare function portableRow(row: Record<string, unknown>): Record<string, unknown>;
export declare function captureNativeRows(builder: import('../archive.js').ArchiveBuilder, file: string, queries: ReadonlyArray<readonly [string, string, string]>, signal?: AbortSignal): Promise<void>;
