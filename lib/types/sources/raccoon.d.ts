import { type SourceLocator } from './types.js';
export declare function discoverRaccoon(root: string): Promise<SourceLocator[]>;
export declare function captureRaccoon(source: SourceLocator, destination: string, signal?: AbortSignal): Promise<import("../contracts.js").CaptureResult>;
