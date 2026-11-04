import { type SourceLocator } from './types.js';
export declare function discoverCursor(root: string): Promise<SourceLocator[]>;
export declare function captureCursor(source: SourceLocator, destination: string, signal?: AbortSignal): Promise<import("../contracts.js").CaptureResult>;
