export declare const MAPPING_VERSION: "2";
import type { MappingReport, TargetSelection, PortableResource } from './contracts.js';
import { type FrozenHistory } from './dsh/history.js';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
export type PlannedBlock = {
    type: 'text';
    text: string;
} | {
    type: 'resource';
    resourceId: string;
};
export interface PlannedMessage {
    role: 'user' | 'assistant';
    content: PlannedBlock[];
    recordRef: string;
    timestamp?: number;
    presentation?: 'conversation' | 'context';
}
export interface MigrationPlan {
    archivePath: string;
    snapshotDigest: string;
    sourceApp: string;
    title: string;
    createdAt: number;
    target: TargetSelection;
    messages: PlannedMessage[];
    resources: PortableResource[];
    report: MappingReport;
}
export interface MappingLimits {
    maxTextBytes: number;
    maxMessages: number;
}
export type AdmittedResources = Record<string, ContentBlock>;
export declare function refreshReport(plan: MigrationPlan): void;
export declare function buildMigrationPlan(archivePath: string, target: TargetSelection, limits?: MappingLimits): Promise<MigrationPlan>;
export declare function freezeHistory(plan: MigrationPlan, targetSessionId: string, resources: AdmittedResources): Promise<FrozenHistory>;
