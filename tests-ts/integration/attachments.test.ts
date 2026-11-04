import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Context } from '@deepseek-ai/cordis';
import AttachmentLocal from '@deepseek-ai/dsh-attachment-local';
import * as Persistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import { ArchiveBuilder } from '../../src/archive.js';
import { buildMigrationPlan, freezeHistory } from '../../src/mapping.js';
import { validatePlannedImages, admitResources } from '../../src/dsh/attachments.js';
import { persistHistory, verifyHistory } from '../../src/dsh/persistence.js';

it('imports real DSH file attachments and validates native durable references', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-attachments-'));
  const ctx = new Context();
  const attachmentPlugin = await ctx.plugin(AttachmentLocal, { dshHome: root });
  const persistencePlugin = await ctx.plugin(Persistence, { root: path.join(root, 'sessions'), compression: 'none' });
  try {
    const b = await ArchiveBuilder.create(path.join(root, 'archive'), 'workbuddy', 'responses-jsonl', {});
    const ref = await b.record({}, {});
    const file = await b.resource('data:text/plain;base64,aGVsbG8=', ref, []);
    await b.event(ref, 'message', { role: 'user', content: [{ type: 'text', text: 'File' }, { type: 'resource', resource_id: file }] });
    const archive = await b.finish(); const plan = await buildMigrationPlan(archive.archivePath, { cwd: root, agentPreset: 'standard' });
    await validatePlannedImages(plan, ctx.attachments);
    const admitted = await admitResources(plan, ctx.attachments);
    const block = admitted[file]; expect(block.type).toBe('file');
    if (block.type !== 'file') throw new Error('wrong attachment type');
    const chunks = []; for await (const chunk of ctx.attachments.readFileStream(block.attachment)) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe('hello');
    const history = await freezeHistory(plan, 'file-import', admitted);
    await persistHistory(ctx.sessionPersistence, history); await verifyHistory(ctx.sessionPersistence, history);
  } finally { await persistencePlugin.dispose(); await attachmentPlugin.dispose(); await rm(root, { recursive: true, force: true }); }
});

it('previews unsupported images without saving them', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-images-'));
  const ctx = new Context(); const plugin = await ctx.plugin(AttachmentLocal, { dshHome: root, maxImagesPerMessage: 1 });
  try {
    const b = await ArchiveBuilder.create(path.join(root, 'archive'), 'workbuddy', 'responses-jsonl', {});
    const ref = await b.record({}, {});
    const bad = await b.resource('data:image/png;base64,bm90LXBuZw==', ref, []);
    await b.event(ref, 'message', { role: 'user', content: [{ type: 'text', text: 'keep me' }, { type: 'resource', resource_id: bad }] });
    const result = await b.finish(), plan = await buildMigrationPlan(result.archivePath, { cwd: root, agentPreset: 'standard' });
    await validatePlannedImages(plan, ctx.attachments);
    expect(plan.report.issues.some(x => x.code === 'image_not_admitted')).toBe(true);
    expect(plan.messages[0].content[0]).toEqual({ type: 'text', text: 'keep me' });
    expect(await admitResources(plan, ctx.attachments)).toEqual({});
  } finally { await plugin.dispose(); await rm(root, { recursive: true, force: true }); }
});

it('admits valid pixels but explicitly degrades images beyond the target message limit', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-image-limit-'));
  const ctx = new Context(); const plugin = await ctx.plugin(AttachmentLocal, { dshHome: root, maxImagesPerMessage: 1 });
  try {
    const { createRequire } = await import('node:module');
    const sharp = createRequire(createRequire(import.meta.url).resolve('@deepseek-ai/dsh-attachment-local'))('sharp');
    const pixels = await sharp({ create: { width: 1, height: 1, channels: 4, background: '#ff0000' } }).png().toBuffer();
    const b = await ArchiveBuilder.create(path.join(root, 'p'), 'workbuddy', 'responses-jsonl', {});
    const ref = await b.record({}, {}), resource = await b.resource('data:image/png;base64,' + pixels.toString('base64'), ref, []);
    await b.event(ref, 'message', { role: 'user', content: [{ type: 'resource', resource_id: resource }, { type: 'resource', resource_id: resource }] });
    const archive = await b.finish(), plan = await buildMigrationPlan(archive.archivePath, { cwd: root, agentPreset: 'standard' });
    await validatePlannedImages(plan, ctx.attachments);
    expect(plan.messages[0].content.filter(b => b.type === 'resource')).toHaveLength(1);
    expect(plan.report.issues.some(i => i.code === 'message_image_limit')).toBe(true);
    const admitted = await admitResources(plan, ctx.attachments); expect(admitted[resource].type).toBe('image');
    if (admitted[resource].type === 'image') expect((await ctx.attachments.readImage(admitted[resource].attachment)).ref.width).toBe(1);
  } finally { await plugin.dispose(); await rm(root, { recursive: true, force: true }); }
});
