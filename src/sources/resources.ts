import type { ArchiveBuilder } from '../archive.js';
import type { PortableBlock } from '../contracts.js';
import { asRecord } from './types.js';
export async function normalizeBlocks(value: unknown, builder: ArchiveBuilder, ref: string, roots: readonly string[]): Promise<PortableBlock[]> {
  if (typeof value === 'string') return [{ type: 'text', text: value }];
  if (value === undefined || value === null) return [];
  const result: PortableBlock[] = [];
  for (const item of Array.isArray(value) ? value : [value]) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) { result.push({ type: 'opaque', value: item }); continue; }
    const block = asRecord(item), kind = String(block.type ?? 'unknown');
    if (['text', 'input_text', 'output_text'].includes(kind) && typeof block.text === 'string') result.push({ type: 'text', text: block.text });
    else if (['image', 'input_image', 'image_url', 'file', 'audio', 'input_audio', 'video'].includes(kind)) {
      let uri = block.image_url ?? block.url ?? block.path ?? block.file_url;
      if (uri && typeof uri === 'object') uri = uri.url;
      if (!uri && block.source?.type === 'base64') uri = `data:${block.source.media_type ?? 'application/octet-stream'};base64,${block.source.data ?? ''}`;
      if (typeof uri === 'string' && uri) result.push({ type: 'resource', resource_id: await builder.resource(uri, ref, roots), native_type: kind });
      else result.push({ type: 'opaque', native_type: kind, value: item });
    } else result.push({ type: 'opaque', native_type: kind, value: item });
  }
  return result;
}
export async function normalizeResponse(row: Record<string, any>, builder: ArchiveBuilder, ref: string, roots: readonly string[], codex = false, timestamp?: string | number): Promise<void> {
  const kind = String(row.type ?? 'unknown');
  const attrs = { native_type: kind, ...(['analysis', 'summary'].includes(row.channel) || (row.recipient && row.recipient !== 'all') ? { projection: 'auxiliary' as const } : {}), ...(row.id === undefined ? {} : { native_id: String(row.id) }),
    ...(row.parentId === undefined ? {} : { parent_native_id: String(row.parentId) }),
    ...(timestamp === undefined && row.timestamp === undefined ? {} : { timestamp: timestamp ?? row.timestamp }) };
  if (kind === 'message') await builder.event(ref, 'message', { ...attrs, role: String(row.role ?? 'unknown'), content: await normalizeBlocks(row.content, builder, ref, roots) });
  else if (kind === 'reasoning') await builder.event(ref, 'reasoning', { ...attrs, role: 'assistant', content: await normalizeBlocks(codex ? row.summary : row.content ?? row.rawContent, builder, ref, roots) });
  else if (['function_call', 'custom_tool_call'].includes(kind)) await builder.event(ref, 'tool_call', { ...attrs, role: 'assistant', content: [{ type: 'tool_call', call_id: String(row.call_id ?? row.callId ?? ''), name: String(row.name ?? ''), arguments: row.arguments ?? row.input ?? '', argument_encoding: kind === 'custom_tool_call' ? 'text' : 'json_string' }] });
  else if (['function_call_result', 'function_call_output', 'custom_tool_call_output'].includes(kind)) await builder.event(ref, 'tool_result', { ...attrs, role: 'tool', content: [{ type: 'tool_result', call_id: String(row.call_id ?? row.callId ?? ''), name: String(row.name ?? ''), output: row.output ?? null, ...(row.status === undefined ? {} : { status: row.status }) }] });
  else await builder.event(ref, kind === 'ai-title' ? 'metadata' : kind === 'file-history-snapshot' ? 'checkpoint' : 'opaque', { ...attrs, projection: 'auxiliary' });
}
