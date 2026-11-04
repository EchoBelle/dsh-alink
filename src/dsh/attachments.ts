import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { AttachmentStore, ImageMediaType } from '@deepseek-ai/dsh-attachment';
import type { PortableResource } from '../contracts.js';
import { refreshReport, type AdmittedResources, type MigrationPlan } from '../mapping.js';
import { LinkError } from '../transport.js';
function imageType(resource: PortableResource): ImageMediaType | undefined {
  const mime = resource.media_type ?? ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' } as Record<string, string>)[path.extname(resource.uri).toLowerCase()];
  return ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mime ?? '') ? mime as ImageMediaType : undefined;
}
function usedResources(plan: MigrationPlan) { return new Set(plan.messages.flatMap(m => m.content.flatMap(b => b.type === 'resource' ? [b.resourceId] : []))); }
function name(resource: PortableResource) { return path.basename(resource.uri.startsWith('sha256:') ? resource.id : resource.uri).replace(/[\\/]/g, '_'); }
async function imageInput(plan: MigrationPlan, resource: PortableResource, store: AttachmentStore) {
  if (resource.size! > store.imageLimits.maxImageBytes) throw new LinkError('IMAGE_NOT_ADMITTED', 'Image exceeds target limit');
  const data = await readFile(path.join(plan.archivePath, resource.path!));
  if (createHash('sha256').update(data).digest('hex') !== resource.sha256) throw new LinkError('RESOURCE_CHANGED');
  return { data, mediaType: imageType(resource)!, name: name(resource) };
}
export async function validatePlannedImages(plan: MigrationPlan, store: AttachmentStore): Promise<void> {
  const used = usedResources(plan);
  for (const resource of plan.resources) {
    if (!used.has(resource.id) || !imageType(resource)) continue;
    try { await store.validateImage(await imageInput(plan, resource, store)); }
    catch (error) {
      if (error instanceof LinkError && error.code !== 'IMAGE_NOT_ADMITTED') throw error;
      if (!(error instanceof LinkError) && !store.isAttachmentError(error)) throw error;
      for (const m of plan.messages) m.content = m.content.map(b => b.type === 'resource' && b.resourceId === resource.id ? { type: 'text', text: `[历史图片未迁入：${name(resource)}；目标不支持该图片]` } : b);
      plan.report.issues = plan.report.issues.filter(i => !(i.resourceId === resource.id && i.code === 'attachment'));
      plan.report.issues.push({ code: 'image_not_admitted', disposition: 'archive-only', resourceId: resource.id, detail: '目标图片限制或编码校验未通过，原图保留在备份中' });
    }
  }
  for (const message of plan.messages) {
    let count = 0, bytes = 0;
    message.content = message.content.map(block => {
      if (block.type !== 'resource') return block;
      const resource = plan.resources.find(r => r.id === block.resourceId)!;
      if (!imageType(resource)) return block;
      if (count >= store.imageLimits.maxImagesPerMessage || bytes + resource.size! > store.imageLimits.maxMessageImageBytes) {
        const existing = plan.report.issues.findLastIndex(i => i.code === 'attachment' && i.resourceId === resource.id && i.recordRef === message.recordRef);
        if (existing >= 0) plan.report.issues.splice(existing, 1);
        plan.report.issues.push({ code: 'message_image_limit', disposition: 'archive-only', recordRef: message.recordRef, resourceId: resource.id, detail: '超过目标单条消息图片上限，原图保留在备份中' });
        return { type: 'text', text: `[历史图片未迁入：${name(resource)}；超过单条消息图片上限]` };
      }
      count++; bytes += resource.size!; return block;
    });
  }
  refreshReport(plan);
}
export async function admitResources(plan: MigrationPlan, store: AttachmentStore, signal?: AbortSignal): Promise<AdmittedResources> {
  const result: AdmittedResources = {}, used = usedResources(plan);
  for (const resource of plan.resources) {
    if (!used.has(resource.id)) continue;
    signal?.throwIfAborted();
    if (imageType(resource)) result[resource.id] = { type: 'image', attachment: await store.saveImage(await imageInput(plan, resource, store)) };
    else {
      const hash = createHash('sha256');
      const data = async function* () {
        for await (const chunk of createReadStream(path.join(plan.archivePath, resource.path!), { signal })) { hash.update(chunk); yield chunk; }
      };
      const attachment = await store.saveFileStream({ data: data(), signal, name: name(resource) });
      if (hash.digest('hex') !== resource.sha256 || attachment.bytes !== resource.size) throw new LinkError('RESOURCE_CHANGED');
      result[resource.id] = { type: 'file', attachment };
    }
  }
  return result;
}
