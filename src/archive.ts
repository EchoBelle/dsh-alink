import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, mkdir, readFile, writeFile, lstat, stat, realpath, readdir, rename, rm } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { Ajv2020 } from 'ajv/dist/2020.js';
import yauzl from 'yauzl';
import yazl from 'yazl';
import { readJsonl, encode, snapshotFile, snapshotPrefix, MAX_ARCHIVE_BYTES } from './sources/jsonl.js';
import type { ArchiveManifest, CaptureResult, ObjectRef, PortableEvent, PortableResource, SourceApp } from './contracts.js';

export async function fileHash(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export async function readManifest(root: string): Promise<ArchiveManifest> {
  return JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
}
export async function readEvents(root: string): Promise<PortableEvent[]> {
  const events: PortableEvent[] = [];
  for await (const event of readJsonl(path.join(root, 'events.jsonl'), { lossless: true })) events.push(event);
  return events;
}
export async function archiveDigest(root: string): Promise<string> {
  const m = await readManifest(root);
  return createHash('sha256').update(encode({ source: m.source, session: m.session,
    records: m.integrity['records.jsonl'].sha256, events: m.integrity['events.jsonl'].sha256,
    objects: [...m.resources, ...m.original_files].map(r => r.sha256 ?? ('uri' in r ? r.uri : '')).sort() })).digest('hex');
}
export class ArchiveBuilder {
  private records!: FileHandle;
  private events!: FileHandle;
  private bytes = 0;
  readonly manifest: ArchiveManifest;
  private constructor(readonly root: string, app: SourceApp, format: string, session: ArchiveManifest['session'], readonly maxBytes: number) {
    this.manifest = { id: randomUUID(), format: 'alink.session', version: '0.1.0', captured_at: new Date().toISOString(),
      source: { app, native_format: format }, session, streams: { events: 'events.jsonl', records: 'records.jsonl' },
      resources: [], original_files: [], issues: [], coverage: { native_records: 0, events: 0, event_kinds: {} }, integrity: {} };
  }
  static async create(root: string, app: SourceApp, format: string, session: ArchiveManifest['session'], maxBytes = MAX_ARCHIVE_BYTES): Promise<ArchiveBuilder> {
    await mkdir(path.dirname(root), { recursive: true, mode: 0o700 });
    await mkdir(root, { mode: 0o700 });
    const b = new ArchiveBuilder(root, app, format, session, maxBytes);
    await mkdir(path.join(root, 'objects'), { mode: 0o700 });
    b.records = await open(path.join(root, 'records.jsonl'), 'wx', 0o600);
    b.events = await open(path.join(root, 'events.jsonl'), 'wx', 0o600);
    return b;
  }
  private async line(file: FileHandle, value: unknown) {
    const text = encode(value) + '\n';
    this.bytes += Buffer.byteLength(text);
    if (this.bytes > this.maxBytes) throw new Error('Archive exceeds size limit');
    await file.writeFile(text);
  }
  async record(value: unknown, locator: Record<string, unknown>): Promise<string> {
    const id = `r${this.manifest.coverage.native_records}`;
    await this.line(this.records, { id, locator, value });
    this.manifest.coverage.native_records++;
    return id;
  }
  async event(record_ref: string, kind: string, attrs: Partial<PortableEvent> = {}): Promise<void> {
    const seq = this.manifest.coverage.events;
    await this.line(this.events, { ...attrs, id: `e${seq}`, seq, kind, record_ref, content: attrs.content ?? [] });
    this.manifest.coverage.events++;
    this.manifest.coverage.event_kinds[kind] = (this.manifest.coverage.event_kinds[kind] ?? 0) + 1;
  }
  issue(code: string, detail: string): void {
    if (!this.manifest.issues.some(i => i.code === code && i.detail === detail)) this.manifest.issues.push({ code, detail });
  }
  async object(data: Uint8Array): Promise<ObjectRef> {
    const sha256 = createHash('sha256').update(data).digest('hex');
    const ref = { sha256, size: data.byteLength, path: 'objects/' + sha256 };
    try { await writeFile(path.join(this.root, ref.path), data, { flag: 'wx', mode: 0o600 }); this.bytes += data.byteLength; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    if (this.bytes > this.maxBytes) throw new Error('Archive exceeds size limit');
    return ref;
  }
  async objectFile(file: string, signal?: AbortSignal, prefixBytes?: number): Promise<ObjectRef> {
    const temporary = path.join(this.root, 'objects', randomUUID());
    if (prefixBytes === undefined) await snapshotFile(file, temporary, this.maxBytes - this.bytes, signal);
    else { if (prefixBytes > this.maxBytes - this.bytes) throw new Error('Archive exceeds size limit'); await snapshotPrefix(file, temporary, prefixBytes, signal); }
    const sha256 = await fileHash(temporary), size = (await stat(temporary)).size;
    const destination = path.join(this.root, 'objects', sha256);
    try { await lstat(destination); await rm(temporary); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await rename(temporary, destination); this.bytes += size;
    }
    return { sha256, size, path: 'objects/' + sha256 };
  }
  async originalFile(file: string, name = path.basename(file), signal?: AbortSignal, prefixBytes?: number): Promise<string> {
    const obj = await this.objectFile(file, signal, prefixBytes);
    this.manifest.original_files.push({ ...obj, name });
    return path.join(this.root, obj.path);
  }
  async resource(uri: string, record_ref: string, allowedRoots: readonly string[], media_type?: string): Promise<string> {
    const old = this.manifest.resources.find(r => r.uri === uri);
    if (old) return old.id;
    const item: PortableResource = { id: `a${this.manifest.resources.length}`, uri, record_ref, status: 'external', ...(media_type ? { media_type } : {}) };
    if (/^https?:/i.test(uri)) item.status = 'remote';
    else if (uri.startsWith('data:')) {
      const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(uri);
      if (!match || match[2].length % 4 !== 0) { this.issue('invalid_inline_resource', 'Invalid inline resource retained'); }
      else {
        const data = Buffer.from(match[2], 'base64');
        Object.assign(item, await this.object(data), { status: 'embedded', media_type: match[1] });
        item.uri = 'sha256:' + item.sha256;
      }
    } else if (!/^[a-z][a-z0-9+.-]*:/i.test(uri) || uri.startsWith('file:')) {
      const original = uri.startsWith('file:') ? fileURLToPath(uri) : path.resolve(this.manifest.session.cwd ?? this.root, uri);
      const roots = await Promise.all(allowedRoots.map(p => realpath(p)));
      const within = (file: string) => roots.some(root => file === root || file.startsWith(root + path.sep));
      try {
        const file = await realpath(original);
        if (within(file) && (await stat(file)).isFile()) Object.assign(item, await this.objectFile(file), { status: 'embedded' });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        if (within(path.resolve(original))) item.status = 'missing';
      }
    }
    this.manifest.resources.push(item);
    return item.id;
  }
  async close(): Promise<void> { await Promise.all([this.records.close(), this.events.close()]); }
  async finish(): Promise<CaptureResult> {
    await this.close();
    for (const name of ['events.jsonl', 'records.jsonl']) this.manifest.integrity[name] = {
      sha256: await fileHash(path.join(this.root, name)), size: (await stat(path.join(this.root, name))).size };
    await writeFile(path.join(this.root, 'manifest.json'), encode(this.manifest) + '\n', { flag: 'wx', mode: 0o600 });
    await validateArchive(this.root);
    return { archivePath: this.root, snapshotDigest: await archiveDigest(this.root) };
  }
}

let schemas: Promise<Record<string, ReturnType<Ajv2020['compile']>>> | undefined;
async function validators() {
  return schemas ??= (async () => {
    const ajv = new Ajv2020({ strict: false, validateFormats: false });
    const directory = new URL('../schemas/', import.meta.url);
    const result: Record<string, ReturnType<Ajv2020['compile']>> = {};
    for (const name of ['manifest', 'event', 'record']) result[name] = ajv.compile(JSON.parse(await readFile(new URL(name + '.json', directory), 'utf8')));
    return result;
  })();
}
export async function validateArchive(root: string): Promise<void> {
  const base = await realpath(root), checks = await validators();
  const regular = async (relative: string) => {
    const file = path.join(base, relative), info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || !(await realpath(file)).startsWith(base + path.sep)) throw new Error('Unsafe archive path');
    return file;
  };
  await regular('manifest.json');
  const m = await readManifest(base);
  if (!checks.manifest(m)) throw new Error('Invalid archive manifest: ' + JSON.stringify(checks.manifest.errors));
  for (const name of ['events.jsonl', 'records.jsonl']) {
    const file = await regular(name), expected = m.integrity[name];
    if (await fileHash(file) !== expected.sha256 || (await stat(file)).size !== expected.size) throw new Error('Integrity mismatch: ' + name);
  }
  const records = new Set<string>();
  for await (const row of readJsonl(path.join(base, 'records.jsonl'))) {
    if (!checks.record(row) || row.id !== `r${records.size}`) throw new Error('Invalid record identity');
    records.add(row.id);
  }
  const resources = new Set<string>();
  for (const resource of m.resources) {
    if (resources.has(resource.id) || !records.has(resource.record_ref)) throw new Error('Invalid resource identity');
    resources.add(resource.id);
  }
  let count = 0; const kinds: Record<string, number> = {};
  for await (const event of readJsonl(path.join(base, 'events.jsonl'))) {
    if (!checks.event(event) || event.seq !== count || event.id !== `e${count}` || !records.has(event.record_ref)) throw new Error('Invalid event identity');
    for (const block of event.content) if (block.resource_id && !resources.has(block.resource_id)) throw new Error('Dangling resource reference');
    kinds[event.kind] = (kinds[event.kind] ?? 0) + 1; count++;
  }
  for (const object of [...m.resources, ...m.original_files]) {
    if (object.sha256 === undefined && object.path === undefined) continue;
    if (typeof object.sha256 !== 'string' || typeof object.path !== 'string' || typeof object.size !== 'number') throw new Error('Incomplete resource object reference');
    if (object.path !== 'objects/' + object.sha256) throw new Error('Invalid object path');
    const file = await regular(object.path);
    if ((await stat(file)).size !== object.size || await fileHash(file) !== object.sha256) throw new Error('Object integrity mismatch');
  }
  if (m.coverage.native_records !== records.size || m.coverage.events !== count || encode(Object.entries(m.coverage.event_kinds).sort()) !== encode(Object.entries(kinds).sort())) throw new Error('Coverage mismatch');
}

export async function exportArchive(root: string, destination: string): Promise<void> {
  await validateArchive(root);
  const zip = new yazl.ZipFile();
  async function add(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Symlink in archive');
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await add(absolute);
      else if (entry.isFile()) zip.addFile(absolute, path.relative(root, absolute), { mode: 0o100600 });
    }
  }
  await add(root);
  const pending = pipeline(zip.outputStream, createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
  zip.end(); await pending;
}
async function unpackArchive(input: string, destination: string, signal: AbortSignal, limits = { maxBytes: MAX_ARCHIVE_BYTES, maxEntries: 100000 }): Promise<void> {
  signal.throwIfAborted();
  if ((await stat(input)).isDirectory()) {
    await validateArchive(input);
    // Validated directories are copied by their manifest, never by an arbitrary recursive tree.
    await mkdir(destination, { mode: 0o700 });
    const m = await readManifest(input);
    const names = new Set(['manifest.json', 'events.jsonl', 'records.jsonl', ...[...m.resources, ...m.original_files].flatMap(r => r.sha256 ? [r.path!] : [])]);
    let total = 0;
    for (const name of names) {
      if (!['manifest.json', 'events.jsonl', 'records.jsonl'].includes(name) && !/^objects\/[a-f0-9]{64}$/.test(name)) throw new Error('Unsafe archive path');
      const inputRoot = await realpath(input), outputRoot = path.resolve(destination);
      const file = path.join(inputRoot, name), output = path.resolve(outputRoot, name);
      if (!(await realpath(file)).startsWith(inputRoot + path.sep) || !output.startsWith(outputRoot + path.sep)) throw new Error('Archive path escapes root');
      total += (await stat(file)).size;
      if (total > limits.maxBytes || names.size > limits.maxEntries) throw new Error('Archive exceeds size limit');
      await mkdir(path.dirname(path.join(destination, name)), { recursive: true, mode: 0o700 });
      await snapshotFile(file, path.join(destination, name), limits.maxBytes, signal);
    }
  } else {
    if ((await stat(input)).size > limits.maxBytes) throw new Error('Archive exceeds size limit');
    await mkdir(destination, { mode: 0o700 });
    const zip = await new Promise<yauzl.ZipFile>((resolve, reject) => yauzl.open(input, { lazyEntries: true, validateEntrySizes: true }, (error, value) => error ? reject(error) : resolve(value!)));
    let total = 0, count = 0;
    try {
      await new Promise<void>((resolve, reject) => {
        zip.on('error', reject); zip.on('end', resolve);
        const abort = () => { zip.close(); reject(signal.reason ?? new Error('Canceled')); };
        signal.addEventListener('abort', abort, { once: true });
        zip.once('close', () => signal.removeEventListener('abort', abort));
        zip.on('entry', (entry: yauzl.Entry) => {
          void (async () => {
            signal.throwIfAborted();
            const name = entry.fileName;
            const mode = entry.externalFileAttributes >>> 16;
            if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..') || /^[A-Za-z]:/.test(name) || (mode & 0o170000) === 0o120000) throw new Error('Unsafe ZIP path');
            if (++count > limits.maxEntries || total + entry.uncompressedSize > limits.maxBytes) throw new Error('Archive exceeds size limit');
            const output = path.join(destination, name);
            if (name.endsWith('/')) await mkdir(output, { recursive: true, mode: 0o700 });
            else {
              await mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
              const stream = await new Promise<NodeJS.ReadableStream>((res, rej) => zip.openReadStream(entry, (error, value) => error ? rej(error) : res(value!)));
              await pipeline(stream, new Transform({ transform(chunk, _encoding, cb) {
                total += chunk.length; cb(total > limits.maxBytes ? new Error('Archive exceeds size limit') : null, chunk);
              } }), createWriteStream(output, { flags: 'wx', mode: 0o600 }), { signal });
            }
            zip.readEntry();
          })().catch(reject);
        });
        zip.readEntry();
      });
    } finally { zip.close(); }
  }
}

export async function importArchive(input: string, destination: string, signal: AbortSignal, limits = { maxBytes: MAX_ARCHIVE_BYTES, maxEntries: 100000 }): Promise<CaptureResult> {
  await unpackArchive(input, destination, signal, limits);
  let root = destination;
  try { await stat(path.join(root, 'manifest.json')); }
  catch { root = path.join(destination, 'original.alink'); }
  await validateArchive(root);
  return { archivePath: root, snapshotDigest: await archiveDigest(root) };
}

export async function importArchives(input: string, destination: string, signal: AbortSignal): Promise<CaptureResult[]> {
  await unpackArchive(input, destination, signal);
  const collection = path.join(destination, 'collection.json');
  if (!await stat(collection).catch(() => undefined)) {
    const root = await stat(path.join(destination, 'manifest.json')).catch(() => undefined) ? destination : path.join(destination, 'original.alink');
    await validateArchive(root); return [{ archivePath: root, snapshotDigest: await archiveDigest(root) }];
  }
  if ((await stat(collection)).size > 65536 || await stat(path.join(destination, 'manifest.json')).catch(() => undefined)) throw new Error('Invalid collection');
  const value = JSON.parse(await readFile(collection, 'utf8'));
  if (value.format !== 'alink.collection' || value.version !== '0.1.0' || !Array.isArray(value.sessions) || !value.sessions.length || value.sessions.length > 100 || new Set(value.sessions).size !== value.sessions.length) throw new Error('Invalid collection');
  const results: CaptureResult[] = [];
  for (const name of value.sessions) {
    signal.throwIfAborted();
    if (typeof name !== 'string' || !/^sessions\/[a-f0-9-]{36}$/.test(name)) throw new Error('Unsafe collection path');
    const root = path.join(destination, name); await validateArchive(root);
    results.push({ archivePath: root, snapshotDigest: await archiveDigest(root) });
  }
  return results;
}

export async function exportArchives(roots: string[], destination: string): Promise<void> {
  if (roots.length === 1) return exportArchive(roots[0], destination);
  if (!roots.length || roots.length > 100) throw new Error('Invalid collection size');
  const zip = new yazl.ZipFile(), sessions: string[] = [];
  let bytes = 0, entries = 1;
  for (const root of roots) {
    await validateArchive(root);
    const prefix = 'sessions/' + randomUUID(); sessions.push(prefix);
    const manifest = await readManifest(root);
    const files = new Set(['manifest.json', 'events.jsonl', 'records.jsonl', ...[...manifest.resources, ...manifest.original_files].flatMap(r => r.path ? [r.path] : [])]);
    for (const name of files) {
      bytes += (await stat(path.join(root, name))).size;
      if (bytes > MAX_ARCHIVE_BYTES - 65536 || ++entries > 100000) throw new Error('Archive exceeds size limit');
      zip.addFile(path.join(root, name), prefix + '/' + name, { mode: 0o100600 });
    }
  }
  zip.addBuffer(Buffer.from(JSON.stringify({ format: 'alink.collection', version: '0.1.0', sessions })), 'collection.json');
  const pending = pipeline(zip.outputStream, createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
  zip.end(); await pending;
}
