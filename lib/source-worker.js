// src/sources/worker.ts
import { parentPort } from "node:worker_threads";

// src/archive.ts
import { createHash as createHash2, randomUUID } from "node:crypto";
import { createReadStream as createReadStream2, createWriteStream as createWriteStream2 } from "node:fs";
import { open, mkdir, readFile, writeFile, lstat, stat as stat2, realpath, readdir, rename, rm as rm2 } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline as pipeline2 } from "node:stream/promises";
import { Transform as Transform2 } from "node:stream";
import { Ajv2020 } from "ajv/dist/2020.js";
import yauzl from "yauzl";
import yazl from "yazl";

// src/sources/jsonl.ts
import { createReadStream, createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { stat, rm, chmod } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { parse, stringify } from "lossless-json";
var parseNativeNumber = (text2) => {
  const value = Number(text2);
  return /^-?\d+$/.test(text2) && !Number.isSafeInteger(value) ? BigInt(text2) : value;
};
var MAX_LINE_BYTES = 16 * 1024 * 1024;
var MAX_ARCHIVE_BYTES = 2 * 1024 ** 3;
function encode(value) {
  return stringify(value);
}
async function* readJsonl(file, options = {}) {
  yield* readJsonStream(createReadStream(file, { signal: options.signal }), options);
}
async function* readJsonStream(input, options = {}) {
  const limit = options.maxLineBytes ?? MAX_LINE_BYTES;
  let pending = Buffer.alloc(0);
  for await (const chunk of input) {
    options.signal?.throwIfAborted();
    pending = Buffer.concat([pending, chunk]);
    let end;
    while ((end = pending.indexOf(10)) !== -1) {
      if (end > limit) throw new Error("JSONL line exceeds size limit");
      const text2 = pending.subarray(0, end).toString("utf8").trim();
      pending = pending.subarray(end + 1);
      if (text2) yield options.lossless ? parse(text2, null, parseNativeNumber) : JSON.parse(text2);
    }
    if (pending.length > limit) throw new Error("JSONL line exceeds size limit");
  }
  if (pending.toString("utf8").trim()) yield options.lossless ? parse(pending.toString("utf8"), null, parseNativeNumber) : JSON.parse(pending.toString("utf8"));
}
async function snapshotFile(source, destination, maxBytes = MAX_ARCHIVE_BYTES, signal) {
  const before = await stat(source, { bigint: true });
  if (!before.isFile() || before.size > BigInt(maxBytes)) throw new Error("Source exceeds size limit");
  let total = 0, created = false;
  const out = createWriteStream(destination, { flags: "wx", mode: 384 });
  out.once("open", () => {
    created = true;
  });
  try {
    await pipeline(createReadStream(source), new Transform({ transform(chunk, _encoding, callback) {
      total += chunk.length;
      callback(total > maxBytes ? new Error("Source exceeds size limit") : null, chunk);
    } }), out, { signal });
    const after = await stat(source, { bigint: true });
    if (before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ino !== after.ino || BigInt(total) !== after.size) throw new Error("SOURCE_CHANGED");
    await chmod(destination, 384);
  } catch (error) {
    if (created) await rm(destination, { force: true });
    throw error;
  }
}
async function snapshotPrefix(source, destination, bytes, signal) {
  const before = await stat(source);
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_ARCHIVE_BYTES || !before.isFile() || before.size < bytes) throw new Error("Invalid history prefix");
  const hash = createHash("sha256");
  let total = 0, last = 0;
  try {
    await pipeline(createReadStream(source, { end: bytes - 1 }), new Transform({ transform(chunk, _encoding, done) {
      total += chunk.length;
      last = chunk.at(-1);
      hash.update(chunk);
      done(null, chunk);
    } }), createWriteStream(destination, { flags: "wx", mode: 384 }), { signal });
    if (total !== bytes || last !== 10) throw new Error("Invalid history prefix boundary");
    const verify = createHash("sha256");
    for await (const chunk of createReadStream(source, { end: bytes - 1, signal })) verify.update(chunk);
    if (hash.digest("hex") !== verify.digest("hex") || before.ino !== (await stat(source)).ino) throw new Error("SOURCE_CHANGED");
  } catch (error) {
    await rm(destination, { force: true });
    throw error;
  }
}

