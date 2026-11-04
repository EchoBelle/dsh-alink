import { createHash } from 'node:crypto';
import path from 'node:path';
import type { Eligibility, SourceApp, SourceSession } from '../contracts.js';
export type SourceRoots = Partial<Record<SourceApp, string>>;
export interface SourceLocator extends SourceSession { root: string; file: string; eligibility: Eligibility; resourceRoots?: readonly string[] }
export type NativeRow = Record<string, any>;
export function sourceKey(app: SourceApp, root: string, id: string): string {
  return app + ':' + createHash('sha256').update(path.resolve(root) + '\0' + id).digest('hex').slice(0, 32);
}
export function asRecord(value: unknown): NativeRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unsupported source record');
  return value as NativeRow;
}
export function flag(value: unknown): boolean { return value !== undefined && value !== null && value !== false && value !== 0 && value !== 0n && value !== '' && value !== '0' && value !== 'false'; }
export function binaryState(value: unknown): 0 | 1 | undefined {
  if (value === 0 || value === 0n || value === false) return 0;
  if (value === 1 || value === 1n || value === true) return 1;
  return undefined;
}
export const workBuddyActiveStatuses = new Set(['completed', 'running', 'idle', 'pending', 'waiting', 'paused', 'failed', 'error', 'stopped', 'working', 'active', 'in_progress']);
export function eligibility(row: NativeRow, proven: boolean): Eligibility {
  if (flag(row.deleted_at) || flag(row.isDeleted) || ['deleted', 'removed'].includes(String(row.status).toLowerCase())) return 'deleted';
  if (['archived', 'archive'].includes(String(row.status).toLowerCase()) || ['archived', 'is_archived', 'isArchived'].some(k => binaryState(row[k]) === 1) || flag(row.archived_at)) return 'archived';
  if (binaryState(row.available) === 0) return 'archived';
  return proven ? 'active' : 'unknown';
}
export function number(value: unknown): number | undefined {
  const n = Number(value); return value !== null && value !== undefined && Number.isSafeInteger(n) && n >= 0 ? n : undefined;
}
