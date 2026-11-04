import type { ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection/client';
const errors: Record<string, string> = {
  PREVIEW_NOT_FOUND: '对话读取已过期，请重新读取。',
  SOURCE_HISTORY_MISSING: '来源历史日志尚未完整保存，请在原应用打开该会话后重试。',
  MAPPING_CHANGED: '迁入规则已更新，请重新导入以生成仅包含对话的新会话。',
  CANCELED: '任务已停止。', EXPORT_NOT_READY: '导出文件尚未准备好。', TRANSFER_NOT_FOUND: '任务记录不存在，请刷新。',
  INTERRUPTED: '上次迁移中断，原目标会话标识已保留。请重新核对并重试。',
  SOURCE_INACTIVE: '原会话已归档、删除或无法核实当前状态，不能迁移。请刷新来源。', SOURCE_ERROR: '来源暂时无法读取，请刷新后重试。',
  PREVIEW_CHANGED: '预览已改变，请重新生成迁移预览。', SNAPSHOT_CHANGED: '备份内容发生变化，请重新生成预览。',
  HISTORY_BLOCKED: '来源历史存在尚未解决的缺口，不能作为可继续会话导入。', CONTENT_LIMIT: '内容超过本次迁移容量限制，未截断正文。',
  TARGET_BUSY: '目标会话正在使用，请切换到其他会话后重试。',
  IMPORT_BUSY: '另一个迁移正在写入，请稍后重试。', TARGET_CHANGED: '目标会话或项目已改变，请检查现有记录。', TARGET_MISSING: '原迁入会话已不存在，不会自动重建。',
  PRESET_UNAVAILABLE: '所选 DSH 配置不可用，请重新选择。', INVALID_TARGET: '目标项目目录不存在或不可用。', FORBIDDEN: '只有 DSH 宿主所有者可以迁移会话。',
  PLUGIN_CLOSED: '迁移插件已停用，请重新打开。', IMPORT_FAILED: '操作未完成，请检查迁移记录后重试。', UNSUPPORTED_SOURCE: '该来源格式或版本尚未支持。',
  INVALID_SOURCE: '来源已失效，请重新选择。', REQUEST_CONFLICT: '操作标识发生冲突，请重新生成预览。', HISTORY_CHANGED: '已准备的目标历史发生变化，需要人工核对。',
  HISTORY_MISSING: '目标已存在，但缺少完整迁移凭据，需要人工核对。', RESOURCE_CHANGED: '备份资源发生变化，请重新生成预览。',
};
export function friendlyError(value: unknown): string {
  if (value && typeof value === 'object' && 'code' in value && typeof value.code === 'string' && errors[value.code]) return errors[value.code];
  return value instanceof Error ? value.message : '操作未完成，请重试。';
}
export async function call<T>(endpoint: string, payload: unknown = {}, signal?: AbortSignal): Promise<T> {
  const response = await fetch('api/dsh-alink.rpc', { method: 'POST', credentials: 'same-origin', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint, payload }) });
  const result = await response.json().catch(() => undefined) as ConnectionRpcResult<T> | undefined;
  if (result && !result.ok) throw Object.assign(new Error(result.error.message), { code: result.error.code });
  if (!response.ok || !result) throw new Error('与 DSH 的连接中断，请刷新后重试。');
  return result.value;
}
