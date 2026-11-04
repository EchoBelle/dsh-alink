import type { Context } from '@deepseek-ai/cordis';
import type { Transfer } from '../contracts.js';
/** Choose the destination before creating a job; stream directly into the selected file. */
export declare function exportToFile(ctx: Context, create: () => Promise<Transfer>, update: (job: Transfer) => void, suggestedName: string): Promise<{
    job: Transfer;
    name: string;
} | undefined>;