// src/archive.ts
async function fileHash(file) {
  const hash = createHash2("sha256");
  for await (const chunk of createReadStream2(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function readManifest(root) {
  return JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
}
async function archiveDigest(root) {
  const m = await readManifest(root);
  return createHash2("sha256").update(encode({
    source: m.source,
    session: m.session,
    records: m.integrity["records.jsonl"].sha256,
    events: m.integrity["events.jsonl"].sha256,
    objects: [...m.resources, ...m.original_files].map((r) => r.sha256 ?? ("uri" in r ? r.uri : "")).sort()
  })).digest("hex");
}
var ArchiveBuilder = class _ArchiveBuilder {
  constructor(root, app, format, session, maxBytes) {
    this.root = root;
    this.maxBytes = maxBytes;
    this.manifest = {
      id: randomUUID(),
      format: "alink.session",
      version: "0.1.0",
      captured_at: (/* @__PURE__ */ new Date()).toISOString(),
      source: { app, native_format: format },
      session,
      streams: { events: "events.jsonl", records: "records.jsonl" },
      resources: [],
      original_files: [],
      issues: [],
      coverage: { native_records: 0, events: 0, event_kinds: {} },
      integrity: {}
    };
  }
  records;
  events;
  bytes = 0;
  manifest;
  static async create(root, app, format, session, maxBytes = MAX_ARCHIVE_BYTES) {
    await mkdir(path.dirname(root), { recursive: true, mode: 448 });
    await mkdir(root, { mode: 448 });
    const b = new _ArchiveBuilder(root, app, format, session, maxBytes);
    await mkdir(path.join(root, "objects"), { mode: 448 });
    b.records = await open(path.join(root, "records.jsonl"), "wx", 384);
    b.events = await open(path.join(root, "events.jsonl"), "wx", 384);
    return b;
  }
  async line(file, value) {
    const text2 = encode(value) + "\n";
    this.bytes += Buffer.byteLength(text2);
    if (this.bytes > this.maxBytes) throw new Error("Archive exceeds size limit");
    await file.writeFile(text2);
  }
  async record(value, locator) {
    const id2 = `r${this.manifest.coverage.native_records}`;
    await this.line(this.records, { id: id2, locator, value });
    this.manifest.coverage.native_records++;
    return id2;
  }
  async event(record_ref, kind, attrs = {}) {
    const seq = this.manifest.coverage.events;
    await this.line(this.events, { ...attrs, id: `e${seq}`, seq, kind, record_ref, content: attrs.content ?? [] });
    this.manifest.coverage.events++;
    this.manifest.coverage.event_kinds[kind] = (this.manifest.coverage.event_kinds[kind] ?? 0) + 1;
  }
  issue(code, detail) {
    if (!this.manifest.issues.some((i) => i.code === code && i.detail === detail)) this.manifest.issues.push({ code, detail });
  }
  async object(data) {
    const sha256 = createHash2("sha256").update(data).digest("hex");
    const ref = { sha256, size: data.byteLength, path: "objects/" + sha256 };
    try {
      await writeFile(path.join(this.root, ref.path), data, { flag: "wx", mode: 384 });
      this.bytes += data.byteLength;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    if (this.bytes > this.maxBytes) throw new Error("Archive exceeds size limit");
    return ref;
  }
  async objectFile(file, signal, prefixBytes) {
    const temporary = path.join(this.root, "objects", randomUUID());
    if (prefixBytes === void 0) await snapshotFile(file, temporary, this.maxBytes - this.bytes, signal);
    else {
      if (prefixBytes > this.maxBytes - this.bytes) throw new Error("Archive exceeds size limit");
      await snapshotPrefix(file, temporary, prefixBytes, signal);
    }
    const sha256 = await fileHash(temporary), size = (await stat2(temporary)).size;
    const destination = path.join(this.root, "objects", sha256);
    try {
      await lstat(destination);
      await rm2(temporary);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await rename(temporary, destination);
      this.bytes += size;
    }
    return { sha256, size, path: "objects/" + sha256 };
  }
  async originalFile(file, name = path.basename(file), signal, prefixBytes) {
    const obj = await this.objectFile(file, signal, prefixBytes);
    this.manifest.original_files.push({ ...obj, name });
    return path.join(this.root, obj.path);
  }
  async resource(uri, record_ref, allowedRoots, media_type) {
    const old = this.manifest.resources.find((r) => r.uri === uri);
    if (old) return old.id;
    const item = { id: `a${this.manifest.resources.length}`, uri, record_ref, status: "external", ...media_type ? { media_type } : {} };
    if (/^https?:/i.test(uri)) item.status = "remote";
    else if (uri.startsWith("data:")) {
      const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(uri);
      if (!match || match[2].length % 4 !== 0) {
        this.issue("invalid_inline_resource", "Invalid inline resource retained");
      } else {
        const data = Buffer.from(match[2], "base64");
        Object.assign(item, await this.object(data), { status: "embedded", media_type: match[1] });
        item.uri = "sha256:" + item.sha256;
      }
    } else if (!/^[a-z][a-z0-9+.-]*:/i.test(uri) || uri.startsWith("file:")) {
      const original = uri.startsWith("file:") ? fileURLToPath(uri) : path.resolve(this.manifest.session.cwd ?? this.root, uri);
      const roots = await Promise.all(allowedRoots.map((p) => realpath(p)));
      const within = (file) => roots.some((root) => file === root || file.startsWith(root + path.sep));
      try {
        const file = await realpath(original);
        if (within(file) && (await stat2(file)).isFile()) Object.assign(item, await this.objectFile(file), { status: "embedded" });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        if (within(path.resolve(original))) item.status = "missing";
      }
    }
    this.manifest.resources.push(item);
    return item.id;
  }
  async close() {
    await Promise.all([this.records.close(), this.events.close()]);
  }
  async finish() {
    await this.close();
    for (const name of ["events.jsonl", "records.jsonl"]) this.manifest.integrity[name] = {
      sha256: await fileHash(path.join(this.root, name)),
      size: (await stat2(path.join(this.root, name))).size
    };
    await writeFile(path.join(this.root, "manifest.json"), encode(this.manifest) + "\n", { flag: "wx", mode: 384 });
    await validateArchive(this.root);
    return { archivePath: this.root, snapshotDigest: await archiveDigest(this.root) };
  }
};
var schemas;
async function validators() {
  return schemas ??= (async () => {
    const ajv2 = new Ajv2020({ strict: false, validateFormats: false });
    const directory = new URL("../schemas/", import.meta.url);
    const result = {};
    for (const name of ["manifest", "event", "record"]) result[name] = ajv2.compile(JSON.parse(await readFile(new URL(name + ".json", directory), "utf8")));
    return result;
  })();
}
async function validateArchive(root) {
  const base = await realpath(root), checks = await validators();
  const regular = async (relative) => {
    const file = path.join(base, relative), info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || !(await realpath(file)).startsWith(base + path.sep)) throw new Error("Unsafe archive path");
    return file;
  };
  await regular("manifest.json");
  const m = await readManifest(base);
  if (!checks.manifest(m)) throw new Error("Invalid archive manifest: " + JSON.stringify(checks.manifest.errors));
  for (const name of ["events.jsonl", "records.jsonl"]) {
    const file = await regular(name), expected = m.integrity[name];
    if (await fileHash(file) !== expected.sha256 || (await stat2(file)).size !== expected.size) throw new Error("Integrity mismatch: " + name);
  }
  const records = /* @__PURE__ */ new Set();
  for await (const row of readJsonl(path.join(base, "records.jsonl"))) {
    if (!checks.record(row) || row.id !== `r${records.size}`) throw new Error("Invalid record identity");
    records.add(row.id);
  }
  const resources = /* @__PURE__ */ new Set();
  for (const resource of m.resources) {
    if (resources.has(resource.id) || !records.has(resource.record_ref)) throw new Error("Invalid resource identity");
    resources.add(resource.id);
  }
  let count = 0;
  const kinds = {};
  for await (const event of readJsonl(path.join(base, "events.jsonl"))) {
    if (!checks.event(event) || event.seq !== count || event.id !== `e${count}` || !records.has(event.record_ref)) throw new Error("Invalid event identity");
    for (const block of event.content) if (block.resource_id && !resources.has(block.resource_id)) throw new Error("Dangling resource reference");
    kinds[event.kind] = (kinds[event.kind] ?? 0) + 1;
    count++;
  }
  for (const object2 of [...m.resources, ...m.original_files]) {
    if (object2.sha256 === void 0 && object2.path === void 0) continue;
    if (typeof object2.sha256 !== "string" || typeof object2.path !== "string" || typeof object2.size !== "number") throw new Error("Incomplete resource object reference");
    if (object2.path !== "objects/" + object2.sha256) throw new Error("Invalid object path");
    const file = await regular(object2.path);
    if ((await stat2(file)).size !== object2.size || await fileHash(file) !== object2.sha256) throw new Error("Object integrity mismatch");
  }
  if (m.coverage.native_records !== records.size || m.coverage.events !== count || encode(Object.entries(m.coverage.event_kinds).sort()) !== encode(Object.entries(kinds).sort())) throw new Error("Coverage mismatch");
}
async function exportArchive(root, destination) {
  await validateArchive(root);
  const zip = new yazl.ZipFile();
  async function add(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error("Symlink in archive");
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await add(absolute);
      else if (entry.isFile()) zip.addFile(absolute, path.relative(root, absolute), { mode: 33152 });
    }
  }
  await add(root);
  const pending = pipeline2(zip.outputStream, createWriteStream2(destination, { flags: "wx", mode: 384 }));
  zip.end();
  await pending;
}
async function unpackArchive(input, destination, signal, limits = { maxBytes: MAX_ARCHIVE_BYTES, maxEntries: 1e5 }) {
  signal.throwIfAborted();
  if ((await stat2(input)).isDirectory()) {
    await validateArchive(input);
    await mkdir(destination, { mode: 448 });
    const m = await readManifest(input);
    const names = /* @__PURE__ */ new Set(["manifest.json", "events.jsonl", "records.jsonl", ...[...m.resources, ...m.original_files].flatMap((r) => r.sha256 ? [r.path] : [])]);
    let total = 0;
    for (const name of names) {
      if (!["manifest.json", "events.jsonl", "records.jsonl"].includes(name) && !/^objects\/[a-f0-9]{64}$/.test(name)) throw new Error("Unsafe archive path");
      const inputRoot = await realpath(input), outputRoot = path.resolve(destination);
      const file = path.join(inputRoot, name), output = path.resolve(outputRoot, name);
      if (!(await realpath(file)).startsWith(inputRoot + path.sep) || !output.startsWith(outputRoot + path.sep)) throw new Error("Archive path escapes root");
      total += (await stat2(file)).size;
      if (total > limits.maxBytes || names.size > limits.maxEntries) throw new Error("Archive exceeds size limit");
      await mkdir(path.dirname(path.join(destination, name)), { recursive: true, mode: 448 });
      await snapshotFile(file, path.join(destination, name), limits.maxBytes, signal);
    }
  } else {
    if ((await stat2(input)).size > limits.maxBytes) throw new Error("Archive exceeds size limit");
    await mkdir(destination, { mode: 448 });
    const zip = await new Promise((resolve, reject) => yauzl.open(input, { lazyEntries: true, validateEntrySizes: true }, (error, value) => error ? reject(error) : resolve(value)));
    let total = 0, count = 0;
    try {
      await new Promise((resolve, reject) => {
        zip.on("error", reject);
        zip.on("end", resolve);
        const abort = () => {
          zip.close();
          reject(signal.reason ?? new Error("Canceled"));
        };
        signal.addEventListener("abort", abort, { once: true });
        zip.once("close", () => signal.removeEventListener("abort", abort));
        zip.on("entry", (entry) => {
          void (async () => {
            signal.throwIfAborted();
            const name = entry.fileName;
            const mode = entry.externalFileAttributes >>> 16;
            if (name.startsWith("/") || name.includes("\\") || name.split("/").includes("..") || /^[A-Za-z]:/.test(name) || (mode & 61440) === 40960) throw new Error("Unsafe ZIP path");
            if (++count > limits.maxEntries || total + entry.uncompressedSize > limits.maxBytes) throw new Error("Archive exceeds size limit");
            const output = path.join(destination, name);
            if (name.endsWith("/")) await mkdir(output, { recursive: true, mode: 448 });
            else {
              await mkdir(path.dirname(output), { recursive: true, mode: 448 });
              const stream = await new Promise((res, rej) => zip.openReadStream(entry, (error, value) => error ? rej(error) : res(value)));
              await pipeline2(stream, new Transform2({ transform(chunk, _encoding, cb) {
                total += chunk.length;
                cb(total > limits.maxBytes ? new Error("Archive exceeds size limit") : null, chunk);
              } }), createWriteStream2(output, { flags: "wx", mode: 384 }), { signal });
            }
            zip.readEntry();
          })().catch(reject);
        });
        zip.readEntry();
      });
    } finally {
      zip.close();
    }
  }
}
async function importArchive(input, destination, signal, limits = { maxBytes: MAX_ARCHIVE_BYTES, maxEntries: 1e5 }) {
  await unpackArchive(input, destination, signal, limits);
  let root = destination;
  try {
    await stat2(path.join(root, "manifest.json"));
  } catch {
    root = path.join(destination, "original.alink");
  }
  await validateArchive(root);
  return { archivePath: root, snapshotDigest: await archiveDigest(root) };
}
async function importArchives(input, destination, signal) {
  await unpackArchive(input, destination, signal);
  const collection = path.join(destination, "collection.json");
  if (!await stat2(collection).catch(() => void 0)) {
    const root = await stat2(path.join(destination, "manifest.json")).catch(() => void 0) ? destination : path.join(destination, "original.alink");
    await validateArchive(root);
    return [{ archivePath: root, snapshotDigest: await archiveDigest(root) }];
  }
  if ((await stat2(collection)).size > 65536 || await stat2(path.join(destination, "manifest.json")).catch(() => void 0)) throw new Error("Invalid collection");
  const value = JSON.parse(await readFile(collection, "utf8"));
  if (value.format !== "alink.collection" || value.version !== "0.1.0" || !Array.isArray(value.sessions) || !value.sessions.length || value.sessions.length > 100 || new Set(value.sessions).size !== value.sessions.length) throw new Error("Invalid collection");
  const results = [];
  for (const name of value.sessions) {
    signal.throwIfAborted();
    if (typeof name !== "string" || !/^sessions\/[a-f0-9-]{36}$/.test(name)) throw new Error("Unsafe collection path");
    const root = path.join(destination, name);
    await validateArchive(root);
    results.push({ archivePath: root, snapshotDigest: await archiveDigest(root) });
  }
  return results;
}
async function exportArchives(roots, destination) {
  if (roots.length === 1) return exportArchive(roots[0], destination);
  if (!roots.length || roots.length > 100) throw new Error("Invalid collection size");
  const zip = new yazl.ZipFile(), sessions = [];
  let bytes = 0, entries = 1;
  for (const root of roots) {
    await validateArchive(root);
    const prefix = "sessions/" + randomUUID();
    sessions.push(prefix);
    const manifest = await readManifest(root);
    const files = /* @__PURE__ */ new Set(["manifest.json", "events.jsonl", "records.jsonl", ...[...manifest.resources, ...manifest.original_files].flatMap((r) => r.path ? [r.path] : [])]);
    for (const name of files) {
      bytes += (await stat2(path.join(root, name))).size;
      if (bytes > MAX_ARCHIVE_BYTES - 65536 || ++entries > 1e5) throw new Error("Archive exceeds size limit");
      zip.addFile(path.join(root, name), prefix + "/" + name, { mode: 33152 });
    }
  }
  zip.addBuffer(Buffer.from(JSON.stringify({ format: "alink.collection", version: "0.1.0", sessions })), "collection.json");
  const pending = pipeline2(zip.outputStream, createWriteStream2(destination, { flags: "wx", mode: 384 }));
  zip.end();
  await pending;
}

// src/sources/dsh-legacy.ts
import { createReadStream as createReadStream3 } from "node:fs";
import { readFile as readFile2, readdir as readdir2, stat as stat3 } from "node:fs/promises";
import path3 from "node:path";
import { createZstdDecompress } from "node:zlib";

// src/sources/types.ts
import { createHash as createHash3 } from "node:crypto";
import path2 from "node:path";
function sourceKey(app, root, id2) {
  return app + ":" + createHash3("sha256").update(path2.resolve(root) + "\0" + id2).digest("hex").slice(0, 32);
}
function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Unsupported source record");
  return value;
}
function flag(value) {
  return value !== void 0 && value !== null && value !== false && value !== 0 && value !== 0n && value !== "" && value !== "0" && value !== "false";
}
function binaryState(value) {
  if (value === 0 || value === 0n || value === false) return 0;
  if (value === 1 || value === 1n || value === true) return 1;
  return void 0;
}
var workBuddyActiveStatuses = /* @__PURE__ */ new Set(["completed", "running", "idle", "pending", "waiting", "paused", "failed", "error", "stopped", "working", "active", "in_progress"]);
function eligibility(row, proven) {
  if (flag(row.deleted_at) || flag(row.isDeleted) || ["deleted", "removed"].includes(String(row.status).toLowerCase())) return "deleted";
  if (["archived", "archive"].includes(String(row.status).toLowerCase()) || ["archived", "is_archived", "isArchived"].some((k) => binaryState(row[k]) === 1) || flag(row.archived_at)) return "archived";
  if (binaryState(row.available) === 0) return "archived";
  return proven ? "active" : "unknown";
}
function number(value) {
  const n = Number(value);
  return value !== null && value !== void 0 && Number.isSafeInteger(n) && n >= 0 ? n : void 0;
}

// src/sources/resources.ts
async function normalizeBlocks(value, builder, ref, roots) {
  if (typeof value === "string") return [{ type: "text", text: value }];
  if (value === void 0 || value === null) return [];
  const result = [];
  for (const item of Array.isArray(value) ? value : [value]) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      result.push({ type: "opaque", value: item });
      continue;
    }
    const block = asRecord(item), kind = String(block.type ?? "unknown");
    if (["text", "input_text", "output_text"].includes(kind) && typeof block.text === "string") result.push({ type: "text", text: block.text });
    else if (["image", "input_image", "image_url", "file", "audio", "input_audio", "video"].includes(kind)) {
      let uri = block.image_url ?? block.url ?? block.path ?? block.file_url;
      if (uri && typeof uri === "object") uri = uri.url;
      if (!uri && block.source?.type === "base64") uri = `data:${block.source.media_type ?? "application/octet-stream"};base64,${block.source.data ?? ""}`;
      if (typeof uri === "string" && uri) result.push({ type: "resource", resource_id: await builder.resource(uri, ref, roots), native_type: kind });
      else result.push({ type: "opaque", native_type: kind, value: item });
    } else result.push({ type: "opaque", native_type: kind, value: item });
  }
  return result;
}
async function normalizeResponse(row, builder, ref, roots, codex = false, timestamp) {
  const kind = String(row.type ?? "unknown");
  const attrs = {
    native_type: kind,
    ...["analysis", "summary"].includes(row.channel) || row.recipient && row.recipient !== "all" ? { projection: "auxiliary" } : {},
    ...row.id === void 0 ? {} : { native_id: String(row.id) },
    ...row.parentId === void 0 ? {} : { parent_native_id: String(row.parentId) },
    ...timestamp === void 0 && row.timestamp === void 0 ? {} : { timestamp: timestamp ?? row.timestamp }
  };
  if (kind === "message") await builder.event(ref, "message", { ...attrs, role: String(row.role ?? "unknown"), content: await normalizeBlocks(row.content, builder, ref, roots) });
  else if (kind === "reasoning") await builder.event(ref, "reasoning", { ...attrs, role: "assistant", content: await normalizeBlocks(codex ? row.summary : row.content ?? row.rawContent, builder, ref, roots) });
  else if (["function_call", "custom_tool_call"].includes(kind)) await builder.event(ref, "tool_call", { ...attrs, role: "assistant", content: [{ type: "tool_call", call_id: String(row.call_id ?? row.callId ?? ""), name: String(row.name ?? ""), arguments: row.arguments ?? row.input ?? "", argument_encoding: kind === "custom_tool_call" ? "text" : "json_string" }] });
  else if (["function_call_result", "function_call_output", "custom_tool_call_output"].includes(kind)) await builder.event(ref, "tool_result", { ...attrs, role: "tool", content: [{ type: "tool_result", call_id: String(row.call_id ?? row.callId ?? ""), name: String(row.name ?? ""), output: row.output ?? null, ...row.status === void 0 ? {} : { status: row.status } }] });
  else await builder.event(ref, kind === "ai-title" ? "metadata" : kind === "file-history-snapshot" ? "checkpoint" : "opaque", { ...attrs, projection: "auxiliary" });
}

