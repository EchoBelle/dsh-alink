import type { Eligibility, SourceApp, SourceSession } from '../contracts.js';
export type SourceRoots = Partial<Record<SourceApp, string>>;
export interface SourceLocator extends SourceSession {
    root: string;
    file: string;
    eligibility: Eligibility;
    resourceRoots?: readonly string[];
}
export type NativeRow = Record<string, any>;
export declare function sourceKey(app: SourceApp, root: string, id: string): string;
export declare function asRecord(value: unknown): NativeRow;
export declare function flag(value: unknown): boolean;
export declare function binaryState(value: unknown): 0 | 1 | undefined;
export declare const workBuddyActiveStatuses: Set<string>;
export declare function eligibility(row: NativeRow, proven: boolean): Eligibility;
export declare function number(value: unknown): number | undefined;
