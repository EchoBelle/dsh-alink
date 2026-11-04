import { type SourceLocator } from './types.js';
export declare function legacyRows(file: string, signal?: AbortSignal): AsyncGenerator<any, void, any>;
export declare function discoverLegacy(root: string): Promise<SourceLocator[]>;
export declare function captureLegacy(source: SourceLocator, destination: string, signal?: AbortSignal): Promise<import("../contracts.js").CaptureResult>;
