import type { Context } from '@deepseek-ai/cordis';
import type { Config as PluginConfig } from './config.js';
export { Config } from './config.js';
export declare const name = "dsh-alink";
export declare const inject: string[];
export declare function apply(ctx: Context, config: PluginConfig): Promise<void>;