// src/sources/dsh-legacy.ts
async function* legacyRows(file, signal) {
  if (!file.endsWith(".zstd")) {
    yield* readJsonl(file, { signal, lossless: true });
    return;
  }
  const input = createReadStream3(file, { signal }), decoder = createZstdDecompress();
  input.on("error", (error) => decoder.destroy(error));
  input.pipe(decoder);
  try {
    yield* readJsonStream(decoder, { signal, lossless: true });
  } finally {
    input.destroy();
    decoder.destroy();
  }
}
async function discoverLegacy(root) {
  let archived;
  try {
    const state = JSON.parse(await readFile2(path3.join(root, "storages/workspace.json"), "utf8"));
    if (state.unit?.name === "workspace" && state.unit.version === 2 && Array.isArray(state.global?.archivedSessionIds) && state.global.archivedSessionIds.every((id2) => typeof id2 === "string")) archived = new Set(state.global.archivedSessionIds);
  } catch {
  }
  const result = [];
  for (const project2 of await readdir2(path3.join(root, "sessions"), { withFileTypes: true }).catch(() => [])) {
    if (!project2.isDirectory()) continue;
    for (const session of await readdir2(path3.join(root, "sessions", project2.name), { withFileTypes: true })) {
      if (!session.isDirectory()) continue;
      for (const name of ["session.jsonl", "session.jsonl.zstd"]) {
        const file = path3.join(root, "sessions", project2.name, session.name, name);
        if (!await stat3(file).catch(() => void 0)) continue;
        for await (const h of legacyRows(file)) {
          if (h.type === "session" && h.version === 0 && typeof h.id === "string") result.push({
            sourceId: sourceKey("dsh", root, h.id),
            app: "dsh",
            nativeId: h.id,
            file,
            root,
            title: h.id,
            cwd: typeof h.cwd === "string" ? h.cwd : void 0,
            eligibility: archived ? archived.has(h.id) ? "archived" : "active" : "unknown"
          });
          break;
        }
        break;
      }
    }
  }
  return result;
}
async function captureLegacy(source, destination, signal) {
  const b = await ArchiveBuilder.create(destination, "dsh", "session-v0-jsonl", { native_id: source.nativeId, title: source.title, ...source.cwd ? { cwd: source.cwd } : {} });
  b.manifest.source.location = source.file;
  try {
    const snapshot = await b.originalFile(source.file, void 0, signal);
    const read = source.file.endsWith(".zstd") ? async function* () {
      const input = createReadStream3(snapshot), decoder = createZstdDecompress();
      input.on("error", (e) => decoder.destroy(e));
      input.pipe(decoder);
      try {
        yield* readJsonStream(decoder, { signal, lossless: true });
      } finally {
        input.destroy();
        decoder.destroy();
      }
    } : () => readJsonl(snapshot, { signal, lossless: true });
    let index = 0;
    for await (const row of read()) {
      const ref = await b.record(row, { file: path3.basename(source.file), record_index: index });
      if (index++ === 0) {
        if (row.type !== "session" || row.version !== 0) throw new Error("Unsupported DSH source version");
        await b.event(ref, "metadata", { projection: "auxiliary" });
        continue;
      }
      const data = asRecord(row.data ?? {}), roots = [source.root, ...source.resourceRoots ?? []];
      const attrs = { native_type: String(row.type), ...typeof row.time === "number" ? { timestamp: row.time } : {} };
      if (row.surfaceOp && typeof row.surfaceOp === "object" || String(row.type).startsWith("compaction/")) b.issue("unresolved_history", "Legacy DSH surface replacement requires reconstruction");
      if (row.type === "session/title") b.manifest.session.title = String(data.title ?? source.title);
      if (row.type === "user/message" || row.type === "assistant/message") await b.event(ref, "message", { ...attrs, role: row.type === "user/message" ? "user" : "assistant", content: await normalizeBlocks(row.type === "user/message" ? data.content : data.message?.content, b, ref, roots) });
      else if (row.type === "tool/call") await b.event(ref, "tool_call", { ...attrs, role: "assistant", content: [{ type: "tool_call", call_id: String(data.callId ?? ""), name: String(data.name ?? ""), arguments: data.arguments ?? "" }] });
      else if (row.type === "tool/result") await b.event(ref, "tool_result", { ...attrs, role: "tool", content: [{ type: "tool_result", call_id: String(data.message?.source?.callId ?? ""), output: data.message?.content ?? null }] });
      else await b.event(ref, "lifecycle", { ...attrs, projection: "auxiliary" });
    }
    return await b.finish();
  } catch (error) {
    await b.close();
    throw error;
  }
}

