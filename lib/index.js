// src/index.ts
import { dshHomePath, resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { mkdir as mkdir4, stat as stat4, rm as rm4 } from "node:fs/promises";
import { createReadStream as createReadStream5, createWriteStream as createWriteStream3 } from "node:fs";
import { randomUUID as randomUUID5 } from "node:crypto";
import path8 from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

// src/transport.ts
import { Ajv } from "ajv";
var LinkError = class extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
};
function makeRpcHandler(dispatch) {
  return async (endpoint, payload, signal, peer) => {
    if (peer.principal.kind !== "owner") return { ok: false, error: { code: "FORBIDDEN", message: "\u4EC5\u5BBF\u4E3B\u6240\u6709\u8005\u53EF\u8FC1\u79FB\u4F1A\u8BDD", details: {} } };
    try {
      signal.throwIfAborted();
      return { ok: true, value: await dispatch(endpoint, payload, signal) };
    } catch (error) {
      return { ok: false, error: {
        code: error instanceof LinkError ? error.code : "IMPORT_FAILED",
        message: error instanceof LinkError ? error.message : "\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u67E5\u770B\u8FC1\u79FB\u72B6\u6001",
        details: {}
      } };
    }
  };
}
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
var validators = Object.fromEntries(Object.entries(requestSchemas).map(([key, schema]) => [key, ajv.compile(schema)]));
function validateRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LinkError("INVALID_REQUEST");
  const row = value;
  if (Object.keys(row).some((k) => k !== "endpoint" && k !== "payload") || typeof row.endpoint !== "string" || !Object.hasOwn(validators, row.endpoint)) throw new LinkError("INVALID_REQUEST");
  if (!validators[row.endpoint](row.payload)) throw new LinkError("INVALID_REQUEST");
  return { endpoint: row.endpoint, payload: row.payload };
}
function errorResult(error) {
  return { ok: false, error: {
    code: error instanceof LinkError ? error.code : "IMPORT_FAILED",
    message: error instanceof LinkError ? error.message : "\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u67E5\u770B\u8FC1\u79FB\u8BB0\u5F55",
    details: {}
  } };
}

// src/transfers.ts
import { mkdir as mkdir3, readFile as readFile4, readdir as readdir2, rm as rm3, rename as rename3, stat as stat3 } from "node:fs/promises";
import path6 from "node:path";
import { randomUUID as randomUUID4 } from "node:crypto";

// src/operations.ts
import { mkdir as mkdir2, readFile as readFile3, open as open2, rename as rename2, rm as rm2, realpath as realpath2, stat as stat2 } from "node:fs/promises";
import { randomUUID as randomUUID3 } from "node:crypto";

