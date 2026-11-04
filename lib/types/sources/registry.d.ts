import type { CaptureResult, Page, SourceApp, SourceSession } from '../contracts.js';
import type { SourceLocator, SourceRoots } from './types.js';
export declare function defaultRoots(): SourceRoots;
export declare class SourceRegistry {
    readonly roots: SourceRoots;
    readonly resourceRoots: readonly string[];
    constructor(roots?: SourceRoots, resourceRoots?: readonly string[]);
    private discover;
    sources(): Promise<({
        app: "workbuddy" | "codex" | "raccoon" | "cursor";
        available: boolean;
        count: number;
        unknown: boolean;
        error?: undefined;
    } | {
        app: "workbuddy" | "codex" | "raccoon" | "cursor";
        available: boolean;
        count: number;
        error: string;
        unknown?: undefined;
    })[]>;
    sessions(app: SourceApp, query?: {
        text?: string;
        cursor?: string;
        limit?: number;
    }): Promise<Page<SourceSession>>;
    assertActive(sourceId: string): Promise<SourceLocator>;
    capture(sourceId: string, destination: string, signal?: AbortSignal): Promise<CaptureResult>;
}