// src/sources/registry.ts
import path9 from "node:path";
import os2 from "node:os";
import { stat as stat9 } from "node:fs/promises";

// src/transport.ts
import { Ajv } from "ajv";
var LinkError = class extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
};
var text = (maxLength = 4096) => ({ type: "string", minLength: 1, maxLength });
var id = { ...text(36), pattern: "^[a-f0-9-]{36}$" };
var object = (properties, required = Object.keys(properties)) => ({ type: "object", properties, required, additionalProperties: false });
var target = object({ cwd: text(), agentPreset: text(128) });
var sourceId = { ...text(128), pattern: "^(?:(?:workbuddy|codex|raccoon|cursor|dsh):[a-f0-9]{32}|upload:[a-f0-9-]{36})$" };
var titles = { type: "object", maxProperties: 100, propertyNames: sourceId, additionalProperties: text(300) };
var sourceIds = { type: "array", minItems: 1, maxItems: 100, uniqueItems: true, items: sourceId };
var queryFields = { text: { type: "string", maxLength: 300 }, cursor: text(4096), limit: { type: "integer", minimum: 1, maximum: 100 } };
var requestSchemas = {
  sources: object({}),
  targets: object({}),
  operations: object({}),
  transfers: object({}),
  importMany: object({ requestId: id, sourceIds, titles, target: object({ cwd: text(), agentPreset: text(128) }, ["agentPreset"]) }, ["requestId", "sourceIds", "target"]),
  exportMany: object({ requestId: id, sourceIds, titles }, ["requestId", "sourceIds"]),
  transfer: object({ id }),
  cancelTransfer: object({ id }),
  retryTransfer: object({ id }),
  retryOperation: object({ operationId: id }),
  removeOperation: object({ operationId: id }),
  registerFiles: object({ path: text(), format: { enum: ["alink", "dsh"] } }),
  sessions: object({ app: { enum: ["workbuddy", "codex", "raccoon", "cursor"] }, ...queryFields }, ["app"]),
  inspect: object({ sourceId }),
  inspectionPage: object({ inspectionId: id, offset: { type: "integer", minimum: 0 } }, ["inspectionId"]),
  preview: object({ sourceId: text(128), target }),
  previewPage: object({ previewId: id, offset: { type: "integer", minimum: 0 } }, ["previewId"]),
  commit: object({ previewId: id, reportHash: { ...text(64), pattern: "^[a-f0-9]{64}$" }, requestId: text(128) }),
  operation: object({ operationId: id }),
  cancel: object({ operationId: id }),
  registerFile: object({ path: text(), format: { enum: ["alink", "dsh"] } })
};
var ajv = new Ajv();
var validators2 = Object.fromEntries(Object.entries(requestSchemas).map(([key, schema]) => [key, ajv.compile(schema)]));

// src/sources/workbuddy.ts
import path5 from "node:path";
import { readdir as readdir3, stat as stat5, realpath as realpath2 } from "node:fs/promises";

