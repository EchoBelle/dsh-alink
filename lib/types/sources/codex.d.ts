import { type SourceLocator } from './types.js';
export declare function discoverCodex(root: string): Promise<SourceLocator[]>;
export declare function captureCodex(source: SourceLocator, destination: string, signal?: AbortSignal): Promise<import("../contracts.js").CaptureResult>;
