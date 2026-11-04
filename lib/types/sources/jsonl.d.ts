export declare const MAX_LINE_BYTES: number;
export declare const MAX_ARCHIVE_BYTES: number;
export declare function encode(value: unknown): string;
export declare function readJsonl(file: string, options?: {
    signal?: AbortSignal;
    maxLineBytes?: number;
    lossless?: boolean;
}): AsyncGenerator<any>;
export declare function readJsonStream(input: AsyncIterable<Buffer>, options?: {
    signal?: AbortSignal;
    maxLineBytes?: number;
    lossless?: boolean;
}): AsyncGenerator<any>;
export declare function snapshotFile(source: string, destination: string, maxBytes?: number, signal?: AbortSignal): Promise<void>;
