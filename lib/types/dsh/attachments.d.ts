import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import { type AdmittedResources, type MigrationPlan } from '../mapping.js';
export declare function validatePlannedImages(plan: MigrationPlan, store: AttachmentStore): Promise<void>;
export declare function admitResources(plan: MigrationPlan, store: AttachmentStore, signal?: AbortSignal): Promise<AdmittedResources>;
