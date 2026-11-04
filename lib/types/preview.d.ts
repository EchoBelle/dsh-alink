import type { MigrationPlan } from './mapping.js';
export declare function conversationMessages(plan: MigrationPlan): {
    role: "user" | "assistant";
    content: {
        type: "text";
        text: string;
    }[];
}[];
