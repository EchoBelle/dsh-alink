import path from 'node:path';
import { dialogueText } from './dialogue.js';
export const MAPPING_VERSION = '2' as const;
import { readJsonl } from './sources/jsonl.js';
import { archiveDigest, readManifest, validateArchive } from './archive.js';
import type { MappingReport, TargetSelection, PortableResource, PortableEvent, IssueDisposition } from './contracts.js';
import { createImportedHistory, digest, type FrozenHistory } from './dsh/history.js';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
import { LinkError } from './transport.js';
export type PlannedBlock = { type: 'text'; text: string } | { type: 'resource'; resourceId: string };
export interface PlannedMessage { role: 'user' | 'assistant'; content: PlannedBlock[]; recordRef: string; timestamp?: number; presentation?: 'conversation' | 'context' }
export interface MigrationPlan {
  archivePath: string; snapshotDigest: string; sourceApp: string; title: string; createdAt: number; target: TargetSelection;
  messages: PlannedMessage[]; resources: PortableResource[]; report: MappingReport;
}
export interface MappingLimits { maxTextBytes: number; maxMessages: number }
export type AdmittedResources = Record<string, ContentBlock>;
export function refreshReport(plan: MigrationPlan): void {
  const counts: MappingReport['counts'] = { native: 0, rendered: 0, 'archive-only': 0, missing: 0, blocked: 0 };
  for (const issue of plan.report.issues) counts[issue.disposition]++;
  plan.report.counts = counts;
  plan.report.reportHash = digest({ snapshot: plan.snapshotDigest, target: plan.target, messages: plan.messages, resources: plan.resources, issues: plan.report.issues, mappingVersion: MAPPING_VERSION });
}
export async function buildMigrationPlan(archivePath: string, target: TargetSelection, limits: MappingLimits = { maxTextBytes: 32 * 1024 ** 2, maxMessages: 50000 }): Promise<MigrationPlan> {
  await validateArchive(archivePath);
  const manifest = await readManifest(archivePath);
  const plan: MigrationPlan = { archivePath, snapshotDigest: await archiveDigest(archivePath), sourceApp: manifest.source.app,
    title: manifest.session.title || '迁入的会话', createdAt: Date.parse(manifest.captured_at), target,
    messages: [], resources: manifest.resources, report: { mappingVersion: MAPPING_VERSION, issues: [], counts: { native: 0, rendered: 0, 'archive-only': 0, missing: 0, blocked: 0 }, reportHash: '' } };
  const issue = (disposition: IssueDisposition, code: string, detail: string, event?: PortableEvent, resourceId?: string) => plan.report.issues.push({ disposition, code, detail, ...(event ? { recordRef: event.record_ref } : {}), ...(resourceId ? { resourceId } : {}) });
  for (const item of manifest.issues) {
    const gap = ['missing_dialogue_history', 'unresolved_history', 'external_history_base'].includes(item.code) && item.detail !== 'Source compaction has not been reconstructed';
    issue(item.code === 'dsh_surface_rewrite' ? 'blocked' : gap ? 'missing' : 'archive-only', item.code, item.detail);
  }
  let bytes = 0;
  const add = (message: PlannedMessage) => {
    bytes += message.content.reduce((n, b) => n + (b.type === 'text' ? Buffer.byteLength(b.text) : 0), 0);
    if (bytes > limits.maxTextBytes || plan.messages.length >= limits.maxMessages) throw new LinkError('CONTENT_LIMIT', '会话超过本次迁移容量限制，未截断正文');
    plan.messages.push(message);
  };
  const used = new Set<string>();
  for await (const e of readJsonl(path.join(archivePath, 'events.jsonl'), { lossless: true }) as AsyncIterable<PortableEvent>) {
    if (e.active === false || e.visible === false || e.projection === 'auxiliary') { issue('archive-only', 'inactive_or_auxiliary', '仅保存原记录', e); continue; }
    const timestamp = typeof e.timestamp === 'number' ? e.timestamp : typeof e.timestamp === 'string' ? Date.parse(e.timestamp) : undefined;
    const time = timestamp !== undefined && Number.isSafeInteger(timestamp) && timestamp >= 0 ? { timestamp } : {};
    if (e.kind !== 'message' || !['user', 'assistant'].includes(e.role ?? '')) {
      issue('archive-only', 'non_dialogue', '非对话记录仅保留在导出包中', e); continue;
    }
    const content: PlannedBlock[] = [];
    for (const block of e.content) {
      if (block.type === 'text') {
        const text = dialogueText(e.role!, String(block.text ?? ''));
        if (text !== undefined) content.push({ type: 'text', text });
        else issue('archive-only', 'harness_context', '来源环境与规则不写入对话', e);
      } else if (block.type === 'resource') {
        const resource = manifest.resources.find(r => r.id === block.resource_id)!;
        if (e.role === 'user' && resource.status === 'embedded') {
          used.add(resource.id); content.push({ type: 'resource', resourceId: resource.id });
          issue('native', 'attachment', '保留用户消息中的附件', e, resource.id);
        } else issue('archive-only', 'unmapped_resource', '附件保留在导出包中', e, resource.id);
      } else issue('archive-only', 'unsupported_block', '非对话内容块仅保留在导出包中', e);
    }
    if (content.length) {
      add({ role: e.role as 'user' | 'assistant', content, recordRef: e.record_ref, presentation: 'conversation', ...time });
      issue('native', 'message', '保留对话正文', e);
    }
  }
  for (const resource of manifest.resources) if (!used.has(resource.id)) issue('archive-only', 'unmapped_resource', '未关联到活动消息的资源保留在备份', undefined, resource.id);
  if (plan.messages.length) issue('rendered', 'reconstructed_history', 'DSH 的轮次与流式展示由导入消息重建，不代表来源中的原生执行事件');
  if (!plan.messages.length) issue('blocked', 'empty_history', '没有可迁入的活动消息');
  refreshReport(plan); return plan;
}
export async function freezeHistory(plan: MigrationPlan, targetSessionId: string, resources: AdmittedResources): Promise<FrozenHistory> {
  if (plan.report.mappingVersion !== MAPPING_VERSION) throw new LinkError('MAPPING_CHANGED');
  if (plan.report.counts.blocked) throw new LinkError('HISTORY_BLOCKED', '来源上下文不完整，不能迁入为可继续会话');
  return createImportedHistory({ id: targetSessionId, cwd: plan.target.cwd, agentPreset: plan.target.agentPreset, title: plan.title, createdAt: plan.createdAt,
    messages: plan.messages.map(m => ({ role: m.role, text: '', timestamp: m.timestamp, content: m.content.map(b => {
      if (b.type === 'text') return b;
      if (!resources[b.resourceId]) throw new LinkError('RESOURCE_NOT_ADMITTED');
      return resources[b.resourceId];
    }) })) });
}