// src/sources/sqlite.ts
import { DatabaseSync } from "node:sqlite";
import { open as openFile, mkdtemp, stat as stat4, rm as rm3 } from "node:fs/promises";
import os from "node:os";
import path4 from "node:path";
async function withReadonlyDatabase(file, operation, signal) {
  signal?.throwIfAborted();
  let db, temporary;
  const open2 = (p) => {
    const connection = new DatabaseSync(p, { readOnly: true });
    try {
      connection.exec("PRAGMA query_only=ON; BEGIN");
      return connection;
    } catch (error) {
      connection.close();
      throw error;
    }
  };
  try {
    try {
      db = open2(file);
      db.prepare("SELECT name FROM sqlite_master LIMIT 1").get();
    } catch (error) {
      db?.close();
      db = void 0;
      const source = await openFile(file, "r");
      const bytes = Buffer.alloc(16);
      try {
        await source.read(bytes, 0, 16, 0);
      } finally {
        await source.close();
      }
      const header = bytes.toString("binary");
      if (header !== "SQLite format 3\0") throw new Error("Encrypted or non-SQLite source");
      if ((await stat4(file)).size > 64 * 1024 ** 2) throw error;
      temporary = await mkdtemp(path4.join(os.tmpdir(), "dsh-alink-db-"));
      const copy = path4.join(temporary, "snapshot.sqlite");
      const revision = async () => Promise.all([file, file + "-wal"].map(async (p) => {
        try {
          const s = await stat4(p, { bigint: true });
          return `${s.size}:${s.mtimeNs}`;
        } catch (e) {
          if (e.code === "ENOENT") return "";
          throw e;
        }
      }));
      let stable = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const before = await revision();
        for (const suffix of ["", "-wal"]) {
          await rm3(copy + suffix, { force: true });
          if (before[suffix ? 1 : 0]) await snapshotFile(file + suffix, copy + suffix, 64 * 1024 ** 2, signal);
        }
        if (JSON.stringify(before) === JSON.stringify(await revision())) {
          stable = true;
          break;
        }
      }
      if (!stable) throw new Error("SOURCE_CHANGED");
      db = new DatabaseSync(copy);
      db.exec("PRAGMA query_only=ON; BEGIN");
    }
    signal?.throwIfAborted();
    return await operation(db);
  } finally {
    db?.close();
    if (temporary) await rm3(temporary, { recursive: true, force: true });
  }
}
function tableColumns(db, table) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) throw new Error("Invalid table");
  return new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map((r) => String(r.name)));
}
function portableRow(row) {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Uint8Array ? { $binary: Buffer.from(v).toString("base64"), encoding: "base64" } : v]));
}
async function captureNativeRows(builder, file, queries, signal) {
  if (!await stat4(file).catch(() => void 0)) return;
  await withReadonlyDatabase(file, async (db) => {
    for (const [table, column, value] of queries) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column) || !tableColumns(db, table).has(column)) continue;
      const definition = db.prepare("SELECT sql FROM sqlite_master WHERE name=?").get(table);
      const schema = await builder.record({ table, sql: definition?.sql ?? null }, { database: path4.basename(file), kind: "schema" });
      await builder.event(schema, "metadata", { native_type: "table_schema", projection: "auxiliary" });
      const statement = db.prepare(`SELECT * FROM "${table}" WHERE "${column}"=?`);
      statement.setReadBigInts(true);
      for (const row of statement.iterate(value)) {
        signal?.throwIfAborted();
        const ref = await builder.record(portableRow(row), { database: path4.basename(file), table });
        await builder.event(ref, "metadata", { native_type: table, projection: "auxiliary" });
      }
    }
  }, signal);
}

