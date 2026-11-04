import path from 'node:path';
import { readJsonl, encode } from './sources/jsonl.js';
import { archiveDigest, readManifest, validateArchive } from './archive.js';
import type { MappingReport, MigrationIssue, TargetSelection, PortableResource, PortableEvent, IssueDisposition } from './contracts.js';
import { createImportedHistory, digest, type FrozenHistory } from './dsh/history.js';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
import { LinkError } from './transport.js';
export type PlannedBlock = { type: 'text'; text: string } | { type: 'resource'; resourceId: string };
export interface PlannedMessage { role: 'user' | 'assistant'; content: PlannedBlock[]; recordRef: string; timestamp?: number }
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
  plan.report.reportHash = digest({ snapshot: plan.snapshotDigest, target: plan.target, messages: plan.messages, resources: plan.resources, issues: plan.report.issues, mappingVersion: '1' });
}
export async function buildMigrationPlan(archivePath: string, target: TargetSelection, limits: MappingLimits = { maxTextBytes: 32 * 1024 ** 2, maxMessages: 50000 }): Promise<MigrationPlan> {
  await validateArchive(archivePath);
  const manifest = await readManifest(archivePath);
  const plan: MigrationPlan = { archivePath, snapshotDigest: await archiveDigest(archivePath), sourceApp: manifest.source.app,
    title: manifest.session.title || '迁入的会话', createdAt: Date.parse(manifest.captured_at), target,
    messages: [], resources: manifest.resources, report: { mappingVersion: '1', issues: [], counts: { native: 0, rendered: 0, 'archive-only': 0, missing: 0, blocked: 0 }, reportHash: '' } };
  const issue = (disposition: IssueDisposition, code: string, detail: string, event?: PortableEvent, resourceId?: string) => plan.report.issues.push({ disposition, code, detail, ...(event ? { recordRef: event.record_ref } : {}), ...(resourceId ? { resourceId } : {}) });
  for (const item of manifest.issues) issue(item.code === 'unresolved_history' || item.code === 'external_history_base' || item.code === 'dsh_surface_rewrite' ? 'blocked' : 'archive-only', item.code, item.detail);
  const calls = new Set<string>(), results = new Set<string>();
  for await (const e of readJsonl(path.join(archivePath, 'events.jsonl'))) {
    if (e.active === false || e.visible === false) continue;
    for (const b of e.content) if (b.type === 'tool_call') calls.add(b.call_id); else if (b.type === 'tool_result') results.add(b.call_id);
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
    if (e.kind === 'message' && ['user', 'assistant'].includes(e.role ?? '') || e.kind === 'artifact') {
      const content: PlannedBlock[] = [], attachmentContext: PlannedBlock[] = [];
      for (const block of e.content) {
        if (block.type === 'text') content.push({ type: 'text', text: String(block.text ?? '') });
        else if (block.type === 'resource') {
          const resource = manifest.resources.find(r => r.id === block.resource_id)!; used.add(resource.id);
          if (resource.status === 'embedded') {
            const part: PlannedBlock = { type: 'resource', resourceId: resource.id };
            // File attachments are native user-context blocks; keep original assistant prose intact.
            if (e.role === 'user') content.push(part); else attachmentContext.push(part);
            issue('native', 'attachment', '保存到 DSH 附件库；原始字节保留在备份中', e, resource.id);
          } else {
            content.push({ type: 'text', text: `[历史资源未迁入：${resource.status}；${resource.uri}]` });
            issue(resource.status === 'missing' ? 'missing' : 'archive-only', 'resource_unavailable', resource.status, e, resource.id);
          }
        } else issue('archive-only', 'unsupported_block', '不支持的内容块保留在备份中', e);
      }
      if (content.length) { add({ role: e.role === 'user' ? 'user' : 'assistant', content, recordRef: e.record_ref, ...time }); issue('native', 'message', '正文保持原文', e); }
      if (attachmentContext.length) {
        add({ role: 'user', content: [{ type: 'text', text: `[从 ${plan.sourceApp} 导入的历史产物]` }, ...attachmentContext], recordRef: e.record_ref, ...time });
        issue('rendered', 'artifact_context', '附件以明确标注的历史上下文关联，原助手正文保持不变', e);
      }
    } else if (e.kind === 'tool_call' || e.kind === 'tool_result') {
      const lines = [`[从 ${plan.sourceApp} 导入的工具历史；不会执行]`];
      for (const b of e.content) {
        if (b.type === 'tool_call') { lines.push(`工具：${b.name ?? ''}；调用：${b.call_id ?? ''}`, `参数：${typeof b.arguments === 'string' ? b.arguments : encode(b.arguments)}`); if (!results.has(String(b.call_id))) lines.push('来源未提供对应结果。'); }
        else if (b.type === 'tool_result') { lines.push(`调用：${b.call_id ?? ''}`, `结果：${typeof b.output === 'string' ? b.output : encode(b.output)}`); if (b.status !== undefined) lines.push(`状态：${String(b.status)}`); if (!calls.has(String(b.call_id))) lines.push('来源未提供对应调用。'); }
        else lines.push(b.type === 'text' ? String(b.text ?? '') : encode(b));
      }
      add({ role: 'assistant', content: [{ type: 'text', text: lines.join('\n') }], recordRef: e.record_ref, ...time }); issue('rendered', 'tool_history', '作为可读历史，不注册或执行来源工具', e);
    } else issue('archive-only', 'unsupported_event', '来源角色或私有事件仅保留在备份中', e);
  }
  for (const resource of manifest.resources) if (!used.has(resource.id)) issue('archive-only', 'unmapped_resource', '未关联到活动消息的资源保留在备份', undefined, resource.id);
  if (plan.messages.length) issue('rendered', 'reconstructed_history', 'DSH 的轮次与流式展示由导入消息重建，不代表来源中的原生执行事件');
  if (!plan.messages.length) issue('blocked', 'empty_history', '没有可迁入的活动消息');
  refreshReport(plan); return plan;
}
export async function freezeHistory(plan: MigrationPlan, targetSessionId: string, resources: AdmittedResources): Promise<FrozenHistory> {
  if (plan.report.counts.blocked) throw new LinkError('HISTORY_BLOCKED', '来源上下文不完整，不能迁入为可继续会话');
  return createImportedHistory({ id: targetSessionId, cwd: plan.target.cwd, agentPreset: plan.target.agentPreset, title: plan.title, createdAt: plan.createdAt,
    messages: plan.messages.map(m => ({ role: m.role, text: '', timestamp: m.timestamp, content: m.content.map(b => {
      if (b.type === 'text') return b;
      if (!resources[b.resourceId]) throw new LinkError('RESOURCE_NOT_ADMITTED');
      return resources[b.resourceId];
    }) })) });
}
