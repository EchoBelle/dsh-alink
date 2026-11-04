import Schema from '@deepseek-ai/schemastery';
import type { SourceRoots } from './sources/types.js';
export interface Config {
    dataDir?: string;
    sourceRoots?: SourceRoots;
    resourceRoots: string[];
    maxTextBytes: number;
    maxMessages: number;
}
export declare const Config: Schema<Config>;