// src/sources/workbuddy.ts
async function discoverWorkBuddy(root) {
  const database2 = path5.join(root, "workbuddy.db");
  try {
    await stat5(database2);
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  const files = /* @__PURE__ */ new Map();
  for (const directory of await readdir3(path5.join(root, "projects"), { withFileTypes: true }).catch(() => [])) {
    if (!directory.isDirectory()) continue;
    for (const file of await readdir3(path5.join(root, "projects", directory.name), { withFileTypes: true })) {
      if (file.isFile() && file.name.endsWith(".jsonl")) files.set(file.name.slice(0, -6), path5.join(root, "projects", directory.name, file.name));
    }
  }
  return withReadonlyDatabase(database2, (db) => {
    const cols = tableColumns(db, "sessions");
    if (!cols.has("id")) throw new Error("UNSUPPORTED_SOURCE");
    const selected = ["id", "title", "custom_title", "cwd", "status", "deleted_at", "updated_at", "archived", "is_archived", "archived_at"].filter((k) => cols.has(k));
    return db.prepare(`SELECT ${selected.map((k) => '"' + k + '"').join(",")} FROM sessions`).all().map((row) => {
      const nativeId = String(row.id), file = files.get(nativeId);
      if (!file) return void 0;
      return {
        sourceId: sourceKey("workbuddy", root, nativeId),
        app: "workbuddy",
        nativeId,
        root,
        file,
        title: String(row.custom_title || row.title || "\u672A\u547D\u540D\u4F1A\u8BDD"),
        cwd: row.cwd ? String(row.cwd) : void 0,
        updatedAt: number(row.updated_at),
        eligibility: eligibility(row, cols.has("deleted_at") && row.deleted_at === null && typeof row.status === "string" && workBuddyActiveStatuses.has(row.status))
      };
    }).filter((row) => row !== void 0);
  });
}
async function captureWorkBuddy(source, destination, signal) {
  const roots = [await realpath2(source.root), ...source.resourceRoots ?? []];
  const builder = await ArchiveBuilder.create(destination, "workbuddy", "responses-jsonl", { native_id: source.nativeId, title: source.title, ...source.cwd ? { cwd: source.cwd } : {} });
  builder.manifest.source.location = source.file;
  try {
    const snapshot = await builder.originalFile(source.file, void 0, signal);
    let index = 0;
    for await (const value of readJsonl(snapshot, { signal, lossless: true })) {
      const row = asRecord(value), ref = await builder.record(row, { file: path5.basename(source.file), record_index: index++ });
      await normalizeResponse(row, builder, ref, roots);
    }
    await captureNativeRows(builder, path5.join(source.root, "workbuddy.db"), [
      ["sessions", "id", source.nativeId],
      ["session_usage", "session_id", source.nativeId]
    ], signal);
    const artifact = path5.join(source.root, "artifact-index", source.nativeId + ".json");
    if (await stat5(artifact).catch(() => void 0)) {
      const snapshot2 = await builder.originalFile(artifact, "artifact-index.json", signal);
      const { readFile: readFile3 } = await import("node:fs/promises");
      const data = JSON.parse(await readFile3(snapshot2, "utf8"));
      const ref = await builder.record(data, { file: "artifact-index.json" });
      const content = [];
      for (const resource of data.artifacts ?? []) if (typeof resource.uri === "string") content.push({ type: "resource", resource_id: await builder.resource(resource.uri, ref, roots, resource.mimeType) });
      await builder.event(ref, "artifact", { content, native_type: "artifact-index" });
    }
    builder.issue("resource_discovery_scope", "Only recognized resource references within configured source roots are collected");
    return await builder.finish();
  } catch (error) {
    await builder.close();
    throw error;
  }
}

// src/sources/raccoon.ts
import path6 from "node:path";
import { stat as stat6, readdir as readdir4 } from "node:fs/promises";
async function discoverRaccoon(root) {
  const file = path6.join(root, "local-chat.sqlite3");
  if (!await stat6(file).catch(() => void 0)) return [];
  return withReadonlyDatabase(file, (db) => {
    const cols = tableColumns(db, "sessions");
    if (!cols.has("id")) throw new Error("UNSUPPORTED_SOURCE");
    const selected = ["id", "title", "workspace_dir", "available", "updated_at_ms", "archived", "is_archived", "archived_at", "deleted_at", "status"].filter((k) => cols.has(k));
    return db.prepare(`SELECT ${selected.map((k) => '"' + k + '"').join(",")} FROM sessions`).all().map((row) => ({
      sourceId: sourceKey("raccoon", root, String(row.id)),
      app: "raccoon",
      nativeId: String(row.id),
      root,
      file,
      title: String(row.title || "\u672A\u547D\u540D\u4F1A\u8BDD"),
      cwd: row.workspace_dir ? String(row.workspace_dir) : void 0,
      updatedAt: number(row.updated_at_ms),
      eligibility: eligibility(row, cols.has("available") && binaryState(row.available) === 1)
    }));
  });
}
async function captureRaccoon(source, destination, signal) {
  const b = await ArchiveBuilder.create(destination, "raccoon", "local-chat-sqlite", { native_id: source.nativeId, title: source.title, ...source.cwd ? { cwd: source.cwd } : {} });
  b.manifest.source.location = source.file;
  const roots = [source.root, ...source.resourceRoots ?? []];
  try {
    await captureNativeRows(b, source.file, [["sessions", "id", source.nativeId]], signal);
    await withReadonlyDatabase(source.file, async (db) => {
      const columns = tableColumns(db, "messages");
      if (!["session_id", "payload_json", "seq", "id"].every((k) => columns.has(k))) throw new Error("UNSUPPORTED_SOURCE");
      const query = db.prepare("SELECT * FROM messages WHERE session_id=? ORDER BY seq,id");
      query.setReadBigInts(true);
      for (const row of query.iterate(source.nativeId)) {
        signal?.throwIfAborted();
        const ref = await b.record(portableRow(row), { table: "messages", key: String(row.id) });
        const payload = asRecord(JSON.parse(String(row.payload_json))), nativeType = String(row.type ?? payload.type ?? "unknown");
        let content = payload.content;
        const kind = ["text", "generate", "code"].includes(nativeType) ? "message" : ["file", "image"].includes(nativeType) ? "artifact" : nativeType === "execution" ? "tool_result" : nativeType === "change_set" ? "checkpoint" : ["plan", "todo"].includes(nativeType) ? "plan" : "opaque";
        if (nativeType === "file" && content && typeof content === "object") content = [{ ...content, type: "file" }];
        if (nativeType === "image" && typeof content === "string") content = [{ type: "opaque", value: content }];
        await b.event(ref, kind, {
          role: String(row.role ?? "unknown"),
          content: await normalizeBlocks(content, b, ref, roots),
          native_type: nativeType,
          native_id: String(row.id),
          ...number(row.created_at_ms) === void 0 ? {} : { timestamp: number(row.created_at_ms) },
          ...row.active === void 0 ? {} : { active: Number(row.active) !== 0 },
          ...row.visible === void 0 ? {} : { visible: Number(row.visible) !== 0 },
          ...row.turn_id == null ? {} : { turn_id: String(row.turn_id) }
        });
      }
    }, signal);
    const changes = path6.join(source.root, "change_history.db");
    if (await stat6(changes).catch(() => void 0)) for await (const row of readJsonl(changes, { signal, lossless: true })) {
      if (String(row.sessionId) !== source.nativeId) continue;
      const ref = await b.record(row, { file: "change_history.db" });
      await b.event(ref, "checkpoint", { native_type: "change-history", projection: "auxiliary" });
      if (typeof row.checkpointDir === "string") await b.resource(row.checkpointDir, ref, roots);
      if (typeof row.workspaceDir === "string") {
        const workspace = path6.resolve(row.workspaceDir);
        if (!roots.some((root) => workspace === path6.resolve(root) || workspace.startsWith(path6.resolve(root) + path6.sep))) {
          b.issue("external_task_workspace", "Associated task output is outside resource roots");
          continue;
        }
        for (const dir of [".box-agent/task-registry/tasks", "output/tasks"]) {
          const visit = async (folder) => {
            for (const entry of await readdir4(folder, { withFileTypes: true }).catch(() => [])) {
              const file = path6.join(folder, entry.name);
              if (entry.isDirectory()) await visit(file);
              else if (entry.isFile()) {
                const record = await b.record({ path: file }, { kind: "associated_task_file" });
                const rid = await b.resource(file, record, roots);
                await b.event(record, "artifact", { content: [{ type: "resource", resource_id: rid }] });
              }
            }
          };
          await visit(path6.join(workspace, dir));
        }
      }
    }
    b.issue("native_cards", "Private cards are preserved in original records; unsupported tool structure is not executable");
    return await b.finish();
  } catch (error) {
    await b.close();
    throw error;
  }
}

// src/sources/cursor.ts
import path7 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { stat as stat7 } from "node:fs/promises";
function project(meta) {
  const ws = meta.workspaceIdentifier;
  if (!ws || typeof ws !== "object") return {};
  const uri = ws.folder ?? ws.configPath ?? ws.workspace;
  if (typeof uri !== "string") return {};
  if (ws.folder && uri.startsWith("file:")) {
    try {
      const cwd = fileURLToPath2(uri);
      return { cwd, project: { path: cwd, name: path7.basename(cwd), kind: "directory", uri } };
    } catch {
      return {};
    }
  }
  return { project: { path: "", name: meta.name || "\u6765\u6E90\u5DE5\u4F5C\u533A", kind: ws.folder ? "remote" : "workspace_file", uri } };
}
async function discoverCursor(root) {
  const file = path7.join(root, "User/globalStorage/state.vscdb");
  if (!await stat7(file).catch(() => void 0)) return [];
  return withReadonlyDatabase(file, (db) => {
    const cols = tableColumns(db, "composerHeaders");
    if (!cols.has("composerId") || !cols.has("value")) throw new Error("UNSUPPORTED_SOURCE");
    const selected = ["composerId", "value", "isArchived", "isSubagent", "lastUpdatedAt", "isDeleted"].filter((k) => cols.has(k));
    return db.prepare(`SELECT ${selected.map((k) => '"' + k + '"').join(",")} FROM composerHeaders`).all().filter((r) => !Number(r.isSubagent ?? 0)).map((row) => {
      const header = asRecord(JSON.parse(String(row.value))), nativeId = String(row.composerId);
      return {
        sourceId: sourceKey("cursor", root, nativeId),
        app: "cursor",
        nativeId,
        root,
        file,
        title: String(header.name || "\u672A\u547D\u540D\u4F1A\u8BDD"),
        cwd: project(header).cwd,
        updatedAt: number(row.lastUpdatedAt),
        eligibility: eligibility({ ...header, ...row }, cols.has("isArchived") && binaryState(row.isArchived) !== void 0)
      };
    });
  });
}
async function captureCursor(source, destination, signal) {
  const b = await ArchiveBuilder.create(destination, "cursor", "composer-disk-kv", { native_id: source.nativeId, title: source.title, ...source.cwd ? { cwd: source.cwd } : {} });
  b.manifest.source.location = source.file;
  const roots = [source.root, ...source.resourceRoots ?? []];
  try {
    await captureNativeRows(b, source.file, [["composerHeaders", "composerId", source.nativeId]], signal);
    await withReadonlyDatabase(source.file, async (db) => {
      const row = db.prepare("SELECT key,value FROM cursorDiskKV WHERE key=?").get("composerData:" + source.nativeId);
      if (!row) throw new Error("Composer not found");
      const meta = asRecord(JSON.parse(String(row.value)));
      Object.assign(b.manifest.session, project(meta));
      const ref = await b.record(portableRow(row), { table: "cursorDiskKV", key: row.key });
      await b.event(ref, "metadata", { native_type: "composerData", projection: "auxiliary" });
      if (!Array.isArray(meta.fullConversationHeadersOnly)) b.issue("unresolved_history", "Composer has no verified active message order");
      const ids = (meta.fullConversationHeadersOnly ?? []).map((h) => String(h.bubbleId));
      const active = new Set(ids), rows = /* @__PURE__ */ new Map();
      for (const type of ["bubbleId", "checkpointId", "agentKv"]) {
        const prefix = type + ":" + source.nativeId + ":";
        for (const r of db.prepare("SELECT key,value FROM cursorDiskKV WHERE key>=? AND key<? ORDER BY key").iterate(prefix, prefix + "\uFFFF")) rows.set(String(r.key), r);
      }
      const ordered = ids.map((id2) => "bubbleId:" + source.nativeId + ":" + id2);
      const listed = new Set(ordered);
      ordered.push(...[...rows.keys()].filter((k) => !listed.has(k)));
      for (const key of ordered) {
        signal?.throwIfAborted();
        const row2 = rows.get(key);
        if (!row2) {
          b.issue("unresolved_history", "Active composer header refers to a missing bubble");
          continue;
        }
        const ref2 = await b.record(portableRow(row2), { table: "cursorDiskKV", key });
        if (!key.startsWith("bubbleId:")) {
          await b.event(ref2, key.startsWith("checkpointId:") ? "checkpoint" : "opaque", { projection: "auxiliary" });
          continue;
        }
        const bubble = asRecord(JSON.parse(String(row2.value))), id2 = String(bubble.bubbleId ?? key.split(":").at(-1));
        const attrs = { native_id: id2, active: active.has(id2), ...number(bubble.createdAt) === void 0 ? {} : { timestamp: number(bubble.createdAt) } };
        await b.event(ref2, "message", { ...attrs, native_type: "bubble", role: Number(bubble.type) === 1 ? "user" : Number(bubble.type) === 2 ? "assistant" : "unknown", content: await normalizeBlocks(bubble.text ?? "", b, ref2, roots) });
        const tool = bubble.toolFormerData;
        if (tool && typeof tool === "object") {
          await b.event(ref2, "tool_call", { ...attrs, role: "assistant", native_type: "toolFormerData", content: [{ type: "tool_call", call_id: String(tool.toolCallId ?? ""), name: String(tool.name ?? ""), arguments: tool.rawArgs ?? tool.params ?? "", argument_encoding: typeof tool.rawArgs === "string" ? "json_string" : "json" }] });
          if ("result" in tool) await b.event(ref2, "tool_result", { ...attrs, role: "tool", content: [{ type: "tool_result", call_id: String(tool.toolCallId ?? ""), output: tool.result }] });
        }
      }
    }, signal);
    b.issue("cursor_dependency_closure", "Per-composer records retained; shared blobs and external histories are not assumed collected");
    return await b.finish();
  } catch (error) {
    await b.close();
    throw error;
  }
}

// src/sources/codex.ts
import path8 from "node:path";
import { readdir as readdir5, stat as stat8, realpath as realpath3 } from "node:fs/promises";
import { createReadStream as createReadStream4 } from "node:fs";
async function database(root) {
  const names = (await readdir5(root)).filter((n) => /^state_\d+\.sqlite$/.test(n)).sort((a, b) => Number(b.match(/\d+/)[0]) - Number(a.match(/\d+/)[0]));
  return names[0] ? path8.join(root, names[0]) : void 0;
}
async function discoverCodex(root) {
  const file = await database(root);
  if (!file) return [];
  const canonical = await realpath3(root);
  const rows = await withReadonlyDatabase(file, (db) => {
    const cols = tableColumns(db, "threads");
    if (!cols.has("id") || !cols.has("rollout_path")) throw new Error("UNSUPPORTED_SOURCE");
    const selected = ["id", "title", "name", "cwd", "rollout_path", "updated_at", "archived", "deleted_at", "source", "thread_source"].filter((k) => cols.has(k));
    return db.prepare(`SELECT ${selected.map((k) => '"' + k + '"').join(",")} FROM threads`).all().map((row) => ({ row, proven: cols.has("archived") && binaryState(row.archived) !== void 0 }));
  });
  const result = [];
  for (const { row, proven } of rows) {
    if (["subagent", "guardian_review"].includes(String(row.thread_source)) || String(row.source).startsWith("{")) continue;
    const file2 = await realpath3(String(row.rollout_path)).catch(() => void 0);
    if (!file2 || !file2.startsWith(canonical + path8.sep) || !(await stat8(file2)).isFile()) continue;
    const nativeId = String(row.id);
    result.push({
      sourceId: sourceKey("codex", root, nativeId),
      app: "codex",
      nativeId,
      root,
      file: file2,
      title: String(row.name || row.title || "\u672A\u547D\u540D\u4F1A\u8BDD"),
      cwd: row.cwd ? String(row.cwd) : void 0,
      updatedAt: number(row.updated_at) === void 0 ? void 0 : number(row.updated_at) * 1e3,
      eligibility: file2.split(path8.sep).includes("archived_sessions") ? "archived" : eligibility(row, proven)
    });
  }
  return result;
}
async function captureCodex(source, destination, signal) {
  const builder = await ArchiveBuilder.create(destination, "codex", "rollout-jsonl", { native_id: source.nativeId, title: source.title, ...source.cwd ? { cwd: source.cwd } : {} });
  builder.manifest.source.location = source.file;
  try {
    const visited = /* @__PURE__ */ new Set();
    const canonicalRoot = await realpath3(source.root);
    const historyBase = async (base, current) => {
      if (typeof base.thread_id !== "string" || !/^[a-f0-9-]{36}$/.test(base.thread_id) || !Number.isSafeInteger(base.end_byte_offset) || base.end_byte_offset < 1) throw new LinkError("SOURCE_HISTORY_MISSING");
      const candidates = [];
      for (const folder of ["sessions", "archived_sessions"]) {
        for (const entry of await readdir5(path8.join(source.root, folder), { recursive: true, withFileTypes: true }).catch(() => [])) {
          if (!entry.isFile() || !entry.name.endsWith(base.thread_id + ".jsonl")) continue;
          const file2 = await realpath3(path8.join(entry.parentPath, entry.name));
          if (file2 === current || visited.has(file2) || !file2.startsWith(canonicalRoot + path8.sep) || (await stat8(file2)).size < base.end_byte_offset) continue;
          let header, count = 0;
          for await (const row of readJsonStream(createReadStream4(file2, { end: base.end_byte_offset - 1, signal }), { signal })) {
            header ??= row;
            count++;
          }
          if (header?.type !== "session_meta" || header.payload?.id !== base.thread_id) continue;
          if (!header.payload.history_base && Number.isSafeInteger(base.end_ordinal_exclusive) && count !== base.end_ordinal_exclusive) continue;
          candidates.push(file2);
        }
      }
      return candidates.length === 1 ? candidates[0] : void 0;
    };
    const appendIndex = async (base) => {
      const indexFile = path8.join(source.root, "thread_history_1.sqlite");
      let restored = 0;
      if (await stat8(indexFile).catch(() => void 0)) await withReadonlyDatabase(indexFile, async (db) => {
        const columns = tableColumns(db, "thread_items");
        if (!["thread_id", "rollout_ordinal", "item_type", "item_json"].every((column) => columns.has(column))) return;
        const updated = columns.has("updated_at_ordinal") ? "AND COALESCE(updated_at_ordinal, rollout_ordinal) < ?" : "";
        const cutoff = base.end_ordinal_exclusive;
        if (!Number.isSafeInteger(cutoff) || cutoff < 1) throw new LinkError("SOURCE_HISTORY_MISSING");
        const rows = db.prepare(`SELECT * FROM thread_items WHERE thread_id=? AND rollout_ordinal < ? ${updated} AND item_type IN ('userMessage','agentMessage') ORDER BY rollout_ordinal, item_id`);
        rows.setReadBigInts(true);
        for (const row of rows.iterate(...updated ? [base.thread_id, cutoff, cutoff] : [base.thread_id, cutoff])) {
          signal?.throwIfAborted();
          const item = asRecord(JSON.parse(String(row.item_json))), role = row.item_type === "userMessage" ? "user" : "assistant";
          const ref = await builder.record(portableRow(row), { table: "thread_items", history_base: base.thread_id });
          await builder.event(ref, "message", {
            role,
            native_type: String(row.item_type),
            native_id: String(row.item_id),
            content: await normalizeBlocks(role === "user" ? item.content : item.text, builder, ref, [source.root, ...source.resourceRoots ?? []]),
            ...number(row.created_at_ms) === void 0 ? {} : { timestamp: number(row.created_at_ms) }
          });
          restored++;
        }
      }, signal);
      builder.issue(restored ? "history_index_recovery" : "missing_dialogue_history", restored ? "Inherited dialogue restored from the source history index" : "An earlier source history segment is no longer available");
    };
    const append = async (file2, prefixBytes) => {
      if (visited.has(file2) || visited.size >= 32) throw new LinkError("SOURCE_HISTORY_MISSING");
      visited.add(file2);
      const snapshot = await builder.originalFile(file2, `history-${visited.size}.jsonl`, signal, prefixBytes);
      let first;
      for await (const row of readJsonl(snapshot, { signal })) {
        first = row;
        break;
      }
      const base = first?.type === "session_meta" ? first.payload?.history_base : void 0;
      if (base) {
        const previous = await historyBase(base, file2);
        if (previous) await append(previous, base.end_byte_offset);
        else await appendIndex(base);
      }
      let index = 0;
      for await (const value of readJsonl(snapshot, { signal, lossless: true })) {
        const row = asRecord(value), ref = await builder.record(row, { file: path8.basename(file2), record_index: index++ });
        if (row.type === "response_item" && row.payload && typeof row.payload === "object") {
          await normalizeResponse(asRecord(row.payload), builder, ref, [source.root, ...source.resourceRoots ?? []], true, row.timestamp);
        } else {
          if (row.type === "compacted" || row.type === "compaction") builder.issue("context_compaction", "Model-context compaction does not remove the recorded dialogue");
          await builder.event(ref, row.type === "session_meta" ? "metadata" : row.type === "compacted" ? "compaction" : "lifecycle", { native_type: String(row.type), projection: "auxiliary" });
        }
      }
    };
    await append(source.file);
    const file = await database(source.root);
    if (file) await captureNativeRows(builder, file, [
      ["threads", "id", source.nativeId],
      ["thread_dynamic_tools", "thread_id", source.nativeId],
      ["thread_artifacts", "thread_id", source.nativeId],
      ["thread_spawn_edges", "parent_thread_id", source.nativeId]
    ], signal);
    await captureNativeRows(builder, path8.join(source.root, "thread_history_1.sqlite"), [
      ["thread_turns", "thread_id", source.nativeId],
      ["thread_items", "thread_id", source.nativeId]
    ], signal);
    builder.issue("multi_store_snapshot", "Rollout and auxiliary indexes are read consistently but are not one atomic cross-store snapshot");
    builder.issue("resource_discovery_scope", "Only recognized resource references within configured source roots are collected");
    return await builder.finish();
  } catch (error) {
    await builder.close();
    throw error;
  }
}

// src/sources/registry.ts
function defaultRoots() {
  const home = os2.homedir();
  return {
    workbuddy: path9.join(home, ".workbuddy"),
    codex: path9.join(home, ".codex"),
    dsh: path9.join(home, ".dsh"),
    raccoon: path9.join(home, "Library/Application Support/office-raccoon"),
    cursor: path9.join(home, "Library/Application Support/Cursor")
  };
}
var SourceRegistry = class {
  constructor(roots = defaultRoots(), resourceRoots = []) {
    this.roots = roots;
    this.resourceRoots = resourceRoots;
  }
  async discover(app) {
    const root = this.roots[app];
    if (!root || !await stat9(root).catch(() => void 0)) return [];
    if (app === "workbuddy") return discoverWorkBuddy(path9.resolve(root));
    if (app === "codex") return discoverCodex(path9.resolve(root));
    if (app === "raccoon") return discoverRaccoon(path9.resolve(root));
    if (app === "cursor") return discoverCursor(path9.resolve(root));
    if (app === "dsh") return discoverLegacy(path9.resolve(root));
    return [];
  }
  async sources() {
    const result = [];
    for (const app of ["workbuddy", "codex", "raccoon", "cursor"]) {
      try {
        const rows = await this.discover(app);
        result.push({ app, available: !!this.roots[app] && !!await stat9(this.roots[app]).catch(() => void 0), count: rows.filter((r) => r.eligibility === "active").length, unknown: rows.some((r) => r.eligibility === "unknown") });
      } catch {
        result.push({ app, available: false, count: 0, error: "\u6765\u6E90\u7ED3\u6784\u4E0D\u652F\u6301\u6216\u5F53\u524D\u65E0\u6CD5\u8BFB\u53D6" });
      }
    }
    return result;
  }
  async sessions(app, query = {}) {
    if (!["workbuddy", "codex", "raccoon", "cursor", "dsh"].includes(app)) throw new LinkError("INVALID_SOURCE");
    if (app === "dsh") return { items: [] };
    const limit = query.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new LinkError("INVALID_QUERY");
    let offset = 0;
    if (query.cursor) {
      try {
        const cursor = JSON.parse(Buffer.from(query.cursor, "base64url").toString());
        if (cursor.app !== app || cursor.text !== (query.text ?? "") || !Number.isSafeInteger(cursor.offset) || cursor.offset < 0) throw new Error();
        offset = cursor.offset;
      } catch {
        throw new LinkError("INVALID_CURSOR");
      }
    }
    const rows = (await this.discover(app)).filter((s) => s.eligibility === "active" && (!query.text || (s.title + "\n" + s.cwd).toLowerCase().includes(query.text.toLowerCase()))).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || a.sourceId.localeCompare(b.sourceId));
    const items = rows.slice(offset, offset + limit).map(({ root: _root, file: _file, eligibility: _eligibility, ...publicFields }) => publicFields);
    return { items, ...offset + limit < rows.length ? { nextCursor: Buffer.from(JSON.stringify({ app, text: query.text ?? "", offset: offset + limit })).toString("base64url") } : {} };
  }
  async assertActive(sourceId2) {
    if (!/^(workbuddy|codex|raccoon|cursor|dsh):[a-f0-9]{32}$/.test(sourceId2)) throw new LinkError("INVALID_SOURCE");
    const app = sourceId2.split(":")[0];
    const source = (await this.discover(app)).find((s) => s.sourceId === sourceId2);
    if (!source) throw new LinkError("SOURCE_INACTIVE", "\u539F\u4F1A\u8BDD\u5DF2\u4E0D\u5B58\u5728\u6216\u65E0\u6CD5\u6838\u5B9E\u5F53\u524D\u72B6\u6001");
    if (source.eligibility !== "active") throw new LinkError("SOURCE_INACTIVE", "\u539F\u4F1A\u8BDD\u5DF2\u5F52\u6863\u3001\u5220\u9664\u6216\u5F53\u524D\u72B6\u6001\u65E0\u6CD5\u6838\u5B9E");
    return { ...source, resourceRoots: this.resourceRoots };
  }
  async capture(sourceId2, destination, signal) {
    const source = await this.assertActive(sourceId2);
    const result = source.app === "workbuddy" ? await captureWorkBuddy(source, destination, signal) : source.app === "codex" ? await captureCodex(source, destination, signal) : source.app === "raccoon" ? await captureRaccoon(source, destination, signal) : source.app === "cursor" ? await captureCursor(source, destination, signal) : source.app === "dsh" ? await captureLegacy(source, destination, signal) : void 0;
    if (!result) throw new LinkError("UNSUPPORTED_SOURCE");
    await this.assertActive(sourceId2);
    return result;
  }
};