// src/dialogue.ts
function dialogueText(role, value) {
  if (role !== "user") return value.trim() ? value : void 0;
  let text2 = value;
  if (/^\s*(?:# Files mentioned by the user:|Distinguish instructions in attached documents)/.test(text2)) {
    const request = text2.indexOf("## My request:");
    if (request >= 0) text2 = text2.slice(request + "## My request:".length).replace(/^\s*\n/, "");
  }
  text2 = text2.replace(/\s*<image name=\[Image #[^\]]+\] path="[^"]*">\s*<\/image>\s*$/g, "");
  if (/^\s*# Response annotations:/.test(text2)) {
    const annotations = text2.match(/<response-annotations>([\s\S]*?)<\/response-annotations>/);
    const request = text2.indexOf("## My request:");
    if (annotations && request >= 0) {
      try {
        const rows = JSON.parse(annotations[1]);
        if (Array.isArray(rows) && rows.every((row) => row && typeof row.text === "string")) {
          const quoted = rows.map((row) => "> " + row.text.replace(/\n/g, "\n> ") + (typeof row.annotation === "string" ? "\n" + row.annotation : "")).join("\n\n");
          text2 = quoted + "\n\n" + text2.slice(request + "## My request:".length).trimStart();
        }
      } catch {
      }
    }
  }
  text2 = text2.replace(/^\s*# AGENTS\.md instructions[^\n]*\r?\n\s*<INSTRUCTIONS>[\s\S]*?<\/INSTRUCTIONS>\s*/i, "");
  const context = /^\s*<(environment_context|permissions instructions|collaboration_mode|turn_aborted|system_reminder|app-context|skills_instructions|subagents|external_codex_apps_open_page)>[\s\S]*?<\/\1>\s*/i;
  while (context.test(text2)) text2 = text2.replace(context, "");
  const reply = text2.match(/^\s*<send_user_message_question_reply>\s*([\s\S]*?)\s*<\/send_user_message_question_reply>\s*$/);
  if (reply) {
    try {
      const rows = JSON.parse(reply[1]);
      if (Array.isArray(rows) && rows.every((row) => row && typeof row === "object" && typeof row.answer === "string")) {
        text2 = rows.map((row) => typeof row.question === "string" ? `${row.question}
\u56DE\u7B54\uFF1A${row.answer}` : row.answer).join("\n");
      }
    } catch {
    }
  }
  return text2.trim() ? text2 : void 0;
}

// src/preview.ts
function conversationMessages(plan) {
  const toolRecords = new Set(plan.report.issues.filter((i) => i.code === "tool_history").map((i) => i.recordRef));
  return plan.messages.flatMap((message) => {
    if (message.presentation === "context" || message.presentation === void 0 && toolRecords.has(message.recordRef)) return [];
    const content = message.content.flatMap((b) => {
      if (b.type !== "text" || /^\[(?:从 .+ 导入的历史产物|历史资源未迁入：)/.test(b.text)) return [];
      const text2 = dialogueText(message.role, b.text);
      return text2 === void 0 ? [] : [{ type: "text", text: text2 }];
    });
    return content.length ? [{ role: message.role, content }] : [];
  });
}

// src/operations.ts
import path5 from "node:path";
import { SessionId as SessionId2 } from "@deepseek-ai/dsh-session";

// src/ledger.ts
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { chmodSync } from "node:fs";
var Ledger = class {
  writer;
  reader;
  writing = false;
  constructor(file) {
    this.writer = new DatabaseSync(file);
    this.writer.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=0;
      CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY, dedup TEXT UNIQUE NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, preview TEXT NOT NULL, operation TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS previews(id TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    chmodSync(file, 384);
    this.reader = new DatabaseSync(file, { readOnly: true });
    this.reader.exec("PRAGMA query_only=ON; PRAGMA busy_timeout=0");
  }
  savePreview(id2, value) {
    if (this.writing) throw new LinkError("IMPORT_BUSY");
    try {
      this.writer.prepare("INSERT INTO previews VALUES (?,?)").run(id2, JSON.stringify(value));
    } catch (error) {
      if (String(error).includes("locked")) throw new LinkError("IMPORT_BUSY");
      throw error;
    }
  }
  preview(id2) {
    const row = this.reader.prepare("SELECT value FROM previews WHERE id=?").get(id2);
    return row ? JSON.parse(String(row.value)) : void 0;
  }
  operation(id2) {
    const row = this.reader.prepare("SELECT value FROM operations WHERE id=?").get(id2);
    return row ? JSON.parse(String(row.value)) : void 0;
  }
  operations() {
    return this.reader.prepare("SELECT value FROM operations WHERE json_extract(value, '$.hidden') IS NOT 1 ORDER BY rowid DESC LIMIT 100").all().map((row) => JSON.parse(String(row.value)));
  }
  reserve(preview, dedup, requestId, title) {
    const request = this.reader.prepare("SELECT * FROM requests WHERE id=?").get(requestId);
    if (request) {
      if (request.preview !== preview) throw new LinkError("REQUEST_CONFLICT");
      return this.operation(String(request.operation));
    }
    if (this.writing) throw new LinkError("IMPORT_BUSY");
    try {
      this.writer.exec("BEGIN IMMEDIATE");
    } catch {
      throw new LinkError("IMPORT_BUSY");
    }
    try {
      const existing = this.writer.prepare("SELECT value FROM operations WHERE dedup=?").get(dedup);
      const op = existing ? JSON.parse(String(existing.value)) : {
        operationId: randomUUID(),
        previewId: preview,
        title,
        targetSessionId: "dsh-alink-" + randomUUID(),
        state: "prepared",
        stage: "queued"
      };
      if (existing && op.hidden) {
        delete op.hidden;
        this.update(op);
      }
      if (!existing) this.writer.prepare("INSERT INTO operations VALUES (?,?,?)").run(op.operationId, dedup, JSON.stringify(op));
      this.writer.prepare("INSERT INTO requests VALUES (?,?,?)").run(requestId, preview, op.operationId);
      this.writer.exec("COMMIT");
      return op;
    } catch (error) {
      this.writer.exec("ROLLBACK");
      throw error;
    }
  }
  hide(id2) {
    if (this.writing) throw new LinkError("IMPORT_BUSY");
    const operation = this.operation(id2);
    if (!operation) throw new LinkError("OPERATION_NOT_FOUND");
    operation.hidden = true;
    this.update(operation);
  }
  update(operation) {
    this.writer.prepare("UPDATE operations SET value=? WHERE id=?").run(JSON.stringify(operation), operation.operationId);
  }
  async withWriter(action) {
    if (this.writing) throw new LinkError("IMPORT_BUSY");
    try {
      this.writer.exec("BEGIN IMMEDIATE");
    } catch {
      throw new LinkError("IMPORT_BUSY");
    }
    this.writing = true;
    try {
      const result = await action();
      this.writer.exec("COMMIT");
      return result;
    } catch (error) {
      this.writer.exec("ROLLBACK");
      throw error;
    } finally {
      this.writing = false;
    }
  }
  reconcile(active = /* @__PURE__ */ new Set()) {
    if (this.writing) return;
    try {
      this.writer.exec("BEGIN IMMEDIATE");
    } catch {
      return;
    }
    try {
      for (const row of this.writer.prepare("SELECT value FROM operations").all()) {
        const op = JSON.parse(String(row.value));
        if (!active.has(op.operationId) && ["prepared", "writing", "verifying"].includes(op.state)) {
          op.state = "needs-attention";
          op.stage = "interrupted";
          op.errorCode = "INTERRUPTED";
          this.update(op);
        }
      }
      this.writer.exec("COMMIT");
    } catch (error) {
      this.writer.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.reader.close();
    this.writer.close();
  }
};

// src/mapping.ts
import path2 from "node:path";

// src/sources/jsonl.ts
import { createReadStream, createWriteStream } from "node:fs";
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

// src/archive.ts
import { createHash, randomUUID as randomUUID2 } from "node:crypto";
import { createReadStream as createReadStream2, createWriteStream as createWriteStream2 } from "node:fs";
import { open, mkdir, readFile, writeFile, lstat, stat, realpath, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import yauzl from "yauzl";
import yazl from "yazl";
async function fileHash(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream2(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function readManifest(root) {
  return JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
}
async function archiveDigest(root) {
  const m = await readManifest(root);
  return createHash("sha256").update(encode({
    source: m.source,
    session: m.session,
    records: m.integrity["records.jsonl"].sha256,
    events: m.integrity["events.jsonl"].sha256,
    objects: [...m.resources, ...m.original_files].map((r) => r.sha256 ?? ("uri" in r ? r.uri : "")).sort()
  })).digest("hex");
}
var schemas;
async function validators2() {
  return schemas ??= (async () => {
    const ajv2 = new Ajv2020({ strict: false, validateFormats: false });
    const directory = new URL("../schemas/", import.meta.url);
    const result = {};
    for (const name3 of ["manifest", "event", "record"]) result[name3] = ajv2.compile(JSON.parse(await readFile(new URL(name3 + ".json", directory), "utf8")));
    return result;
  })();
}
async function validateArchive(root) {
  const base = await realpath(root), checks = await validators2();
  const regular = async (relative) => {
    const file = path.join(base, relative), info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || !(await realpath(file)).startsWith(base + path.sep)) throw new Error("Unsafe archive path");
    return file;
  };
  await regular("manifest.json");
  const m = await readManifest(base);
  if (!checks.manifest(m)) throw new Error("Invalid archive manifest: " + JSON.stringify(checks.manifest.errors));
  for (const name3 of ["events.jsonl", "records.jsonl"]) {
    const file = await regular(name3), expected = m.integrity[name3];
    if (await fileHash(file) !== expected.sha256 || (await stat(file)).size !== expected.size) throw new Error("Integrity mismatch: " + name3);
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
    if ((await stat(file)).size !== object2.size || await fileHash(file) !== object2.sha256) throw new Error("Object integrity mismatch");
  }
  if (m.coverage.native_records !== records.size || m.coverage.events !== count || encode(Object.entries(m.coverage.event_kinds).sort()) !== encode(Object.entries(kinds).sort())) throw new Error("Coverage mismatch");
}

// src/dsh/history.ts
import { createHash as createHash2 } from "node:crypto";
import {
  Session,
  SessionId,
  SessionLogOffset,
  SessionSeq,
  SESSION_FORMAT_VERSION
} from "@deepseek-ai/dsh-session";
import {
  createAssistantMessage,
  createUserMessage,
  createSystemMessage,
  AssistantStreamAccumulator
} from "@deepseek-ai/dsh-llm";
function digest(value) {
  return createHash2("sha256").update(JSON.stringify(value)).digest("hex");
}
function messageDigest(messages) {
  return digest(messages.map((m) => ({ role: m.role, content: m.content })));
}
function createImportedHistory(input) {
  const header = {
    version: SESSION_FORMAT_VERSION,
    id: SessionId(input.id),
    createdAt: input.createdAt,
    cwd: input.cwd,
    agentPreset: input.agentPreset,
    isSeeded: false
  };
  const events = [];
  let time = input.createdAt;
  const add = (event) => {
    events.push({ ...event, seq: SessionSeq(events.length), time });
  };
  for (const [index, item] of input.messages.entries()) {
    const turn = index + 1, step = 1;
    time = item.timestamp ?? input.createdAt;
    const content = item.content ?? [{ type: "text", text: item.text }];
    add({ type: "turn/start", data: { turn } });
    add({ type: "step/start", data: { turn, step } });
    if (index === 0) add({ type: "system/message", data: { turn, step, message: createSystemMessage("") }, surfaceOp: "append" });
    if (item.role === "user") {
      add({ type: "user/message", data: createUserMessage({ source: { kind: "user" }, content }), surfaceOp: "append" });
    } else {
      const stream = new AssistantStreamAccumulator();
      content.forEach((block, i) => {
        stream.push({ time, chunk: { type: "block-start", index: i, blockType: block.type } });
        if (block.type === "text") stream.push({ time, chunk: { type: "text-delta", index: i, text: block.text } });
        stream.push({ time, chunk: { type: "block-end", index: i, block } });
      });
      stream.push({ time, chunk: { type: "finish", reason: { kind: "stop" } } });
      const message = createAssistantMessage({ source: { provider: "dsh-alink", model: "imported-history" }, content });
      add({ type: "assistant/message", data: { turn, step, message, stream: [...stream.snapshot()] }, surfaceOp: "append" });
    }
    add({ type: "step/end", data: { turn, step } });
    add({ type: "turn/end", data: { turn, reason: { kind: "completed" } } });
  }
  time = input.createdAt;
  add({ type: "session/title", data: { title: input.title.trim() || "\u8FC1\u5165\u7684\u4F1A\u8BDD", messageSeqs: [], source: { kind: "user" } } });
  const session = Session.create(header.id, events, header, SessionLogOffset(0));
  return { header, events, expectedMessagesDigest: messageDigest(session.deriveMessages()), eventsDigest: digest(events) };
}

// src/mapping.ts
var MAPPING_VERSION = "2";
function refreshReport(plan) {
  const counts = { native: 0, rendered: 0, "archive-only": 0, missing: 0, blocked: 0 };
  for (const issue of plan.report.issues) counts[issue.disposition]++;
  plan.report.counts = counts;
  plan.report.reportHash = digest({ snapshot: plan.snapshotDigest, target: plan.target, messages: plan.messages, resources: plan.resources, issues: plan.report.issues, mappingVersion: MAPPING_VERSION });
}
async function buildMigrationPlan(archivePath, target2, limits = { maxTextBytes: 32 * 1024 ** 2, maxMessages: 5e4 }) {
  await validateArchive(archivePath);
  const manifest = await readManifest(archivePath);
  const plan = {
    archivePath,
    snapshotDigest: await archiveDigest(archivePath),
    sourceApp: manifest.source.app,
    title: manifest.session.title || "\u8FC1\u5165\u7684\u4F1A\u8BDD",
    createdAt: Date.parse(manifest.captured_at),
    target: target2,
    messages: [],
    resources: manifest.resources,
    report: { mappingVersion: MAPPING_VERSION, issues: [], counts: { native: 0, rendered: 0, "archive-only": 0, missing: 0, blocked: 0 }, reportHash: "" }
  };
  const issue = (disposition, code, detail, event, resourceId) => plan.report.issues.push({ disposition, code, detail, ...event ? { recordRef: event.record_ref } : {}, ...resourceId ? { resourceId } : {} });
  for (const item of manifest.issues) {
    const gap = ["missing_dialogue_history", "unresolved_history", "external_history_base"].includes(item.code) && item.detail !== "Source compaction has not been reconstructed";
    issue(item.code === "dsh_surface_rewrite" ? "blocked" : gap ? "missing" : "archive-only", item.code, item.detail);
  }
  let bytes = 0;
  const add = (message) => {
    bytes += message.content.reduce((n, b) => n + (b.type === "text" ? Buffer.byteLength(b.text) : 0), 0);
    if (bytes > limits.maxTextBytes || plan.messages.length >= limits.maxMessages) throw new LinkError("CONTENT_LIMIT", "\u4F1A\u8BDD\u8D85\u8FC7\u672C\u6B21\u8FC1\u79FB\u5BB9\u91CF\u9650\u5236\uFF0C\u672A\u622A\u65AD\u6B63\u6587");
    plan.messages.push(message);
  };
  const used = /* @__PURE__ */ new Set();
  for await (const e of readJsonl(path2.join(archivePath, "events.jsonl"), { lossless: true })) {
    if (e.active === false || e.visible === false || e.projection === "auxiliary") {
      issue("archive-only", "inactive_or_auxiliary", "\u4EC5\u4FDD\u5B58\u539F\u8BB0\u5F55", e);
      continue;
    }
    const timestamp = typeof e.timestamp === "number" ? e.timestamp : typeof e.timestamp === "string" ? Date.parse(e.timestamp) : void 0;
    const time = timestamp !== void 0 && Number.isSafeInteger(timestamp) && timestamp >= 0 ? { timestamp } : {};
    if (e.kind !== "message" || !["user", "assistant"].includes(e.role ?? "")) {
      issue("archive-only", "non_dialogue", "\u975E\u5BF9\u8BDD\u8BB0\u5F55\u4EC5\u4FDD\u7559\u5728\u5BFC\u51FA\u5305\u4E2D", e);
      continue;
    }
    const content = [];
    for (const block of e.content) {
      if (block.type === "text") {
        const text2 = dialogueText(e.role, String(block.text ?? ""));
        if (text2 !== void 0) content.push({ type: "text", text: text2 });
        else issue("archive-only", "harness_context", "\u6765\u6E90\u73AF\u5883\u4E0E\u89C4\u5219\u4E0D\u5199\u5165\u5BF9\u8BDD", e);
      } else if (block.type === "resource") {
        const resource = manifest.resources.find((r) => r.id === block.resource_id);
        if (e.role === "user" && resource.status === "embedded") {
          used.add(resource.id);
          content.push({ type: "resource", resourceId: resource.id });
          issue("native", "attachment", "\u4FDD\u7559\u7528\u6237\u6D88\u606F\u4E2D\u7684\u9644\u4EF6", e, resource.id);
        } else issue("archive-only", "unmapped_resource", "\u9644\u4EF6\u4FDD\u7559\u5728\u5BFC\u51FA\u5305\u4E2D", e, resource.id);
      } else issue("archive-only", "unsupported_block", "\u975E\u5BF9\u8BDD\u5185\u5BB9\u5757\u4EC5\u4FDD\u7559\u5728\u5BFC\u51FA\u5305\u4E2D", e);
    }
    if (content.length) {
      add({ role: e.role, content, recordRef: e.record_ref, presentation: "conversation", ...time });
      issue("native", "message", "\u4FDD\u7559\u5BF9\u8BDD\u6B63\u6587", e);
    }
  }
  for (const resource of manifest.resources) if (!used.has(resource.id)) issue("archive-only", "unmapped_resource", "\u672A\u5173\u8054\u5230\u6D3B\u52A8\u6D88\u606F\u7684\u8D44\u6E90\u4FDD\u7559\u5728\u5907\u4EFD", void 0, resource.id);
  if (plan.messages.length) issue("rendered", "reconstructed_history", "DSH \u7684\u8F6E\u6B21\u4E0E\u6D41\u5F0F\u5C55\u793A\u7531\u5BFC\u5165\u6D88\u606F\u91CD\u5EFA\uFF0C\u4E0D\u4EE3\u8868\u6765\u6E90\u4E2D\u7684\u539F\u751F\u6267\u884C\u4E8B\u4EF6");
  if (!plan.messages.length) issue("blocked", "empty_history", "\u6CA1\u6709\u53EF\u8FC1\u5165\u7684\u6D3B\u52A8\u6D88\u606F");
  refreshReport(plan);
  return plan;
}
async function freezeHistory(plan, targetSessionId, resources) {
  if (plan.report.mappingVersion !== MAPPING_VERSION) throw new LinkError("MAPPING_CHANGED");
  if (plan.report.counts.blocked) throw new LinkError("HISTORY_BLOCKED", "\u6765\u6E90\u4E0A\u4E0B\u6587\u4E0D\u5B8C\u6574\uFF0C\u4E0D\u80FD\u8FC1\u5165\u4E3A\u53EF\u7EE7\u7EED\u4F1A\u8BDD");
  return createImportedHistory({
    id: targetSessionId,
    cwd: plan.target.cwd,
    agentPreset: plan.target.agentPreset,
    title: plan.title,
    createdAt: plan.createdAt,
    messages: plan.messages.map((m) => ({ role: m.role, text: "", timestamp: m.timestamp, content: m.content.map((b) => {
      if (b.type === "text") return b;
      if (!resources[b.resourceId]) throw new LinkError("RESOURCE_NOT_ADMITTED");
      return resources[b.resourceId];
    }) }))
  });
}

// src/dsh/attachments.ts
import { createReadStream as createReadStream3 } from "node:fs";
import { readFile as readFile2 } from "node:fs/promises";
import path3 from "node:path";
import { createHash as createHash3 } from "node:crypto";
function imageType(resource) {
  const mime = resource.media_type ?? { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" }[path3.extname(resource.uri).toLowerCase()];
  return ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime ?? "") ? mime : void 0;
}
function usedResources(plan) {
  return new Set(plan.messages.flatMap((m) => m.content.flatMap((b) => b.type === "resource" ? [b.resourceId] : [])));
}
function name(resource) {
  return path3.basename(resource.uri.startsWith("sha256:") ? resource.id : resource.uri).replace(/[\\/]/g, "_");
}
async function imageInput(plan, resource, store) {
  if (resource.size > store.imageLimits.maxImageBytes) throw new LinkError("IMAGE_NOT_ADMITTED", "Image exceeds target limit");
  const data = await readFile2(path3.join(plan.archivePath, resource.path));
  if (createHash3("sha256").update(data).digest("hex") !== resource.sha256) throw new LinkError("RESOURCE_CHANGED");
  return { data, mediaType: imageType(resource), name: name(resource) };
}
async function validatePlannedImages(plan, store) {
  const used = usedResources(plan);
  for (const resource of plan.resources) {
    if (!used.has(resource.id) || !imageType(resource)) continue;
    try {
      await store.validateImage(await imageInput(plan, resource, store));
    } catch (error) {
      if (error instanceof LinkError && error.code !== "IMAGE_NOT_ADMITTED") throw error;
      if (!(error instanceof LinkError) && !store.isAttachmentError(error)) throw error;
      for (const m of plan.messages) m.content = m.content.filter((b) => b.type !== "resource" || b.resourceId !== resource.id);
      plan.report.issues = plan.report.issues.filter((i) => !(i.resourceId === resource.id && i.code === "attachment"));
      plan.report.issues.push({ code: "image_not_admitted", disposition: "archive-only", resourceId: resource.id, detail: "\u76EE\u6807\u56FE\u7247\u9650\u5236\u6216\u7F16\u7801\u6821\u9A8C\u672A\u901A\u8FC7\uFF0C\u539F\u56FE\u4FDD\u7559\u5728\u5907\u4EFD\u4E2D" });
    }
  }
  for (const message of plan.messages) {
    let count = 0, bytes = 0;
    message.content = message.content.filter((block) => {
      if (block.type !== "resource") return true;
      const resource = plan.resources.find((r) => r.id === block.resourceId);
      if (!imageType(resource)) return true;
      if (count >= store.imageLimits.maxImagesPerMessage || bytes + resource.size > store.imageLimits.maxMessageImageBytes) {
        const existing = plan.report.issues.findLastIndex((i) => i.code === "attachment" && i.resourceId === resource.id && i.recordRef === message.recordRef);
        if (existing >= 0) plan.report.issues.splice(existing, 1);
        plan.report.issues.push({ code: "message_image_limit", disposition: "archive-only", recordRef: message.recordRef, resourceId: resource.id, detail: "\u8D85\u8FC7\u76EE\u6807\u5355\u6761\u6D88\u606F\u56FE\u7247\u4E0A\u9650\uFF0C\u539F\u56FE\u4FDD\u7559\u5728\u5907\u4EFD\u4E2D" });
        return false;
      }
      count++;
      bytes += resource.size;
      return true;
    });
  }
  plan.messages = plan.messages.filter((message) => message.content.length > 0);
  if (!plan.messages.length && !plan.report.issues.some((i) => i.code === "empty_history")) plan.report.issues.push({ code: "empty_history", disposition: "blocked", detail: "\u6CA1\u6709\u53EF\u8FC1\u5165\u7684\u5BF9\u8BDD\u5185\u5BB9" });
  refreshReport(plan);
}
async function admitResources(plan, store, signal) {
  const result = {}, used = usedResources(plan);
  for (const resource of plan.resources) {
    if (!used.has(resource.id)) continue;
    signal?.throwIfAborted();
    if (imageType(resource)) result[resource.id] = { type: "image", attachment: await store.saveImage(await imageInput(plan, resource, store)) };
    else {
      const hash = createHash3("sha256");
      const data = async function* () {
        for await (const chunk of createReadStream3(path3.join(plan.archivePath, resource.path), { signal })) {
          hash.update(chunk);
          yield chunk;
        }
      };
      const attachment = await store.saveFileStream({ data: data(), signal, name: name(resource) });
      if (hash.digest("hex") !== resource.sha256 || attachment.bytes !== resource.size) throw new LinkError("RESOURCE_CHANGED");
      result[resource.id] = { type: "file", attachment };
    }
  }
  return result;
}

// src/dsh/persistence.ts
import { Session as Session2 } from "@deepseek-ai/dsh-session";
async function verifyHistory(store, history, signal) {
  const handle = await store.open(history.header.id, "read", { signal });
  try {
    const read = await handle.read(0, void 0, { signal });
    if (digest(read.events.slice(0, history.events.length)) !== history.eventsDigest) throw new Error("HISTORY_MISMATCH");
    if (handle.header.cwd !== history.header.cwd || handle.header.agentPreset !== history.header.agentPreset) throw new Error("TARGET_MISMATCH");
    const session = Session2.fromRestore(handle.id, read.events.slice(0, history.events.length), handle.header, handle.inheritedEventCount, read.eventState);
    if (messageDigest(session.deriveMessages()) !== history.expectedMessagesDigest) throw new Error("MESSAGES_MISMATCH");
  } finally {
    await handle.close();
  }
}

// src/sources/types.ts
import { createHash as createHash4 } from "node:crypto";
import path4 from "node:path";
function sourceKey(app, root, id2) {
  return app + ":" + createHash4("sha256").update(path4.resolve(root) + "\0" + id2).digest("hex").slice(0, 32);
}

// src/sources/dsh-legacy.ts
import { createReadStream as createReadStream4 } from "node:fs";
import { createZstdDecompress } from "node:zlib";
async function* legacyRows(file, signal) {
  if (!file.endsWith(".zstd")) {
    yield* readJsonl(file, { signal, lossless: true });
    return;
  }
  const input = createReadStream4(file, { signal }), decoder = createZstdDecompress();
  input.on("error", (error) => decoder.destroy(error));
  input.pipe(decoder);
  try {
    yield* readJsonStream(decoder, { signal, lossless: true });
  } finally {
    input.destroy();
    decoder.destroy();
  }
}

// src/operations.ts
async function atomicJson(file, value) {
  const temp = file + "." + randomUUID3() + ".tmp";
  const handle = await open2(temp, "wx", 384);
  try {
    await handle.writeFile(JSON.stringify(value));
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename2(temp, file);
  const directory = await open2(path5.dirname(file), "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
var MigrationService = class _MigrationService {
  constructor(options) {
    this.options = options;
    this.ledger = new Ledger(path5.join(options.directory, "operations.sqlite"));
  }
  ledger;
  jobs = /* @__PURE__ */ new Map();
  accepting = true;
  inspections = /* @__PURE__ */ new Map();
  exports = /* @__PURE__ */ new Map();
  static async create(options) {
    for (const folder of ["", "snapshots", "operations", "uploads", "exports"]) await mkdir2(path5.join(options.directory, folder), { recursive: true, mode: 448 });
    const service = new _MigrationService(options);
    service.ledger.reconcile();
    return service;
  }
  ready() {
    if (!this.accepting) throw new LinkError("PLUGIN_CLOSED");
  }
  sources() {
    this.ready();
    return this.options.worker.run({ kind: "sources", roots: this.options.roots });
  }
  sessions(app, query) {
    this.ready();
    return this.options.worker.run({ kind: "sessions", roots: this.options.roots, app, query });
  }
  async upload(sourceId2) {
    if (!sourceId2.startsWith("upload:")) return void 0;
    const id2 = sourceId2.slice(7);
    if (!/^[a-f0-9-]{36}$/.test(id2)) throw new LinkError("INVALID_SOURCE");
    try {
      return JSON.parse(await readFile3(path5.join(this.options.directory, "uploads", id2, "source.json"), "utf8"));
    } catch {
      throw new LinkError("INVALID_SOURCE");
    }
  }
  async source(sourceId2, signal) {
    const upload = await this.upload(sourceId2);
    return this.options.worker.run({ kind: "active", roots: this.options.roots, sourceId: upload?.nativeSourceId ?? sourceId2 }, signal);
  }
  async captureSource(sourceId2, destination, signal) {
    this.ready();
    await this.source(sourceId2, signal);
    const upload = await this.upload(sourceId2);
    const result = upload ? await this.options.worker.run({ kind: "import", path: upload.archivePath, destination }, signal) : await this.options.worker.run({ kind: "capture", roots: this.options.roots, resourceRoots: this.options.resourceRoots, sourceId: sourceId2, destination }, signal);
    await this.source(sourceId2, signal);
    return result;
  }
  async inspect(sourceId2, signal) {
    this.ready();
    const source = await this.source(sourceId2, signal), id2 = randomUUID3();
    const destination = path5.join(this.options.directory, "snapshots", "inspect-" + id2);
    try {
      const capture = await this.captureSource(sourceId2, destination, signal);
      const plan = await buildMigrationPlan(capture.archivePath, { cwd: source.cwd || "", agentPreset: "" }, this.options.limits);
      signal?.throwIfAborted();
      this.ready();
      this.inspections.set(id2, conversationMessages(plan));
      while (this.inspections.size > 3) this.inspections.delete(this.inspections.keys().next().value);
      return { title: source.title, ...this.inspectionPage(id2) };
    } finally {
      await rm2(destination, { recursive: true, force: true });
    }
  }
  inspectionPage(id2, offset = 0) {
    const messages = this.inspections.get(id2);
    if (!messages) throw new LinkError("PREVIEW_NOT_FOUND");
    if (!Number.isSafeInteger(offset) || offset < 0) throw new LinkError("INVALID_QUERY");
    this.inspections.delete(id2);
    this.inspections.set(id2, messages);
    return { inspectionId: id2, total: messages.length, offset, items: messages.slice(offset, offset + 80).map((message) => ({
      ...message,
      content: message.content.map((block) => block.text.length > 2e4 ? { ...block, text: block.text.slice(0, 2e4) + "\n\u2026\uFF08\u4EC5\u5C55\u793A\u622A\u65AD\uFF0C\u8FC1\u5165\u4FDD\u7559\u5B8C\u6574\u5185\u5BB9\uFF09" } : block)
    })) };
  }
  async preview(sourceId2, target2, signal) {
    this.ready();
    const resolved = await this.options.resolveTarget(target2);
    let cwd;
    try {
      cwd = await realpath2(resolved.cwd);
      if (!(await stat2(cwd)).isDirectory()) throw new LinkError("INVALID_TARGET");
    } catch (error) {
      if (error instanceof LinkError) throw error;
      throw new LinkError("INVALID_TARGET");
    }
    await this.source(sourceId2, signal);
    const previewId = randomUUID3(), destination = path5.join(this.options.directory, "snapshots", previewId);
    try {
      const captured = await this.captureSource(sourceId2, destination, signal);
      const plan = await buildMigrationPlan(captured.archivePath, { cwd, agentPreset: resolved.agentPreset }, this.options.limits);
      await validatePlannedImages(plan, this.options.attachments);
      this.ready();
      const preview = { previewId, snapshotDigest: captured.snapshotDigest, target: plan.target, report: plan.report };
      this.ledger.savePreview(previewId, { preview, plan, sourceId: sourceId2 });
      return preview;
    } catch (error) {
      await rm2(destination, { recursive: true, force: true });
      throw error;
    }
  }
  stored(id2) {
    const value = this.ledger.preview(id2);
    if (!value) throw new LinkError("PREVIEW_NOT_FOUND");
    return value;
  }
  previewPage(id2, offset = 0) {
    const stored = this.stored(id2), { plan } = stored;
    if (!Number.isSafeInteger(offset) || offset < 0) throw new LinkError("INVALID_QUERY");
    const messages = conversationMessages(plan);
    return { ...offset === 0 ? { preview: stored.preview } : {}, total: messages.length, offset, items: messages.slice(offset, offset + 80).map((m) => ({
      ...m,
      content: m.content.map((b) => b.type === "text" && b.text.length > 2e4 ? { type: "text", text: b.text.slice(0, 2e4) + "\n\u2026\uFF08\u4EC5\u9884\u89C8\u622A\u65AD\uFF0C\u8FC1\u5165\u4FDD\u7559\u5B8C\u6574\u5185\u5BB9\uFF09" } : b)
    })) };
  }
  async commit(request) {
    this.ready();
    const value = this.stored(request.previewId);
    if (value.plan.report.mappingVersion !== MAPPING_VERSION) throw new LinkError("MAPPING_CHANGED");
    if (request.reportHash !== value.preview.report.reportHash) throw new LinkError("PREVIEW_CHANGED");
    if (value.preview.report.counts.blocked) throw new LinkError("HISTORY_BLOCKED");
    if (!request.requestId || request.requestId.length > 128) throw new LinkError("INVALID_REQUEST");
    await this.source(value.sourceId);
    const target2 = await this.options.resolveTarget(value.plan.target);
    if (await realpath2(target2.cwd) !== value.plan.target.cwd || target2.agentPreset !== value.plan.target.agentPreset) throw new LinkError("TARGET_CHANGED");
    const key = digest({ snapshot: value.plan.snapshotDigest, target: value.plan.target, mapping: MAPPING_VERSION, namespace: this.options.namespace });
    const operation = this.ledger.reserve(request.previewId, key, request.requestId, value.plan.title);
    if (operation.state === "completed") {
      if (!await this.options.store.stat(SessionId2(operation.targetSessionId))) throw new LinkError("TARGET_MISSING");
      return operation;
    }
    if (!this.jobs.has(operation.operationId)) {
      operation.state = "prepared";
      operation.stage = "queued";
      delete operation.errorCode;
      const controller = new AbortController();
      const job = { operation, controller, promise: Promise.resolve() };
      this.jobs.set(operation.operationId, job);
      job.promise = Promise.resolve().then(() => this.run(operation, this.stored(operation.previewId), controller.signal)).finally(() => this.jobs.delete(operation.operationId));
    }
    return { ...this.jobs.get(operation.operationId).operation };
  }
  async run(operation, saved, signal) {
    let touched = false;
    try {
      if (saved.plan.report.mappingVersion !== MAPPING_VERSION) throw new LinkError("MAPPING_CHANGED");
      await this.ledger.withWriter(async () => {
        try {
          const directory = path5.join(this.options.directory, "operations", operation.operationId);
          await mkdir2(directory, { recursive: true, mode: 448 });
          const historyFile = path5.join(directory, "history.json");
          touched = !!await this.options.store.stat(SessionId2(operation.targetSessionId));
          operation.state = "writing";
          operation.stage = "checking-source";
          delete operation.errorCode;
          await this.source(saved.sourceId, signal);
          await this.options.worker.run({ kind: "validate", path: saved.plan.archivePath }, signal);
          if (await archiveDigest(saved.plan.archivePath) !== saved.plan.snapshotDigest) throw new LinkError("SNAPSHOT_CHANGED");
          let history;
          try {
            history = JSON.parse(await readFile3(historyFile, "utf8"));
          } catch (error) {
            if (error.code !== "ENOENT" || touched) throw new LinkError("HISTORY_MISSING");
            operation.stage = "attachments";
            const resources = await admitResources(saved.plan, this.options.attachments, signal);
            history = await freezeHistory(saved.plan, operation.targetSessionId, resources);
            await atomicJson(historyFile, history);
          }
          if (digest(history.events) !== history.eventsDigest || history.header.id !== operation.targetSessionId || history.header.cwd !== saved.plan.target.cwd || history.header.agentPreset !== saved.plan.target.agentPreset) throw new LinkError("HISTORY_CHANGED");
          await this.source(saved.sourceId, signal);
          signal.throwIfAborted();
          operation.stage = "persisting";
          const exists = await this.options.store.stat(history.header.id);
          const handle = exists ? await this.options.store.open(history.header.id, "write", { signal }) : await this.options.store.create(history.header, { signal });
          touched = true;
          try {
            if (handle.header.cwd !== history.header.cwd || handle.header.agentPreset !== history.header.agentPreset || handle.header.createdAt !== history.header.createdAt || handle.header.isSeeded !== false || handle.header.version !== history.header.version) throw new LinkError("TARGET_CHANGED");
            const { events } = await handle.read();
            if (events.length > history.events.length || digest(events) !== digest(history.events.slice(0, events.length))) throw new LinkError("TARGET_CHANGED");
            for (let offset = events.length; offset < history.events.length; offset += 1e3) {
              signal.throwIfAborted();
              await handle.append(history.events.slice(offset, offset + 1e3), { signal });
            }
            await handle.flush({ signal });
          } finally {
            await handle.close();
          }
          operation.state = "verifying";
          operation.stage = "verifying";
          await verifyHistory(this.options.store, history, signal);
          await this.options.attach(history.header.cwd, history.header.id);
          operation.state = "completed";
          operation.stage = "complete";
          delete operation.errorCode;
        } catch (error) {
          operation.state = touched ? "needs-attention" : signal.aborted ? "canceled" : "failed";
          operation.stage = operation.state;
          operation.errorCode = error instanceof LinkError ? error.code : error instanceof Error && error.name === "SessionAlreadyOwnedError" ? "TARGET_BUSY" : signal.aborted ? "CANCELED" : "IMPORT_FAILED";
        }
        this.ledger.update(operation);
      });
    } catch (error) {
      operation.state = "needs-attention";
      operation.stage = "retry";
      operation.errorCode = error instanceof LinkError ? error.code : "IMPORT_FAILED";
    }
  }
  operation(id2) {
    this.ledger.reconcile(new Set(this.jobs.keys()));
    const op = this.jobs.get(id2)?.operation ?? this.ledger.operation(id2);
    if (!op) throw new LinkError("OPERATION_NOT_FOUND");
    return { ...op, outdated: this.stored(op.previewId).plan.report.mappingVersion !== MAPPING_VERSION };
  }
  operations() {
    this.ledger.reconcile(new Set(this.jobs.keys()));
    return this.ledger.operations().map((op) => this.operation(op.operationId));
  }
  async wait(id2, signal) {
    const abort = () => this.cancel(id2);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      if (signal?.aborted) abort();
      await this.jobs.get(id2)?.promise;
      return this.operation(id2);
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  }
  async retryOperation(id2) {
    const op = this.operation(id2), saved = this.stored(op.previewId);
    if (this.jobs.has(id2)) throw new LinkError("IMPORT_BUSY");
    const preview = saved.plan.report.mappingVersion === MAPPING_VERSION ? saved.preview : await this.preview((await this.upload(saved.sourceId))?.nativeSourceId ?? saved.sourceId, saved.plan.target);
    return this.commit({ previewId: preview.previewId, reportHash: preview.report.reportHash, requestId: randomUUID3() });
  }
  removeOperation(id2) {
    const operation = this.operation(id2);
    if (this.jobs.has(id2) || ["prepared", "writing", "verifying"].includes(operation.state)) throw new LinkError("IMPORT_BUSY");
    this.ledger.hide(id2);
  }
  cancel(id2) {
    const active = this.jobs.get(id2);
    if (active) active.controller.abort();
    return this.operation(id2);
  }
  async download(id2) {
    if (this.exports.has(id2)) return this.exports.get(id2);
    const operation = this.operation(id2), saved = this.stored(operation.previewId);
    const destination = path5.join(this.options.directory, "exports", operation.operationId + ".alink.zip");
    const pending = (async () => {
      if (await stat2(destination).catch(() => void 0)) return destination;
      const temporary = destination + "." + randomUUID3() + ".tmp";
      try {
        await this.options.worker.run({ kind: "export", path: saved.plan.archivePath, destination: temporary });
        await rename2(temporary, destination);
        return destination;
      } finally {
        await rm2(temporary, { force: true });
      }
    })();
    this.exports.set(id2, pending);
    try {
      return await pending;
    } finally {
      this.exports.delete(id2);
    }
  }
  async registerFiles(input, format, signal) {
    if (format === "dsh") return { sources: [await this.registerFile(input, format, signal)], errors: [] };
    this.ready();
    const staging = path5.join(this.options.directory, "uploads", "bundle-" + randomUUID3());
    await mkdir2(staging, { mode: 448 });
    const sources = [], errors = [];
    try {
      const captures = await this.options.worker.run({ kind: "import-many", path: input, destination: path5.join(staging, "archive") }, signal);
      for (const capture of captures) {
        signal?.throwIfAborted();
        const id2 = randomUUID3(), directory = path5.join(this.options.directory, "uploads", id2);
        try {
          const meta = await readManifest(capture.archivePath), root = this.options.roots[meta.source.app];
          if (!root || !meta.session.native_id) throw new LinkError("SOURCE_INACTIVE");
          const nativeSourceId = sourceKey(meta.source.app, root, meta.session.native_id), native = await this.source(nativeSourceId, signal);
          await mkdir2(directory, { mode: 448 });
          const archivePath = path5.join(directory, "archive");
          await rename2(capture.archivePath, archivePath);
          await atomicJson(path5.join(directory, "source.json"), { nativeSourceId, archivePath, title: meta.session.title ?? native.title });
          sources.push({ sourceId: "upload:" + id2, app: native.app, nativeId: native.nativeId, title: meta.session.title ?? native.title, cwd: meta.session.cwd });
        } catch (error) {
          await rm2(directory, { recursive: true, force: true });
          errors.push(error instanceof LinkError ? error.code : "SOURCE_ERROR");
        }
      }
      if (!sources.length) throw new LinkError(errors[0] || "INVALID_SOURCE");
      return { sources, errors };
    } finally {
      await rm2(staging, { recursive: true, force: true });
    }
  }
  async registerFile(input, format, signal) {
    this.ready();
    const id2 = randomUUID3(), directory = path5.join(this.options.directory, "uploads", id2);
    await mkdir2(directory, { mode: 448 });
    try {
      let capture, nativeSourceId;
      if (format === "alink") {
        capture = await this.options.worker.run({ kind: "import", path: input, destination: path5.join(directory, "archive") }, signal);
        const manifest = await readManifest(capture.archivePath), root = this.options.roots[manifest.source.app];
        if (!root || !manifest.session.native_id) throw new LinkError("SOURCE_INACTIVE");
        nativeSourceId = sourceKey(manifest.source.app, root, manifest.session.native_id);
      } else {
        let header;
        for await (const row of legacyRows(input, signal)) {
          header = row;
          break;
        }
        if (header?.version !== 0 || typeof header.id !== "string" || !this.options.roots.dsh) throw new LinkError("UNSUPPORTED_SOURCE");
        nativeSourceId = sourceKey("dsh", this.options.roots.dsh, header.id);
        capture = await this.options.worker.run({ kind: "legacy-file", roots: this.options.roots, sourceId: nativeSourceId, path: input, destination: path5.join(directory, "archive") }, signal);
      }
      const native = await this.options.worker.run({ kind: "active", roots: this.options.roots, sourceId: nativeSourceId }, signal);
      const meta = await readManifest(capture.archivePath);
      await atomicJson(path5.join(directory, "source.json"), { nativeSourceId, archivePath: capture.archivePath, title: meta.session.title ?? native.title });
      return { sourceId: "upload:" + id2, app: native.app, nativeId: native.nativeId, title: meta.session.title ?? native.title, cwd: meta.session.cwd };
    } catch (error) {
      await rm2(directory, { recursive: true, force: true });
      throw error;
    }
  }
  async close() {
    if (!this.accepting) return;
    this.accepting = false;
    for (const job of this.jobs.values()) job.controller.abort();
    await Promise.allSettled([...this.jobs.values()].map((j) => j.promise));
    await this.options.worker.close();
    this.inspections.clear();
    this.ledger.close();
  }
};

// src/transfers.ts
var unfinished = (job) => ["queued", "running"].includes(job.state);
var codeOf = (error) => error instanceof LinkError ? error.code : "IMPORT_FAILED";
var Transfers = class _Transfers {
  constructor(directory, service) {
    this.directory = directory;
    this.service = service;
  }
  values = /* @__PURE__ */ new Map();
  controllers = /* @__PURE__ */ new Map();
  tail = Promise.resolve();
  closed = false;
  static async create(directory, service) {
    await mkdir3(directory, { recursive: true, mode: 448 });
    const transfers = new _Transfers(directory, service);
    for (const name3 of await readdir2(directory)) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name3)) continue;
      const value = JSON.parse(await readFile4(path6.join(directory, name3), "utf8"));
      if (unfinished(value)) {
        value.state = "failed";
        value.errorCode = "INTERRUPTED";
        for (const item of value.items) if (["pending", "running"].includes(item.state)) {
          item.state = "failed";
          item.errorCode = "INTERRUPTED";
        }
        await transfers.save(value);
      }
      transfers.values.set(value.id, value);
    }
    return transfers;
  }
  save(value) {
    return atomicJson(path6.join(this.directory, value.id + ".json"), value);
  }
  public(value) {
    const { request: _request, requestHash: _hash, archives: _archives, previews: _previews, ...result } = value;
    return structuredClone(result);
  }
  list() {
    return [...this.values.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 100).map((value) => this.public(value));
  }
  get(id2) {
    return this.public(this.stored(id2));
  }
  stored(id2) {
    const value = this.values.get(id2);
    if (!value) throw new LinkError("TRANSFER_NOT_FOUND");
    return value;
  }
  async start(request) {
    if (this.closed) throw new LinkError("PLUGIN_CLOSED");
    const requestHash = digest(request), existing = this.values.get(request.requestId);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new LinkError("REQUEST_CONFLICT");
      return this.public(existing);
    }
    const value = {
      id: request.requestId,
      kind: request.kind,
      state: "queued",
      createdAt: Date.now(),
      request,
      requestHash,
      archives: {},
      previews: {},
      items: [...new Set(request.sourceIds)].map((sourceId2) => ({ sourceId: sourceId2, title: request.titles && Object.hasOwn(request.titles, sourceId2) ? request.titles[sourceId2] : "", state: "pending" }))
    };
    this.values.set(value.id, value);
    try {
      await this.save(value);
    } catch (error) {
      this.values.delete(value.id);
      throw error;
    }
    this.enqueue(value);
    return this.public(value);
  }
  enqueue(value) {
    const controller = new AbortController();
    this.controllers.set(value.id, controller);
    this.tail = this.tail.then(() => this.run(value, controller.signal)).finally(() => this.controllers.delete(value.id));
    this.tail = this.tail.catch(() => {
      value.state = "failed";
      value.errorCode = "IMPORT_FAILED";
    });
  }
  async retry(id2) {
    if (this.closed) throw new LinkError("PLUGIN_CLOSED");
    const value = this.stored(id2);
    if (unfinished(value)) return this.public(value);
    for (const item of value.items) if (item.state !== "completed") {
      item.state = "pending";
      delete item.errorCode;
    }
    value.state = "queued";
    delete value.errorCode;
    value.downloadable = false;
    await this.save(value);
    this.enqueue(value);
    return this.public(value);
  }
  cancel(id2) {
    this.controllers.get(id2)?.abort();
    return this.get(id2);
  }
  async download(id2) {
    const value = this.stored(id2);
    if (value.kind !== "export" || !value.downloadable) throw new LinkError("EXPORT_NOT_READY");
    for (const item of value.items) if (item.state === "completed") await this.service.source(item.sourceId);
    const file = path6.join(this.directory, id2, "export.zip");
    await stat3(file);
    return file;
  }
  async run(value, signal) {
    const folder = path6.join(this.directory, value.id);
    try {
      await mkdir3(folder, { recursive: true, mode: 448 });
      value.state = "running";
      await this.save(value);
      for (const [index, item] of value.items.entries()) {
        if (item.state === "completed") continue;
        if (signal.aborted) {
          item.state = "canceled";
          continue;
        }
        item.state = "running";
        await this.save(value);
        try {
          const source = await this.service.source(item.sourceId, signal);
          item.title = source.title;
          if (value.kind === "import") {
            let operation;
            if (item.operationId) operation = await this.service.retryOperation(item.operationId);
            else {
              const target2 = value.request.target;
              if (!target2.cwd && !source.cwd) throw new LinkError("INVALID_TARGET");
              const savedId = value.previews[item.sourceId];
              const preview = savedId ? this.service.previewPage(savedId).preview : await this.service.preview(item.sourceId, { cwd: target2.cwd || source.cwd, agentPreset: target2.agentPreset }, signal);
              if (preview.report.counts.blocked) throw new LinkError("HISTORY_BLOCKED");
              if (preview.report.issues.some((issue) => ["missing_dialogue_history", "unresolved_history", "external_history_base"].includes(issue.code) && issue.disposition === "missing")) item.warning = "\u8F83\u65E9\u7684\u6765\u6E90\u8BB0\u5F55\u5DF2\u4E0D\u53EF\u7528\uFF0C\u5DF2\u8FC1\u5165\u5F53\u524D\u53EF\u8BFB\u53D6\u7684\u5BF9\u8BDD\u3002";
              value.previews[item.sourceId] = preview.previewId;
              await this.save(value);
              operation = await this.service.commit({ previewId: preview.previewId, reportHash: preview.report.reportHash, requestId: value.id + ":" + index });
            }
            item.operationId = operation.operationId;
            await this.save(value);
            operation = await this.service.wait(operation.operationId, signal);
            if (operation.state !== "completed") throw new LinkError(operation.errorCode || "IMPORT_FAILED");
          } else {
            const destination = path6.join(folder, "source-" + index);
            await rm3(destination, { recursive: true, force: true });
            const capture = await this.service.captureSource(item.sourceId, destination, signal);
            value.archives[item.sourceId] = capture.archivePath;
          }
          item.state = "completed";
          delete item.errorCode;
        } catch (error) {
          item.state = signal.aborted ? "canceled" : "failed";
          item.errorCode = signal.aborted ? "CANCELED" : codeOf(error);
        }
        await this.save(value);
      }
      if (value.kind === "export" && !signal.aborted) {
        for (const item of value.items) if (item.state === "completed") {
          try {
            await this.service.source(item.sourceId, signal);
          } catch (error) {
            item.state = "failed";
            item.errorCode = signal.aborted ? "CANCELED" : codeOf(error);
          }
        }
        const roots = value.items.filter((item) => item.state === "completed").map((item) => value.archives[item.sourceId]);
        if (roots.length) {
          const temporary = path6.join(folder, "export-" + randomUUID4() + ".tmp");
          try {
            await this.service.options.worker.run({ kind: "export-many", paths: roots, destination: temporary }, signal);
            await rename3(temporary, path6.join(folder, "export.zip"));
            value.downloadable = true;
          } finally {
            await rm3(temporary, { force: true });
          }
        }
      }
      const successes = value.items.filter((item) => item.state === "completed").length;
      value.state = signal.aborted ? "canceled" : successes === value.items.length ? "completed" : successes ? "partial" : "failed";
    } catch (error) {
      value.state = signal.aborted ? "canceled" : "failed";
      value.errorCode = codeOf(error);
    } finally {
      await this.save(value);
    }
  }
  async close() {
    this.closed = true;
    for (const controller of this.controllers.values()) controller.abort();
    await this.tail;
  }
};

// src/sources/worker-client.ts
import { Worker } from "node:worker_threads";
var WorkerRunner = class {
  constructor(file) {
    this.file = file;
  }
  active = /* @__PURE__ */ new Set();
  closed = false;
  run(task, signal) {
    if (this.closed) return Promise.reject(new Error("Worker runner is closed"));
    signal?.throwIfAborted();
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.file);
      this.active.add(worker);
      let settled = false;
      const finish = async (error, value) => {
        if (settled) return;
        settled = true;
        this.active.delete(worker);
        signal?.removeEventListener("abort", abort);
        await worker.terminate();
        if (error) reject(error);
        else resolve(value);
      };
      const abort = () => {
        void finish(new Error("Operation canceled"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      worker.once("message", (result) => {
        void finish(result.ok ? void 0 : new LinkError(result.code ?? "SOURCE_ERROR", result.error), result.value);
      });
      worker.once("error", (error) => {
        void finish(error);
      });
      worker.once("exit", () => {
        if (!settled) void finish(new Error("Worker stopped"));
      });
      worker.postMessage(task);
    });
  }
  async close() {
    this.closed = true;
    await Promise.all([...this.active].map((worker) => worker.terminate()));
  }
};

// src/sources/registry.ts
import path7 from "node:path";
import os from "node:os";

// src/sources/sqlite.ts
import { DatabaseSync as DatabaseSync2 } from "node:sqlite";

// src/sources/registry.ts
function defaultRoots() {
  const home = os.homedir();
  return {
    workbuddy: path7.join(home, ".workbuddy"),
    codex: path7.join(home, ".codex"),
    dsh: path7.join(home, ".dsh"),
    raccoon: path7.join(home, "Library/Application Support/office-raccoon"),
    cursor: path7.join(home, "Library/Application Support/Cursor")
  };
}

// src/dsh/workspace.ts
import { SessionId as SessionId3 } from "@deepseek-ai/dsh-session";
async function attachWorkspace(registry, cwd, sessionId) {
  const workspace = await registry.create(cwd);
  await workspace.attachSession(SessionId3(sessionId));
}

// src/config.ts
import Schema from "@deepseek-ai/schemastery";
var Config = Schema.object({
  dataDir: Schema.string(),
  sourceRoots: Schema.object({ workbuddy: Schema.string(), codex: Schema.string(), raccoon: Schema.string(), cursor: Schema.string(), dsh: Schema.string() }),
  resourceRoots: Schema.array(Schema.string()).default([]),
  maxTextBytes: Schema.number().min(1).step(1).default(32 * 1024 ** 2),
  maxMessages: Schema.number().min(1).step(1).default(5e4)
});

// src/index.ts
var name2 = "dsh-alink";
var inject = ["connection", "sessionPersistence", "attachments", "workspaceRegistry", "agentPresets"];
async function apply(ctx, config) {
  const directory = path8.resolve(config.dataDir || dshHomePath("storages", "dsh-alink"));
  const shutdown = new AbortController();
  const service = await MigrationService.create({
    directory,
    namespace: resolveDshHome(),
    roots: { ...defaultRoots(), ...Object.fromEntries(Object.entries(config.sourceRoots ?? {}).filter(([, value]) => typeof value === "string")) },
    resourceRoots: config.resourceRoots,
    limits: { maxTextBytes: config.maxTextBytes, maxMessages: config.maxMessages },
    worker: new WorkerRunner(new URL("./source-worker.js", import.meta.url)),
    store: ctx.sessionPersistence,
    attachments: ctx.attachments,
    async resolveTarget(target2) {
      const preset = await ctx.agentPresets.resolve(target2.agentPreset);
      if (preset.broken) throw new LinkError("PRESET_UNAVAILABLE");
      return { cwd: target2.cwd, agentPreset: preset.id };
    },
    attach: (cwd, id2) => attachWorkspace(ctx.workspaceRegistry, cwd, id2)
  });
  const transfers = await Transfers.create(path8.join(directory, "transfers"), service);
  const handler = makeRpcHandler(async (endpoint, payload, signal) => {
    const p = payload;
    switch (endpoint) {
      case "transfers":
        return transfers.list();
      case "transfer":
        return transfers.get(p.id);
      case "cancelTransfer":
        return transfers.cancel(p.id);
      case "retryTransfer":
        return transfers.retry(p.id);
      case "importMany":
        return transfers.start({ requestId: p.requestId, kind: "import", sourceIds: p.sourceIds, titles: p.titles, target: p.target });
      case "exportMany":
        return transfers.start({ requestId: p.requestId, kind: "export", sourceIds: p.sourceIds, titles: p.titles });
      case "retryOperation":
        return service.retryOperation(p.operationId);
      case "removeOperation":
        service.removeOperation(p.operationId);
        return { removed: true };
      case "registerFiles":
        return service.registerFiles(p.path, p.format, signal);
      case "sources":
        return service.sources();
      case "sessions":
        return service.sessions(p.app, { text: p.text, cursor: p.cursor, limit: p.limit });
      case "targets":
        return { workspaces: ctx.workspaceRegistry.list().map((w) => ({ id: w.id, path: w.path, title: w.title })), presets: await ctx.agentPresets.list(), defaultPreset: ctx.agentPresets.defaultId };
      case "inspect":
        return service.inspect(p.sourceId, signal);
      case "inspectionPage":
        return service.inspectionPage(p.inspectionId, p.offset);
      case "preview":
        return service.preview(p.sourceId, p.target, signal);
      case "previewPage":
        return service.previewPage(p.previewId, p.offset);
      case "commit":
        return service.commit({ previewId: p.previewId, reportHash: p.reportHash, requestId: p.requestId });
      case "operation":
        return service.operation(p.operationId);
      case "operations":
        return service.operations();
      case "cancel":
        return service.cancel(p.operationId);
      case "registerFile":
        return service.registerFile(p.path, p.format, signal);
      default:
        throw new LinkError("INVALID_REQUEST");
    }
  });
  const disposeRpc = ctx.connection.fetch.register({ path: "/api/dsh-alink.rpc", methods: ["POST"], requestBody: "buffered", async fetch(request) {
    try {
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > 1024 ** 2) throw new LinkError("REQUEST_LIMIT");
      const { endpoint, payload } = validateRequest(JSON.parse(Buffer.from(bytes).toString("utf8")));
      return Response.json(await handler(endpoint, payload, AbortSignal.any([request.signal, shutdown.signal]), ctx.connection.browserPeer));
    } catch (error) {
      return Response.json(errorResult(error), { status: 400 });
    }
  } });
  const disposeDownload = ctx.connection.fetch.register({ path: "/api/dsh-alink.archive", methods: ["GET", "HEAD"], requestBody: "buffered", async fetch(request) {
    try {
      const id2 = new URL(request.url).searchParams.get("operationId") ?? "";
      const file = await service.download(id2), info = await stat4(file);
      return new Response(request.method === "HEAD" ? null : Readable.toWeb(createReadStream5(file)), {
        headers: { "Content-Type": "application/zip", "Content-Length": String(info.size), "Content-Disposition": `attachment; filename="dsh-alink-${service.operation(id2).operationId}.alink.zip"`, "Cache-Control": "no-store" }
      });
    } catch (error) {
      return Response.json(errorResult(error), { status: 400 });
    }
  } });
  const disposeExport = ctx.connection.fetch.register({ path: "/api/dsh-alink.export", methods: ["GET", "HEAD"], requestBody: "buffered", async fetch(request) {
    try {
      const id2 = new URL(request.url).searchParams.get("id") ?? "";
      const file = await transfers.download(id2), info = await stat4(file);
      return new Response(request.method === "HEAD" ? null : Readable.toWeb(createReadStream5(file)), {
        headers: { "Content-Type": "application/zip", "Content-Length": String(info.size), "Content-Disposition": `attachment; filename="Alink-${id2}.zip"`, "Cache-Control": "no-store" }
      });
    } catch (error) {
      return Response.json(errorResult(error), { status: 400 });
    }
  } });
  const disposeUpload = ctx.connection.fetch.register({ path: "/api/dsh-alink.upload", methods: ["POST"], requestBody: "streaming", async fetch(request) {
    const temporary = path8.join(directory, "uploads", "incoming-" + randomUUID5());
    try {
      const query = new URL(request.url).searchParams, format = query.get("format");
      if (!request.body || !["alink", "dsh"].includes(format ?? "")) throw new LinkError("INVALID_REQUEST");
      const isZstd = (query.get("filename") ?? "").toLowerCase().endsWith(".zstd");
      const file = path8.join(temporary, format === "alink" ? "source.zip" : isZstd ? "session.jsonl.zstd" : "session.jsonl");
      await mkdir4(temporary, { mode: 448 });
      let total = 0;
      const signal = AbortSignal.any([request.signal, shutdown.signal]);
      await pipeline(Readable.fromWeb(request.body), new Transform({ transform(chunk, _encoding, callback) {
        total += chunk.length;
        callback(total > MAX_ARCHIVE_BYTES ? new LinkError("CONTENT_LIMIT") : null, chunk);
      } }), createWriteStream3(file, { flags: "wx", mode: 384 }), { signal });
      return Response.json({ ok: true, value: query.get("multiple") === "1" ? await service.registerFiles(file, format, signal) : await service.registerFile(file, format, signal) });
    } catch (error) {
      return Response.json(errorResult(error), { status: 400 });
    } finally {
      await rm4(temporary, { recursive: true, force: true });
    }
  } });
  ctx.effect(() => async () => {
    shutdown.abort();
    await Promise.all([disposeRpc(), disposeDownload(), disposeUpload(), disposeExport()]);
    await transfers.close();
    await service.close();
  });
}
export {
  Config,
  apply,
  inject,
  name2 as name
};
//# sourceMappingURL=index.js.map
