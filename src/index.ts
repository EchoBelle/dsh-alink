import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-connection';
import type {} from '@deepseek-ai/dsh-session-persistence';
import type {} from '@deepseek-ai/dsh-attachment';
import type {} from '@deepseek-ai/dsh-workspace';
import type {} from '@deepseek-ai/dsh-agent-preset-registry';
import { dshHomePath, resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { mkdir, stat, rm } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { makeRpcHandler, LinkError, validateRequest, errorResult } from './transport.js';
import { Transfers } from './transfers.js';
import { MigrationService } from './operations.js';
import { WorkerRunner } from './sources/worker-client.js';
import { defaultRoots } from './sources/registry.js';
import { attachWorkspace } from './dsh/workspace.js';
import { MAX_ARCHIVE_BYTES } from './sources/jsonl.js';
import type { Config as PluginConfig } from './config.js';
export { Config } from './config.js';
export const name = 'dsh-alink';
export const inject = ['connection', 'sessionPersistence', 'attachments', 'workspaceRegistry', 'agentPresets'];
export async function apply(ctx: Context, config: PluginConfig): Promise<void> {
  const directory = path.resolve(config.dataDir || dshHomePath('storages', 'dsh-alink'));
  const shutdown = new AbortController();
  const service = await MigrationService.create({ directory, namespace: resolveDshHome(), roots: { ...defaultRoots(), ...Object.fromEntries(Object.entries(config.sourceRoots ?? {}).filter(([, value]) => typeof value === 'string')) }, resourceRoots: config.resourceRoots,
    limits: { maxTextBytes: config.maxTextBytes, maxMessages: config.maxMessages }, worker: new WorkerRunner(new URL('./source-worker.js', import.meta.url)),
    store: ctx.sessionPersistence, attachments: ctx.attachments,
    async resolveTarget(target) { const preset = await ctx.agentPresets.resolve(target.agentPreset); if (preset.broken) throw new LinkError('PRESET_UNAVAILABLE'); return { cwd: target.cwd, agentPreset: preset.id }; },
    attach: (cwd, id) => attachWorkspace(ctx.workspaceRegistry, cwd, id),
  });
  const transfers = await Transfers.create(path.join(directory, 'transfers'), service);
  const handler = makeRpcHandler(async (endpoint, payload, signal) => {
    const p = payload as Record<string, any>;
    switch (endpoint) {
      case 'transfers': return transfers.list();
      case 'transfer': return transfers.get(p.id);
      case 'cancelTransfer': return transfers.cancel(p.id);
      case 'retryTransfer': return transfers.retry(p.id);
      case 'importMany': return transfers.start({ requestId: p.requestId, kind: 'import', sourceIds: p.sourceIds, titles: p.titles, target: p.target });
      case 'exportMany': return transfers.start({ requestId: p.requestId, kind: 'export', sourceIds: p.sourceIds, titles: p.titles });
      case 'retryOperation': return service.retryOperation(p.operationId);
      case 'removeOperation': service.removeOperation(p.operationId); return { removed: true };
      case 'registerFiles': return service.registerFiles(p.path, p.format, signal);
      case 'sources': return service.sources();
      case 'sessions': return service.sessions(p.app, { text: p.text, cursor: p.cursor, limit: p.limit });
      case 'targets': return { workspaces: ctx.workspaceRegistry.list().map(w => ({ id: w.id, path: w.path, title: w.title })), presets: await ctx.agentPresets.list(), defaultPreset: ctx.agentPresets.defaultId };
      case 'inspect': return service.inspect(p.sourceId, signal);
      case 'inspectionPage': return service.inspectionPage(p.inspectionId, p.offset);
      case 'preview': return service.preview(p.sourceId, p.target, signal);
      case 'previewPage': return service.previewPage(p.previewId, p.offset);
      case 'commit': return service.commit({ previewId: p.previewId, reportHash: p.reportHash, requestId: p.requestId });
      case 'operation': return service.operation(p.operationId);
      case 'operations': return service.operations();
      case 'cancel': return service.cancel(p.operationId);
      case 'registerFile': return service.registerFile(p.path, p.format, signal);
      default: throw new LinkError('INVALID_REQUEST');
    }
  });
  const disposeRpc = ctx.connection.fetch.register({ path: '/api/dsh-alink.rpc', methods: ['POST'], requestBody: 'buffered', async fetch(request) {
    try {
      const bytes = await request.arrayBuffer(); if (bytes.byteLength > 1024 ** 2) throw new LinkError('REQUEST_LIMIT');
      const { endpoint, payload } = validateRequest(JSON.parse(Buffer.from(bytes).toString('utf8')));
      return Response.json(await handler(endpoint, payload, AbortSignal.any([request.signal, shutdown.signal]), ctx.connection.browserPeer));
    } catch (error) { return Response.json(errorResult(error), { status: 400 }); }
  } });
  const disposeDownload = ctx.connection.fetch.register({ path: '/api/dsh-alink.archive', methods: ['GET', 'HEAD'], requestBody: 'buffered', async fetch(request) {
    try {
      const id = new URL(request.url).searchParams.get('operationId') ?? '';
      const file = await service.download(id), info = await stat(file);
      return new Response(request.method === 'HEAD' ? null : Readable.toWeb(createReadStream(file)) as ReadableStream, {
        headers: { 'Content-Type': 'application/zip', 'Content-Length': String(info.size), 'Content-Disposition': `attachment; filename="dsh-alink-${service.operation(id).operationId}.alink.zip"`, 'Cache-Control': 'no-store' },
      });
    } catch (error) { return Response.json(errorResult(error), { status: 400 }); }
  } });
  const disposeExport = ctx.connection.fetch.register({ path: '/api/dsh-alink.export', methods: ['GET', 'HEAD'], requestBody: 'buffered', async fetch(request) {
    try {
      const id = new URL(request.url).searchParams.get('id') ?? '';
      const file = await transfers.download(id), info = await stat(file);
      return new Response(request.method === 'HEAD' ? null : Readable.toWeb(createReadStream(file)) as ReadableStream, {
        headers: { 'Content-Type': 'application/zip', 'Content-Length': String(info.size), 'Content-Disposition': `attachment; filename="Alink-${id}.zip"`, 'Cache-Control': 'no-store' },
      });
    } catch (error) { return Response.json(errorResult(error), { status: 400 }); }
  } });
  const disposeUpload = ctx.connection.fetch.register({ path: '/api/dsh-alink.upload', methods: ['POST'], requestBody: 'streaming', async fetch(request) {
    const temporary = path.join(directory, 'uploads', 'incoming-' + randomUUID());
    try {
      const query = new URL(request.url).searchParams, format = query.get('format');
      if (!request.body || !['alink', 'dsh'].includes(format ?? '')) throw new LinkError('INVALID_REQUEST');
      const isZstd = (query.get('filename') ?? '').toLowerCase().endsWith('.zstd');
      const file = path.join(temporary, format === 'alink' ? 'source.zip' : isZstd ? 'session.jsonl.zstd' : 'session.jsonl');
      await mkdir(temporary, { mode: 0o700 }); let total = 0;
      const signal = AbortSignal.any([request.signal, shutdown.signal]);
      await pipeline(Readable.fromWeb(request.body as never), new Transform({ transform(chunk, _encoding, callback) {
        total += chunk.length; callback(total > MAX_ARCHIVE_BYTES ? new LinkError('CONTENT_LIMIT') : null, chunk);
      } }), createWriteStream(file, { flags: 'wx', mode: 0o600 }), { signal });
      return Response.json({ ok: true, value: query.get('multiple') === '1' ? await service.registerFiles(file, format as 'alink' | 'dsh', signal) : await service.registerFile(file, format as 'alink' | 'dsh', signal) });
    } catch (error) { return Response.json(errorResult(error), { status: 400 }); }
    finally { await rm(temporary, { recursive: true, force: true }); }
  } });
  ctx.effect(() => async () => {
    shutdown.abort(); await Promise.all([disposeRpc(), disposeDownload(), disposeUpload(), disposeExport()]); await transfers.close(); await service.close();
  });
}