// src/sources/worker.ts
parentPort.once("message", async (task) => {
  try {
    let value;
    if (task.kind === "legacy-file") {
      const source = await new SourceRegistry(task.roots).assertActive(task.sourceId);
      value = await captureLegacy({ ...source, file: task.path }, task.destination);
    } else if (task.kind === "sources") value = await new SourceRegistry(task.roots).sources();
    else if (task.kind === "sessions") value = await new SourceRegistry(task.roots).sessions(task.app, task.query);
    else if (task.kind === "active") value = await new SourceRegistry(task.roots).assertActive(task.sourceId);
    else if (task.kind === "capture") value = await new SourceRegistry(task.roots, task.resourceRoots).capture(task.sourceId, task.destination);
    else if (task.kind === "validate") {
      await validateArchive(task.path);
      value = { valid: true };
    } else if (task.kind === "import") value = await importArchive(task.path, task.destination, new AbortController().signal);
    else if (task.kind === "import-many") value = await importArchives(task.path, task.destination, new AbortController().signal);
    else if (task.kind === "export-many") {
      await exportArchives(task.paths, task.destination);
      value = { file: task.destination };
    } else {
      await exportArchive(task.path, task.destination);
      value = { file: task.destination };
    }
    parentPort.postMessage({ ok: true, value });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker failed";
    const code = ["Archive exceeds size limit", "Source exceeds size limit", "JSONL line exceeds size limit"].includes(message) ? "CONTENT_LIMIT" : error && typeof error === "object" && "code" in error ? error.code : "SOURCE_ERROR";
    parentPort.postMessage({ ok: false, code, error: message });
  } finally {
    parentPort.close();
  }
});
//# sourceMappingURL=source-worker.js.map
