import Schema from '@deepseek-ai/schemastery';
import type { SourceRoots } from './sources/types.js';
export interface Config { dataDir?: string; sourceRoots?: SourceRoots; resourceRoots: string[]; maxTextBytes: number; maxMessages: number }
export const Config: Schema<Config> = Schema.object({
  dataDir: Schema.string(),
  sourceRoots: Schema.object({ workbuddy: Schema.string(), codex: Schema.string(), raccoon: Schema.string(), cursor: Schema.string(), dsh: Schema.string() }),
  resourceRoots: Schema.array(Schema.string()).default([]),
  maxTextBytes: Schema.number().min(1).step(1).default(32 * 1024 ** 2),
  maxMessages: Schema.number().min(1).step(1).default(50000),
});
