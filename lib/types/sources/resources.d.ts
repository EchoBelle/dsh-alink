import type { ArchiveBuilder } from '../archive.js';
import type { PortableBlock } from '../contracts.js';
export declare function normalizeBlocks(value: unknown, builder: ArchiveBuilder, ref: string, roots: readonly string[]): Promise<PortableBlock[]>;
export declare function normalizeResponse(row: Record<string, any>, builder: ArchiveBuilder, ref: string, roots: readonly string[], codex?: boolean, timestamp?: string | number): Promise<void>;
