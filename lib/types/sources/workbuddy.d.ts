import { type SourceLocator } from './types.js';
export declare function discoverWorkBuddy(root: string): Promise<SourceLocator[]>;
export declare function captureWorkBuddy(source: SourceLocator, destination: string, signal?: AbortSignal): Promise<import("../contracts.js").CaptureResult>;
