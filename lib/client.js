window.__ModuleLoader__.load({id:"dsh-alink",factory:function(require){var module={exports:{}};var exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/MigrationPanel.tsx
var import_react = require("react");

// src/client/api.ts
var errors = {
  SOURCE_HISTORY_MISSING: "\u6765\u6E90\u5386\u53F2\u65E5\u5FD7\u5C1A\u672A\u5B8C\u6574\u4FDD\u5B58\uFF0C\u8BF7\u5728\u539F\u5E94\u7528\u6253\u5F00\u8BE5\u4F1A\u8BDD\u540E\u91CD\u8BD5\u3002",
  MAPPING_CHANGED: "\u8FC1\u5165\u89C4\u5219\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u5BFC\u5165\u4EE5\u751F\u6210\u4EC5\u5305\u542B\u5BF9\u8BDD\u7684\u65B0\u4F1A\u8BDD\u3002",
  CANCELED: "\u4EFB\u52A1\u5DF2\u505C\u6B62\u3002",
  EXPORT_NOT_READY: "\u5BFC\u51FA\u6587\u4EF6\u5C1A\u672A\u51C6\u5907\u597D\u3002",
  TRANSFER_NOT_FOUND: "\u4EFB\u52A1\u8BB0\u5F55\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5237\u65B0\u3002",
  INTERRUPTED: "\u4E0A\u6B21\u8FC1\u79FB\u4E2D\u65AD\uFF0C\u539F\u76EE\u6807\u4F1A\u8BDD\u6807\u8BC6\u5DF2\u4FDD\u7559\u3002\u8BF7\u91CD\u65B0\u6838\u5BF9\u5E76\u91CD\u8BD5\u3002",
  SOURCE_INACTIVE: "\u539F\u4F1A\u8BDD\u5DF2\u5F52\u6863\u3001\u5220\u9664\u6216\u65E0\u6CD5\u6838\u5B9E\u5F53\u524D\u72B6\u6001\uFF0C\u4E0D\u80FD\u8FC1\u79FB\u3002\u8BF7\u5237\u65B0\u6765\u6E90\u3002",
  SOURCE_ERROR: "\u6765\u6E90\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002",
  PREVIEW_CHANGED: "\u9884\u89C8\u5DF2\u6539\u53D8\uFF0C\u8BF7\u91CD\u65B0\u751F\u6210\u8FC1\u79FB\u9884\u89C8\u3002",
  SNAPSHOT_CHANGED: "\u5907\u4EFD\u5185\u5BB9\u53D1\u751F\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u751F\u6210\u9884\u89C8\u3002",
  HISTORY_BLOCKED: "\u6765\u6E90\u5386\u53F2\u5B58\u5728\u5C1A\u672A\u89E3\u51B3\u7684\u7F3A\u53E3\uFF0C\u4E0D\u80FD\u4F5C\u4E3A\u53EF\u7EE7\u7EED\u4F1A\u8BDD\u5BFC\u5165\u3002",
  CONTENT_LIMIT: "\u5185\u5BB9\u8D85\u8FC7\u672C\u6B21\u8FC1\u79FB\u5BB9\u91CF\u9650\u5236\uFF0C\u672A\u622A\u65AD\u6B63\u6587\u3002",
  TARGET_BUSY: "\u76EE\u6807\u4F1A\u8BDD\u6B63\u5728\u4F7F\u7528\uFF0C\u8BF7\u5207\u6362\u5230\u5176\u4ED6\u4F1A\u8BDD\u540E\u91CD\u8BD5\u3002",
  IMPORT_BUSY: "\u53E6\u4E00\u4E2A\u8FC1\u79FB\u6B63\u5728\u5199\u5165\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
  TARGET_CHANGED: "\u76EE\u6807\u4F1A\u8BDD\u6216\u9879\u76EE\u5DF2\u6539\u53D8\uFF0C\u8BF7\u68C0\u67E5\u73B0\u6709\u8BB0\u5F55\u3002",
  TARGET_MISSING: "\u539F\u8FC1\u5165\u4F1A\u8BDD\u5DF2\u4E0D\u5B58\u5728\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u91CD\u5EFA\u3002",
  PRESET_UNAVAILABLE: "\u6240\u9009 DSH \u914D\u7F6E\u4E0D\u53EF\u7528\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002",
  INVALID_TARGET: "\u76EE\u6807\u9879\u76EE\u76EE\u5F55\u4E0D\u5B58\u5728\u6216\u4E0D\u53EF\u7528\u3002",
  FORBIDDEN: "\u53EA\u6709 DSH \u5BBF\u4E3B\u6240\u6709\u8005\u53EF\u4EE5\u8FC1\u79FB\u4F1A\u8BDD\u3002",
  PLUGIN_CLOSED: "\u8FC1\u79FB\u63D2\u4EF6\u5DF2\u505C\u7528\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u3002",
  IMPORT_FAILED: "\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u68C0\u67E5\u8FC1\u79FB\u8BB0\u5F55\u540E\u91CD\u8BD5\u3002",
  UNSUPPORTED_SOURCE: "\u8BE5\u6765\u6E90\u683C\u5F0F\u6216\u7248\u672C\u5C1A\u672A\u652F\u6301\u3002",
  INVALID_SOURCE: "\u6765\u6E90\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002",
  REQUEST_CONFLICT: "\u64CD\u4F5C\u6807\u8BC6\u53D1\u751F\u51B2\u7A81\uFF0C\u8BF7\u91CD\u65B0\u751F\u6210\u9884\u89C8\u3002",
  HISTORY_CHANGED: "\u5DF2\u51C6\u5907\u7684\u76EE\u6807\u5386\u53F2\u53D1\u751F\u53D8\u5316\uFF0C\u9700\u8981\u4EBA\u5DE5\u6838\u5BF9\u3002",
  HISTORY_MISSING: "\u76EE\u6807\u5DF2\u5B58\u5728\uFF0C\u4F46\u7F3A\u5C11\u5B8C\u6574\u8FC1\u79FB\u51ED\u636E\uFF0C\u9700\u8981\u4EBA\u5DE5\u6838\u5BF9\u3002",
  RESOURCE_CHANGED: "\u5907\u4EFD\u8D44\u6E90\u53D1\u751F\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u751F\u6210\u9884\u89C8\u3002"
};
function friendlyError(value) {
  if (value && typeof value === "object" && "code" in value && typeof value.code === "string" && errors[value.code]) return errors[value.code];
  return value instanceof Error ? value.message : "\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5\u3002";
}
async function call(endpoint, payload = {}, signal) {
  const response = await fetch("api/dsh-alink.rpc", {
    method: "POST",
    credentials: "same-origin",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, payload })
  });
  const result = await response.json().catch(() => void 0);
  if (result && !result.ok) throw Object.assign(new Error(result.error.message), { code: result.error.code });
  if (!response.ok || !result) throw new Error("\u4E0E DSH \u7684\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002");
  return result.value;
}

// src/client/navigation.ts
async function openImportedSession(ctx, id) {
  await ctx.sessions.refresh();
  ctx.uiWorkspace.openSession(id);
  ctx.layout.selectPanel(null);
}

// src/client/export-file.ts
async function exportToFile(ctx, create, update, suggestedName) {
  const picker = window.showSaveFilePicker;
  if (!picker) throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u9009\u62E9\u4FDD\u5B58\u4F4D\u7F6E\uFF0C\u8BF7\u4F7F\u7528 DSH \u684C\u9762\u7AEF\u6216 Chrome / Edge \u7684\u672C\u5730\u6216\u5B89\u5168\u8FDE\u63A5\u3002");
  let file;
  try {
    file = await picker.call(window, { id: "dsh-alink-export", suggestedName, types: [{ description: "Alink \u4F1A\u8BDD\u5305", accept: { "application/zip": [".zip"] } }] });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  }
  const controller = new AbortController(), release = ctx.effect(() => () => controller.abort());
  const signal = controller.signal;
  try {
    let job = await create();
    update(job);
    while (["queued", "running"].includes(job.state)) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      signal.throwIfAborted();
      job = await call("transfer", { id: job.id }, signal);
      update(job);
    }
    if (!job.downloadable) throw Object.assign(new Error("\u5BFC\u51FA\u672A\u5B8C\u6210"), { code: job.errorCode || job.items.find((item) => item.errorCode)?.errorCode || "CANCELED" });
    const response = await fetch("api/dsh-alink.export?id=" + encodeURIComponent(job.id), { credentials: "same-origin", signal });
    if (!response.ok) {
      const result = await response.json();
      throw Object.assign(new Error(result.error.message), { code: result.error.code });
    }
    if (!response.body) throw new Error("\u5BFC\u51FA\u6587\u4EF6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    signal.throwIfAborted();
    const writable = await file.createWritable();
    await response.body.pipeTo(writable, { signal });
    return { job, name: file.name };
  } finally {
    await release();
  }
}

// src/client/MigrationPanel.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var names = { workbuddy: "WorkBuddy", codex: "Codex", raccoon: "\u5C0F\u6D63\u718A", cursor: "Cursor", dsh: "DSH" };
var states = { prepared: "\u6392\u961F\u4E2D", writing: "\u8FC1\u5165\u4E2D", verifying: "\u6838\u5BF9\u4E2D", completed: "\u8FC1\u79FB\u5B8C\u6210", failed: "\u8FC1\u79FB\u5931\u8D25", canceled: "\u5DF2\u53D6\u6D88", "needs-attention": "\u9700\u8981\u6838\u5BF9" };
var running = (job) => ["queued", "running"].includes(job.state);
function FolderIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { className: "dsh-alink-folder", viewBox: "0 0 20 20", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.5 5.5a2 2 0 0 1 2-2h4l2 2h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" }) });
}
function Check({ label, checked, partial = false, disabled, change }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-alink-check", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", "aria-label": label, checked, disabled, ref: (node) => {
    if (node) node.indeterminate = partial && !checked;
  }, onClick: (e) => e.stopPropagation(), onChange: change }) });
}
function MigrationPanel({ ctx }) {
  const [tab, setTab] = (0, import_react.useState)("sources");
  const [sources, setSources] = (0, import_react.useState)([]), [targets, setTargets] = (0, import_react.useState)({ workspaces: [], presets: [], defaultPreset: "" });
  const [app, setApp] = (0, import_react.useState)("workbuddy"), [query, setQuery] = (0, import_react.useState)("");
  const [sessions, setSessions] = (0, import_react.useState)([]), [cursor, setCursor] = (0, import_react.useState)();
  const [selection, setSelection] = (0, import_react.useState)(/* @__PURE__ */ new Map()), [focus, setFocus] = (0, import_react.useState)();
  const [targetMode, setTargetMode] = (0, import_react.useState)("original"), [cwd, setCwd] = (0, import_react.useState)(""), [preset, setPreset] = (0, import_react.useState)("");
  const [preview, setPreview] = (0, import_react.useState)(), [messages, setMessages] = (0, import_react.useState)([]), [total, setTotal] = (0, import_react.useState)(0), [previewTitle, setPreviewTitle] = (0, import_react.useState)("");
  const [inspectionId, setInspectionId] = (0, import_react.useState)(""), [reading, setReading] = (0, import_react.useState)(false), [readError, setReadError] = (0, import_react.useState)(""), [readRevision, setReadRevision] = (0, import_react.useState)(0), [viewFor, setViewFor] = (0, import_react.useState)("");
  const [toast, setToast] = (0, import_react.useState)(), [exporting, setExporting] = (0, import_react.useState)(false);
  const seenTransfers = (0, import_react.useRef)(/* @__PURE__ */ new Map()), standaloneImports = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const [operations, setOperations] = (0, import_react.useState)([]), [transfers, setTransfers] = (0, import_react.useState)([]);
  const [error, setError] = (0, import_react.useState)(""), [busy, setBusy] = (0, import_react.useState)(false), [loading, setLoading] = (0, import_react.useState)(false), [revision, setRevision] = (0, import_react.useState)(0);
  const [localOpen, setLocalOpen] = (0, import_react.useState)(false), [directory, setDirectory] = (0, import_react.useState)("");
  const action = (0, import_react.useRef)(void 0), mounted = (0, import_react.useRef)(true);
  const synchronized = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const syncNative = (0, import_react.useCallback)(async (jobs) => {
    const completed = jobs.filter((op) => op.state === "completed").map((op) => op.targetSessionId);
    if (completed.some((id) => !synchronized.current.has(id))) {
      await ctx.sessions.refresh();
      await Promise.all(completed.filter((id) => !synchronized.current.has(id)).map((id) => ctx.sessions.refreshProjections(id)));
      await ctx.sessions.refresh();
      for (const id of completed) synchronized.current.add(id);
    }
  }, [ctx]);
  const selected = [...selection.values()];
  const importBusy = transfers.some((job) => job.kind === "import" && running(job));
  const active = transfers.some(running) || operations.some((op) => ["prepared", "writing", "verifying"].includes(op.state));
  const clearPreview = () => {
    setPreview(void 0);
    setInspectionId("");
    setMessages([]);
    setTotal(0);
    setPreviewTitle("");
    setReadError("");
    setViewFor("");
  };
  const focusKey = focus?.recordPreviewId || focus?.sourceId || "";
  const viewMatches = viewFor === focusKey;
  (0, import_react.useEffect)(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      action.current?.abort();
    };
  }, []);
  (0, import_react.useEffect)(() => {
    const controller = new AbortController();
    Promise.all([call("sources", {}, controller.signal), call("targets", {}, controller.signal), call("operations", {}, controller.signal), call("transfers", {}, controller.signal)]).then(async ([sourceList, targetList, jobs, batches]) => {
      if (controller.signal.aborted) return;
      await syncNative(jobs);
      if (controller.signal.aborted) return;
      setSources(sourceList);
      setTargets(targetList);
      setOperations(jobs);
      for (const job of batches) if (!seenTransfers.current.has(job.id)) seenTransfers.current.set(job.id, job.state);
      setTransfers(batches);
      setPreset((value) => value || targetList.defaultPreset);
    }).catch((e) => {
      if (!controller.signal.aborted) setError(friendlyError(e));
    });
    return () => controller.abort();
  }, [revision, syncNative]);
  (0, import_react.useEffect)(() => {
    const controller = new AbortController();
    setLoading(true);
    call("sessions", { app, text: query, limit: 100 }, controller.signal).then((page) => {
      if (!controller.signal.aborted) {
        setSessions(page.items);
        setCursor(page.nextCursor);
      }
    }).catch((e) => {
      if (!controller.signal.aborted) {
        setError(friendlyError(e));
        setSessions([]);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [app, query, revision]);
  (0, import_react.useEffect)(() => {
    if (!focusKey) {
      clearPreview();
      setReading(false);
      return;
    }
    const controller = new AbortController();
    clearPreview();
    setReading(true);
    const timer = setTimeout(() => {
      const endpoint = focus?.recordPreviewId ? "previewPage" : "inspect";
      const payload = focus?.recordPreviewId ? { previewId: focus.recordPreviewId } : { sourceId: focus.sourceId };
      call(endpoint, payload, controller.signal).then((page) => {
        if (controller.signal.aborted) return;
        setPreview(page.preview);
        setInspectionId(page.inspectionId || "");
        setMessages(page.items);
        setTotal(page.total);
        setPreviewTitle(page.title || focus.title);
        setViewFor(focusKey);
      }).catch((error2) => {
        if (!controller.signal.aborted) setReadError(friendlyError(error2));
      }).finally(() => {
        if (!controller.signal.aborted) setReading(false);
      });
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [focusKey, revision, readRevision]);
  (0, import_react.useEffect)(() => {
    for (const job of transfers) {
      const before = seenTransfers.current.get(job.id);
      if (before !== void 0 && ["queued", "running"].includes(before) && !running(job) && job.kind === "import") {
        const count = job.items.filter((item) => item.state === "completed").length;
        setToast({ title: job.state === "completed" ? "\u5BFC\u5165\u5B8C\u6210" : "\u5BFC\u5165\u4EFB\u52A1\u5DF2\u7ED3\u675F", detail: `${count} / ${job.items.length} \u6761\u4F1A\u8BDD${job.items.some((item) => item.warning) ? "\uFF0C\u8BE6\u60C5\u89C1\u8FC1\u79FB\u8BB0\u5F55" : ""}`, error: job.state !== "completed" });
      }
      seenTransfers.current.set(job.id, job.state);
    }
  }, [transfers]);
  (0, import_react.useEffect)(() => {
    for (const job of operations) if (job.state === "completed" && standaloneImports.current.delete(job.operationId)) setToast({ title: "\u5BFC\u5165\u5B8C\u6210", detail: job.title });
  }, [operations]);
  (0, import_react.useEffect)(() => {
    if (!toast || toast.error) return;
    const timer = setTimeout(() => setToast(void 0), 4e3);
    return () => clearTimeout(timer);
  }, [toast]);
  (0, import_react.useEffect)(() => {
    if (!active) return;
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      try {
        const [jobs, batches] = await Promise.all([call("operations", {}, controller.signal), call("transfers", {}, controller.signal)]);
        await syncNative(jobs);
        if (!controller.signal.aborted) {
          setOperations(jobs);
          setTransfers(batches);
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(friendlyError(e));
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 500);
    };
    timer = setTimeout(poll, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [active, syncNative]);
  async function perform(work) {
    if (busy) return;
    const controller = new AbortController();
    action.current = controller;
    setBusy(true);
    setError("");
    try {
      await work(controller.signal);
    } catch (e) {
      if (!controller.signal.aborted && mounted.current) setError(friendlyError(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function toggle(items, add) {
    const next = new Map(selection);
    for (const item of items) if (add) next.set(item.sourceId, item);
    else next.delete(item.sourceId);
    if (next.size > 100) {
      setError("\u6BCF\u6279\u6700\u591A\u9009\u62E9 100 \u6761\u4F1A\u8BDD\uFF0C\u8BF7\u5206\u6279\u5904\u7406\u3002");
      return;
    }
    setSelection(next);
    if (add && items[0]) {
      setFocus(items[0]);
      if (!cwd) setCwd(items[0].cwd || "");
    } else if (focus && !next.has(focus.sourceId)) setFocus(next.values().next().value);
  }
  function choose(source) {
    const same = focus?.sourceId === source.sourceId;
    toggle([source], true);
    setFocus(source);
    if (same) setReadRevision((value) => value + 1);
  }
  function updateTransfer(job) {
    if (mounted.current) setTransfers((old) => [job, ...old.filter((item) => item.id !== job.id)]);
  }
  async function startImport(signal) {
    const job = await call("importMany", {
      requestId: crypto.randomUUID(),
      sourceIds: selected.map((s) => s.sourceId),
      titles: Object.fromEntries(selected.map((s) => [s.sourceId, (s.title || "\u672A\u547D\u540D\u4F1A\u8BDD").slice(0, 300)])),
      target: { agentPreset: preset, ...targetMode === "single" ? { cwd } : {} }
    }, signal);
    seenTransfers.current.set(job.id, "queued");
    updateTransfer(job);
  }
  async function startExport(retry) {
    if (exporting) return;
    setExporting(true);
    setError("");
    const name2 = selected.length === 1 ? selected[0].title.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "-").slice(0, 60) : "\u4F1A\u8BDD";
    try {
      const result = await exportToFile(ctx, () => retry ? call("retryTransfer", { id: retry.id }) : call("exportMany", {
        requestId: crypto.randomUUID(),
        sourceIds: selected.map((s) => s.sourceId),
        titles: Object.fromEntries(selected.map((s) => [s.sourceId, (s.title || "\u672A\u547D\u540D\u4F1A\u8BDD").slice(0, 300)]))
      }), updateTransfer, "Alink-" + (name2 || "\u4F1A\u8BDD") + ".zip");
      if (result && mounted.current) setToast({ title: "\u5BFC\u51FA\u5B8C\u6210", detail: `\u5DF2\u4FDD\u5B58\u5230 ${result.name}` });
    } catch (error2) {
      if (mounted.current) setToast({ title: "\u5BFC\u51FA\u672A\u4FDD\u5B58", detail: friendlyError(error2), error: true });
    } finally {
      if (mounted.current) setExporting(false);
    }
  }
  function registered(result) {
    toggle(result.sources, true);
    setLocalOpen(false);
    setTab("sources");
    setToast({ title: `\u5DF2\u8BFB\u53D6 ${result.sources.length} \u6761\u4F1A\u8BDD\u3002`, detail: result.errors.length ? `${result.errors.length} \u6761\u6765\u6E90\u5DF2\u5931\u6548\u6216\u5F52\u6863\uFF0C\u672A\u52A0\u5165\u3002` : void 0 });
  }
  async function upload(files, signal) {
    const sources2 = [], errors2 = [];
    if (files.length > 100) throw new Error("\u4E00\u6B21\u6700\u591A\u8BFB\u53D6 100 \u4E2A\u6587\u4EF6\u3002");
    for (const file of files) {
      const format = file.name.toLowerCase().endsWith(".zip") ? "alink" : "dsh";
      const response = await fetch(`api/dsh-alink.upload?multiple=1&format=${format}&filename=${encodeURIComponent(file.name)}`, { method: "POST", credentials: "same-origin", body: file, signal });
      const result = await response.json();
      if (!result.ok) {
        errors2.push(result.error.code);
        continue;
      }
      sources2.push(...result.value.sources);
      errors2.push(...result.value.errors);
    }
    if (!sources2.length) throw { code: errors2[0] || "INVALID_SOURCE" };
    registered({ sources: sources2, errors: errors2 });
  }
  const projects = /* @__PURE__ */ new Map();
  for (const session of sessions) {
    const key = session.cwd || "";
    const group = projects.get(key) || [];
    group.push(session);
    projects.set(key, group);
  }
  const shownTransfers = transfers.filter(running);
  const problemTransfers = transfers.filter((job) => !running(job) && (job.state !== "completed" || job.items.some((item) => item.warning))).slice(0, 10);
  const validTarget = targetMode === "single" ? !!cwd : selected.every((item) => !!item.cwd);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsh-alink", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "dsh-alink-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "Alink" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", { "aria-label": "Alink \u9875\u9762", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: tab === "sources" ? "current" : "", onClick: () => setTab("sources"), children: "\u4F1A\u8BDD" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: tab === "records" ? "current" : "", onClick: () => setTab("records"), children: "\u8FC1\u79FB\u8BB0\u5F55" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-header-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setLocalOpen((value) => !value), children: "\u4ECE\u672C\u5730\u5BFC\u5165" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: busy, onClick: () => {
          clearPreview();
          setRevision((value) => value + 1);
        }, children: "\u5237\u65B0\u6765\u6E90" })
      ] })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-alink-error", role: "alert", children: error }),
    toast && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", { className: "dsh-alink-toast" + (toast.error ? " is-error" : ""), role: toast.error ? "alert" : "status", "aria-live": "polite", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-alink-toast-icon", "aria-hidden": "true", children: toast.error ? "!" : "\u2713" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: toast.title }),
        toast.detail && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: toast.detail })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "aria-label": "\u5173\u95ED\u63D0\u793A", onClick: () => setToast(void 0), children: "\xD7" })
    ] }),
    localOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsh-alink-local", "aria-label": "\u672C\u5730\u5BFC\u5165", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u9009\u62E9\u5BFC\u51FA\u5305\u6216\u65E7 DSH \u65E5\u5FD7",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { "aria-label": "\u5907\u4EFD\u6587\u4EF6", type: "file", multiple: true, accept: ".zip,.jsonl,.zstd", disabled: busy, onChange: (e) => {
          const files = [...e.target.files || []];
          if (files.length) void perform((signal) => upload(files, signal));
          e.target.value = "";
        } })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u672C\u5730\u5907\u4EFD\u76EE\u5F55",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { "aria-label": "\u5907\u4EFD\u76EE\u5F55", value: directory, onChange: (e) => setDirectory(e.target.value), placeholder: "\u5DF2\u6709 .alink \u76EE\u5F55\u7684\u5B8C\u6574\u8DEF\u5F84" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: !directory || busy, onClick: () => void perform(async (signal) => registered(await call("registerFiles", { path: directory, format: "alink" }, signal))), children: "\u8BFB\u53D6\u76EE\u5F55" })
    ] }),
    shownTransfers.map((job) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsh-alink-transfer", "aria-label": "\u4EFB\u52A1\u8FDB\u5EA6", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: job.kind === "import" ? "\u6B63\u5728\u5BFC\u5165" : "\u6B63\u5728\u5BFC\u51FA" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          job.items.filter((item) => item.state === "completed").length,
          " / ",
          job.items.length,
          " \u6761\u4F1A\u8BDD"
        ] }),
        job.items.find((item) => item.state === "running")?.title && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: job.items.find((item) => item.state === "running").title }),
        job.errorCode && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: friendlyError({ code: job.errorCode }) }),
        job.items.filter((item) => item.warning).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
          item.title,
          "\uFF1A",
          item.warning
        ] }, "warning-" + item.sourceId)),
        job.items.filter((item) => item.state === "failed").map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
          item.title || "\u4F1A\u8BDD",
          "\uFF1A",
          friendlyError({ code: item.errorCode })
        ] }, item.sourceId))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-alink-task-actions", children: running(job) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => void perform(async () => {
        await call("cancelTransfer", { id: job.id });
      }), children: "\u505C\u6B62\u4EFB\u52A1" }) })
    ] }, job.id)),
    tab === "sources" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-columns", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", { className: "dsh-alink-sources", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
          "\u6765\u6E90\u5E94\u7528",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { "aria-label": "\u6765\u6E90\u5E94\u7528", value: app, onChange: (e) => setApp(e.target.value), children: ["workbuddy", "codex", "raccoon", "cursor"].map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: id, children: [
            names[id],
            " \xB7 ",
            sources.find((s) => s.app === id)?.count ?? 0,
            " \u4E2A\u4F1A\u8BDD"
          ] }, id)) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { "aria-label": "\u641C\u7D22\u6765\u6E90\u4F1A\u8BDD", placeholder: "\u641C\u7D22\u4F1A\u8BDD\u6216\u9879\u76EE", value: query, onChange: (e) => setQuery(e.target.value) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-list-tools", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { label: "\u5168\u9009\u5F53\u524D\u5217\u8868", checked: !!sessions.length && sessions.every((item) => selection.has(item.sourceId)), partial: sessions.some((item) => selection.has(item.sourceId)), change: () => toggle(sessions, !sessions.every((item) => selection.has(item.sourceId))) }),
            "\u5168\u9009\u5217\u8868"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            sessions.length,
            " \u6761"
          ] })
        ] }),
        sources.find((s) => s.app === app)?.error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-alink-note", children: "\u6765\u6E90\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u3002" }),
        loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u2026" }) : !sessions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-alink-empty", children: "\u6CA1\u6709\u6709\u6548\u4F1A\u8BDD\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-alink-session-list", children: [...projects].map(([project, items]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: "dsh-alink-project", open: true, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", { title: project, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { className: "dsh-alink-chevron", viewBox: "0 0 12 12", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m4 2 4 4-4 4" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { label: "\u9009\u62E9\u9879\u76EE\uFF1A" + (project || "\u672A\u5173\u8054\u9879\u76EE"), checked: items.every((item) => selection.has(item.sourceId)), partial: items.some((item) => selection.has(item.sourceId)), change: () => toggle(items, !items.every((item) => selection.has(item.sourceId))) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderIcon, {}),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-alink-project-name", children: project.split(/[\\/]/).filter(Boolean).at(-1) || "\u672A\u5173\u8054\u9879\u76EE" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: items.length })
          ] }),
          project && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-alink-project-path", title: project, children: project }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-alink-project-sessions", children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-session-row" + (focus?.sourceId === item.sourceId ? " selected" : ""), children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { label: "\u9009\u62E9\u4F1A\u8BDD\uFF1A" + item.title, checked: selection.has(item.sourceId), change: () => toggle([item], !selection.has(item.sourceId)) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "aria-label": "\u6253\u5F00\u4F1A\u8BDD\uFF1A" + item.title, onClick: () => choose(item), title: item.title, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.title }) })
          ] }, item.sourceId)) })
        ] }, project)) }),
        cursor && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => void perform(async (signal) => {
          const page = await call("sessions", { app, text: query, cursor, limit: 100 }, signal);
          setSessions((old) => [...old, ...page.items]);
          setCursor(page.nextCursor);
        }), children: "\u52A0\u8F7D\u66F4\u591A" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { className: "dsh-alink-preview", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsh-alink-selection", "aria-label": "\u5BFC\u5165\u4E0E\u5BFC\u51FA", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-selection-heading", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: selected.length ? `\u5DF2\u9009\u62E9 ${selected.length} \u6761\u4F1A\u8BDD` : "\u9009\u62E9\u4F1A\u8BDD" }),
            selected.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => {
              setSelection(/* @__PURE__ */ new Map());
              setFocus(void 0);
              clearPreview();
            }, children: "\u6E05\u7A7A\u9009\u62E9" })
          ] }),
          !selected.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-alink-note", children: "\u52FE\u9009\u4F1A\u8BDD\u6216\u6574\u4E2A\u9879\u76EE\uFF0C\u7136\u540E\u76F4\u63A5\u5BFC\u5165\u6216\u5BFC\u51FA\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "dsh-alink-picked", children: selected.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.title }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: names[item.app] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { "aria-label": "\u53D6\u6D88\u9009\u62E9\uFF1A" + item.title, onClick: () => toggle([item], false), children: "\xD7" })
            ] }, item.sourceId)) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-targets", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
                "\u5BFC\u5165\u9879\u76EE",
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { "aria-label": "\u5BFC\u5165\u9879\u76EE", value: targetMode, onChange: (e) => {
                  setTargetMode(e.target.value);
                }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "original", children: "\u4FDD\u7559\u5404\u4F1A\u8BDD\u7684\u539F\u9879\u76EE" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "single", children: "\u7EDF\u4E00\u5230\u6307\u5B9A\u9879\u76EE" })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
                "DSH \u914D\u7F6E",
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { "aria-label": "DSH \u914D\u7F6E", value: preset, onChange: (e) => {
                  setPreset(e.target.value);
                }, children: targets.presets.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: item.id, disabled: !!item.broken, children: item.name || { standard: "\u6807\u51C6\u6A21\u5F0F", minimal: "\u7CBE\u7B80\u6A21\u5F0F" }[item.id] || item.id }, item.id)) })
              ] })
            ] }),
            targetMode === "single" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsh-alink-unified", children: [
              "\u76EE\u6807\u9879\u76EE\u76EE\u5F55",
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { "aria-label": "\u76EE\u6807\u9879\u76EE\u76EE\u5F55", value: cwd, list: "dsh-alink-workspaces", onChange: (e) => {
                setCwd(e.target.value);
              }, placeholder: "\u9009\u62E9\u6216\u586B\u5199\u5DF2\u6709\u9879\u76EE\u76EE\u5F55" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", { id: "dsh-alink-workspaces", children: targets.workspaces.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: item.path, children: item.title }, item.id)) })
            ] }),
            !validTarget && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-alink-note", children: "\u6240\u9009\u4F1A\u8BDD\u7F3A\u5C11\u539F\u9879\u76EE\u76EE\u5F55\uFF0C\u8BF7\u9009\u62E9\u7EDF\u4E00\u76EE\u6807\u9879\u76EE\u3002" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-primary-actions", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: busy || exporting, onClick: () => void startExport(), children: exporting ? "\u6B63\u5728\u5BFC\u51FA\u2026" : `\u5BFC\u51FA\u6240\u9009\uFF08${selected.length}\uFF09` }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "primary", disabled: busy || importBusy || !preset || !validTarget, onClick: () => void perform(startImport), children: [
                "\u5BFC\u5165\u6240\u9009\uFF08",
                selected.length,
                "\uFF09"
              ] })
            ] })
          ] })
        ] }),
        focus && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsh-alink-inspect", "aria-busy": reading, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-preview-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: viewMatches ? previewTitle || focus.title : focus.title }),
            viewMatches && !reading && !readError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
              total,
              " \u6761\u5BF9\u8BDD"
            ] })
          ] }),
          reading || !viewMatches && !readError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-reading", role: "status", "aria-label": "\u6B63\u5728\u52A0\u8F7D\u5BF9\u8BDD", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-alink-spinner", "aria-hidden": "true" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u6B63\u5728\u8BFB\u53D6\u5BF9\u8BDD\u2026" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-skeleton", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})
            ] })
          ] }) : readError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-read-error", role: "alert", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: readError }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setReadRevision((value) => value + 1), children: "\u91CD\u65B0\u8BFB\u53D6" })
          ] }) : viewMatches && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-alink-messages", role: "region", "aria-label": "\u5BF9\u8BDD\u5386\u53F2", children: messages.length ? messages.map((message, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: message.role === "user" ? "\u7528\u6237" : "\u52A9\u624B" }),
              message.content.map((block, i) => block.type === "text" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { children: block.text }, i) : null)
            ] }, index)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-alink-empty", children: "\u6B64\u4F1A\u8BDD\u6682\u65E0\u53EF\u5C55\u793A\u7684\u6587\u5B57\u6D88\u606F\u3002" }) }),
            messages.length < total && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: busy, onClick: () => void perform(async (signal) => {
              const page = await call(inspectionId ? "inspectionPage" : "previewPage", inspectionId ? { inspectionId, offset: messages.length } : { previewId: preview.previewId, offset: messages.length }, signal);
              setMessages((old) => [...old, ...page.items]);
            }), children: "\u52A0\u8F7D\u66F4\u591A\u5BF9\u8BDD" })
          ] })
        ] })
      ] })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsh-alink-operations", "aria-label": "\u8FC1\u79FB\u8BB0\u5F55", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u8FC1\u79FB\u8BB0\u5F55" }),
      problemTransfers.map((job) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: "dsh-alink-task-result", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", { children: [
          job.kind === "import" ? "\u5BFC\u5165" : "\u5BFC\u51FA",
          "\u4EFB\u52A1 \xB7 ",
          job.items.filter((item) => item.state === "completed").length,
          "/",
          job.items.length,
          " \u6761\u5B8C\u6210"
        ] }),
        job.items.filter((item) => item.errorCode || item.warning).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
          item.title || "\u4F1A\u8BDD",
          "\uFF1A",
          item.warning || friendlyError({ code: item.errorCode })
        ] }, item.sourceId)),
        job.state !== "completed" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: busy || exporting, onClick: () => job.kind === "export" ? void startExport(job) : void perform(async () => {
          const next = await call("retryTransfer", { id: job.id });
          seenTransfers.current.set(next.id, "queued");
          updateTransfer(next);
        }), children: "\u91CD\u8BD5\u672A\u5B8C\u6210\u9879" })
      ] }, job.id)),
      !operations.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-alink-empty", children: "\u6682\u65E0\u8FC1\u79FB\u8BB0\u5F55\u3002" }),
      operations.map((op) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsh-alink-record-title", "aria-label": "\u6253\u5F00\u8BB0\u5F55\uFF1A" + op.title, onClick: () => {
            setTab("sources");
            setFocus({ sourceId: "", nativeId: "", app, title: op.title, recordPreviewId: op.previewId });
          }, children: op.title }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { role: "status", children: [
            states[op.state],
            op.outdated ? " \xB7 \u65E7\u7248\u5BFC\u5165" : ""
          ] }),
          op.errorCode && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: friendlyError({ code: op.errorCode }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-operation-actions", children: [
          op.state === "completed" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => void perform(() => openImportedSession(ctx, op.targetSessionId)), children: "\u6253\u5F00\u4F1A\u8BDD" }),
          (op.outdated || ["failed", "needs-attention", "canceled"].includes(op.state)) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: busy || active, onClick: () => void perform(async () => {
            const next = await call("retryOperation", { operationId: op.operationId });
            standaloneImports.current.add(next.operationId);
            setOperations((old) => [next, ...old.filter((item) => item.operationId !== next.operationId)]);
          }), children: op.outdated ? "\u91CD\u65B0\u5BFC\u5165\u7EAF\u5BF9\u8BDD" : "\u91CD\u65B0\u6838\u5BF9\u5E76\u91CD\u8BD5" }),
          ["prepared", "writing", "verifying"].includes(op.state) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => void perform(async () => {
            await call("cancel", { operationId: op.operationId });
          }), children: "\u505C\u6B62" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: busy || active, title: "\u5220\u9664\u6B64\u8BB0\u5F55\uFF0C\u4FDD\u7559\u5DF2\u8FC1\u5165\u7684 DSH \u4F1A\u8BDD", onClick: () => void perform(async () => {
            await call("removeOperation", { operationId: op.operationId });
            setOperations((old) => old.filter((item) => item.operationId !== op.operationId));
          }), children: "\u5220\u9664\u8BB0\u5F55" })
        ] })
      ] }, op.operationId))
    ] })
  ] });
}

// src/client/styles.css
var styles_default = `.dsh-alink {
  height: 100%; min-height: 0; min-width: 0; max-width: 100%; overflow: auto;
  padding: 24px; box-sizing: border-box; color: inherit; font: inherit; container-type: inline-size;
  --link-line: color-mix(in srgb,currentColor 11%,transparent);
  --link-accent: light-dark(#006be0,#409cff);
  --link-action: #006be0;
  --link-tint: color-mix(in srgb,var(--link-accent) 11%,Canvas);
  --link-group: color-mix(in srgb,currentColor 3%,Canvas);
  --link-muted: color-mix(in srgb,currentColor 60%,transparent);
}
.dsh-alink * { box-sizing: border-box; }
.dsh-alink h1 { font-size: 24px; letter-spacing: -.5px; margin: 0; }
.dsh-alink h2 { font-size: 17px; margin: 0 0 18px; overflow-wrap: anywhere; }
.dsh-alink h3 { font-size: 13px; margin: 0; font-weight: 600; color: CanvasText; }
.dsh-alink p { line-height: 1.6; }
.dsh-alink-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 20px; }
.dsh-alink-note { color: var(--link-muted); font-size: 12px; margin: 12px 0; }
.dsh-alink button, .dsh-alink input, .dsh-alink select {
  font: inherit; font-size: 13px; line-height: 1.5; border: 1px solid var(--link-line);
  border-radius: 8px; padding: 9px 12px; color: inherit; background: transparent; min-width: 0; max-width: 100%;
}
.dsh-alink button { cursor: pointer; text-decoration: none; height: auto; white-space: normal; overflow-wrap: anywhere; }
.dsh-alink button:hover { background: color-mix(in srgb,currentColor 6%,transparent); }
.dsh-alink button:disabled { opacity: .45; cursor: default; }
.dsh-alink button.primary { background: CanvasText; color: Canvas; border-color: CanvasText; }
.dsh-alink input, .dsh-alink select { display: block; width: 100%; margin-top: 7px; background: Canvas; }
.dsh-alink input:not([type=file]), .dsh-alink select { height: 40px; }
.dsh-alink select {
  appearance: none; padding-right: 36px; text-overflow: ellipsis;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23777777' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-size: 16px 16px; background-position: right 12px center;
}
.dsh-alink label { min-width: 0; font-size: 12px; font-weight: 500; display: block; }
.dsh-alink button:focus-visible, .dsh-alink input:focus-visible, .dsh-alink select:focus-visible, .dsh-alink summary:focus-visible { outline: 2px solid Highlight; outline-offset: 2px; }
.dsh-alink-columns { display: grid; grid-template-columns: minmax(210px,30%) minmax(0,1fr); border: 1px solid var(--link-line); border-radius: 12px; overflow: hidden; }
.dsh-alink-sources { padding: 18px; min-width: 0; border-right: 1px solid var(--link-line); }
.dsh-alink-sources>input { margin: 13px 0; }
.dsh-alink-session-list { max-height: 55vh; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; }
.dsh-alink-project { min-width: 0; margin: 6px 0; padding: 3px; border-radius: 12px; background: var(--link-group); }
.dsh-alink-project summary { display: flex; align-items: center; gap: 5px; min-width: 0; padding: 4px 6px; list-style: none; cursor: pointer; border-radius: 9px; font-size: 13px; font-weight: 600; }
.dsh-alink-project summary::-webkit-details-marker { display: none; }
.dsh-alink-project summary::marker { content: ""; }
.dsh-alink-project summary:hover { background: color-mix(in srgb,currentColor 4%,transparent); }
.dsh-alink-project-name { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.dsh-alink-chevron { width: 10px; height: 10px; flex-shrink: 0; fill: none; stroke: var(--link-muted); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; transition: transform .18s ease; }
.dsh-alink-project[open]>summary .dsh-alink-chevron { transform: rotate(90deg); }
.dsh-alink-folder { width: 18px; height: 18px; flex-shrink: 0; fill: color-mix(in srgb,var(--link-accent) 14%,transparent); stroke: var(--link-accent); stroke-width: 1.25; margin-right: 2px; }
.dsh-alink-project summary small { min-width: 20px; padding: 2px 5px; border-radius: 6px; text-align: center; font-size: 11px; font-weight: 500; color: var(--link-muted); font-variant-numeric: tabular-nums; }
.dsh-alink-project-path { margin: 0 10px 7px 61px; font-size: 10px; color: var(--link-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-alink-project-sessions { display: flex; flex-direction: column; gap: 2px; min-width: 0; margin: 0 2px 5px 19px; }
.dsh-alink-project-sessions button { display: block; flex-shrink: 0; text-align: left; border-color: transparent; padding: 10px; width: 100%; }
.dsh-alink-preview { padding: 24px; min-width: 0; }
.dsh-alink-empty { padding: 24px 6px; color: var(--link-muted); font-size: 13px; }
.dsh-alink-targets { display: grid; grid-template-columns: minmax(0,1fr) minmax(120px,160px); gap: 14px; margin-bottom: 15px; }
.dsh-alink-preview-actions { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; color: var(--link-muted); margin: 22px 0 12px; }
.dsh-alink-messages { max-height: 55vh; overflow: auto; border: 1px solid var(--link-line); border-radius: 9px; min-width: 0; scrollbar-gutter: stable; }
.dsh-alink-messages article { padding: 14px 16px; border-bottom: 1px solid var(--link-line); min-width: 0; }
.dsh-alink-messages article:last-child { border-bottom: 0; }
.dsh-alink-messages small { font-size: 11px; color: var(--link-muted); }
.dsh-alink-messages pre { font: inherit; font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65; margin: 9px 0 0; max-width: 100%; }
.dsh-alink-error { border: 1px solid #c43e3260; background: #c43e320c; color: #c43e32; border-radius: 9px; padding: 12px 15px; margin: 16px 0; font-size: 13px; overflow-wrap: anywhere; }
.dsh-alink-operations { margin-top: 26px; }
.dsh-alink-operations article { border-top: 1px solid var(--link-line); padding: 16px 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dsh-alink-operations article>div:first-child { min-width: 0; display: grid; gap: 5px; font-size: 13px; overflow-wrap: anywhere; }
.dsh-alink-operations article span, .dsh-alink-operations article small { font-size: 11px; color: var(--link-muted); }
.dsh-alink-operation-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; flex-shrink: 0; max-width: 55%; }
.dsh-alink-operation-actions button { font-size: 11px; padding: 7px 9px; }
@container (max-width: 720px) {
  .dsh-alink-columns { grid-template-columns: minmax(0,1fr); }
  .dsh-alink-sources { border-right: 0; border-bottom: 1px solid var(--link-line); }
  .dsh-alink-session-list { max-height: 260px; }
  .dsh-alink-targets { grid-template-columns: minmax(0,1fr); }
  .dsh-alink-preview { padding: 18px; }
  .dsh-alink-operations article { align-items: start; flex-direction: column; }
  .dsh-alink-operation-actions { max-width: 100%; justify-content: flex-start; }
}
@media (max-width: 600px) { .dsh-alink { padding: 14px; } }
/* Selection and transfer controls share a compact, responsive workspace. */
.dsh-alink-header { flex-wrap: wrap; }
.dsh-alink-header nav { display: flex; gap: 4px; margin-right: auto; }
.dsh-alink-header nav button { border-color: transparent; }
.dsh-alink-header nav button.current { background: color-mix(in srgb,currentColor 7%,transparent); font-weight: 600; }
.dsh-alink-header-actions, .dsh-alink-primary-actions, .dsh-alink-task-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.dsh-alink-columns { grid-template-columns: minmax(260px,35%) minmax(0,1fr); }
.dsh-alink-check { width: 28px; height: 28px; flex: 0 0 28px; display: inline-flex; align-items: center; justify-content: center; }
.dsh-alink .dsh-alink-check input[type=checkbox] { appearance: none; width: 28px; height: 28px; min-width: 28px; margin: 0; padding: 0; border: 0; border-radius: 7px; background: none; position: relative; cursor: pointer; outline: none; }
.dsh-alink-check input::before { content: ""; position: absolute; inset: 5px; border: 1px solid color-mix(in srgb,currentColor 25%,transparent); border-radius: 5px; background: Canvas; transition: background .12s, border-color .12s, box-shadow .12s; }
.dsh-alink-check input:checked::before, .dsh-alink-check input:indeterminate::before { background: var(--link-action); border-color: var(--link-action); }
.dsh-alink-check input:checked::after { content: ""; position: absolute; left: 11px; top: 8px; width: 5px; height: 9px; border: solid white; border-width: 0 1.8px 1.8px 0; transform: rotate(45deg); }
.dsh-alink-check input:indeterminate::after { content: ""; position: absolute; width: 8px; height: 2px; left: 10px; top: 13px; border: 0; border-radius: 2px; background: white; transform: none; }
.dsh-alink-check input:focus-visible::before { box-shadow: 0 0 0 3px color-mix(in srgb,var(--link-accent) 25%,transparent); border-color: var(--link-accent); }
.dsh-alink-check input:disabled { opacity: .45; cursor: default; }
.dsh-alink-list-tools { display: flex; justify-content: space-between; align-items: center; color: var(--link-muted); font-size: 12px; margin: 12px 0; }
.dsh-alink-list-tools label { display: flex; align-items: center; gap: 8px; }
.dsh-alink-session-row { display: flex; align-items: center; gap: 2px; border: 0; border-radius: 9px; padding: 2px 5px; min-width: 0; transition: background .12s; }
.dsh-alink-session-row:hover { background: color-mix(in srgb,currentColor 4%,transparent); }
.dsh-alink-session-row.selected { background: var(--link-tint); color: var(--link-accent); }
.dsh-alink-project-sessions .dsh-alink-session-row button { flex: 1; min-width: 0; width: auto; padding: 8px 5px; border: 0; border-radius: 6px; background: none; font-size: 12px; }
.dsh-alink-session-row button>span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-alink-selection-heading { display: flex; align-items: start; gap: 12px; justify-content: space-between; }
.dsh-alink-selection-heading button { font-size: 11px; padding: 3px 7px; flex-shrink: 0; }
.dsh-alink-picked { list-style: none; padding: 0; margin: 0 0 18px; max-height: 150px; overflow: auto; }
.dsh-alink-picked li { display: flex; align-items: center; gap: 8px; padding: 7px 0; font-size: 12px; }
.dsh-alink-picked li>span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-alink-picked small { color: var(--link-muted); }
.dsh-alink-picked button { border: 0; padding: 0 6px; font-size: 18px; line-height: 1; }
.dsh-alink-unified { margin: 0 0 16px; }
.dsh-alink-primary-actions { padding-top: 4px; }
.dsh-alink-primary-actions button { flex: 1; min-height: 42px; }
.dsh-alink-inspect { margin-top: 24px; border-top: 1px solid var(--link-line); }
.dsh-alink-preview-actions h3 { min-width: 0; overflow-wrap: anywhere; flex: 1; }
.dsh-alink-preview-actions button { flex-shrink: 0; }
.dsh-alink-transfer { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px 16px; margin: 0 0 16px; border: 1px solid var(--link-line); border-radius: 10px; background: color-mix(in srgb,currentColor 2%,Canvas); }
.dsh-alink-transfer>div:first-child { display: grid; gap: 5px; min-width: 0; }
.dsh-alink-transfer strong { font-size: 13px; }
.dsh-alink-transfer span, .dsh-alink-transfer small { font-size: 12px; color: var(--link-muted); overflow-wrap: anywhere; }
.dsh-alink-task-actions { flex-shrink: 0; max-width: 50%; justify-content: flex-end; }
.dsh-alink-local { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr) auto; align-items: end; gap: 12px; border: 1px solid var(--link-line); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
.dsh-alink-local input[type=file] { font-size: 11px; }
.dsh-alink-operations { margin-top: 0; }
@container (max-width: 760px) {
  .dsh-alink-columns { grid-template-columns: minmax(0,1fr); }
  .dsh-alink-sources { border-right: 0; border-bottom: 1px solid var(--link-line); }
  .dsh-alink-session-list { max-height: 280px; }
  .dsh-alink-local { grid-template-columns: minmax(0,1fr); }
  .dsh-alink-transfer { align-items: stretch; flex-direction: column; }
  .dsh-alink-task-actions { max-width: none; justify-content: flex-start; }
}
@media (max-width: 600px) { .dsh-alink-header-actions { width: 100%; } .dsh-alink-header-actions button { flex: 1; } }

.dsh-alink-toast { position: fixed; z-index: 1000; right: 24px; bottom: 24px; display: flex; align-items: center; gap: 11px; width: max-content; max-width: min(420px,calc(100vw - 32px)); padding: 13px 14px; border: 1px solid var(--link-line); border-radius: 14px; color: CanvasText; background: color-mix(in srgb,Canvas 90%,transparent); backdrop-filter: blur(20px); box-shadow: 0 8px 32px #0002, 0 1px 4px #0001; animation: alink-toast-in .2s ease-out; }
.dsh-alink-toast-icon { display: grid; place-items: center; flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; color: white; background: #30a46c; font-size: 14px; font-weight: 600; }
.dsh-alink-toast.is-error .dsh-alink-toast-icon { background: #d27b21; }
.dsh-alink-toast strong { font-size: 13px; font-weight: 600; }
.dsh-alink-toast p { margin: 3px 0 0; color: var(--link-muted); font-size: 12px; overflow-wrap: anywhere; }
.dsh-alink-toast button { border: 0; padding: 2px 5px; color: var(--link-muted); font-size: 18px; margin-left: 6px; }
.dsh-alink-reading { min-height: 180px; display: flex; flex-wrap: wrap; align-content: center; justify-content: center; align-items: center; gap: 10px; border-radius: 12px; background: var(--link-group); color: var(--link-muted); font-size: 12px; }
.dsh-alink-spinner { width: 18px; height: 18px; border: 2px solid color-mix(in srgb,currentColor 15%,transparent); border-top-color: var(--link-accent); border-radius: 50%; animation: alink-spin .75s linear infinite; }
.dsh-alink-skeleton { width: 100%; display: grid; gap: 8px; padding: 18px 24px 0; }
.dsh-alink-skeleton i { height: 7px; border-radius: 5px; background: color-mix(in srgb,currentColor 7%,transparent); }
.dsh-alink-skeleton i:nth-child(2) { width: 88%; }.dsh-alink-skeleton i:nth-child(3) { width: 63%; }
.dsh-alink-read-error { font-size: 12px; color: var(--link-muted); padding: 18px; border-radius: 12px; background: var(--link-group); }
.dsh-alink-operations button.dsh-alink-record-title { padding: 0; border: 0; text-align: left; font-weight: 600; }
.dsh-alink-task-result { border: 1px solid var(--link-line); border-radius: 10px; padding: 12px; margin-bottom: 12px; font-size: 12px; }
.dsh-alink-task-result summary { cursor: pointer; }.dsh-alink-task-result p { color: var(--link-muted); }
@keyframes alink-spin { to { transform: rotate(360deg); } }
@keyframes alink-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .dsh-alink-spinner,.dsh-alink-toast { animation: none; }.dsh-alink-chevron { transition: none; } }

/* The selection inspector uses grouped controls and compact trailing actions. */
.dsh-alink-selection-heading { align-items: center; margin-bottom: 14px; }
.dsh-alink-selection-heading h2 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -.2px; }
.dsh-alink-selection-heading button { border: 0; background: transparent; color: var(--link-accent); font-size: 12px; padding: 5px 0 5px 10px; }
.dsh-alink-picked { margin: 0 0 16px; border: 1px solid var(--link-line); border-radius: 12px; background: var(--link-group); }
.dsh-alink-picked li { min-height: 42px; padding: 9px 12px; border-bottom: 1px solid var(--link-line); }
.dsh-alink-picked li:last-child { border-bottom: 0; }
.dsh-alink-picked small { border-radius: 5px; padding: 2px 5px; background: color-mix(in srgb,currentColor 5%,Canvas); font-size: 10px; }
.dsh-alink-picked button { display: grid; place-items: center; flex-shrink: 0; width: 22px; height: 22px; padding: 0; border-radius: 50%; background: color-mix(in srgb,currentColor 6%,transparent); color: var(--link-muted); font-size: 15px; }
.dsh-alink-targets { grid-template-columns: minmax(0,1fr); gap: 0; margin-bottom: 16px; border: 1px solid var(--link-line); border-radius: 12px; background: var(--link-group); overflow: hidden; }
.dsh-alink-targets>label { display: grid; grid-template-columns: 90px minmax(0,1fr); align-items: center; gap: 12px; padding: 5px 12px; font-size: 12px; font-weight: 500; }
.dsh-alink-targets>label+label { border-top: 1px solid var(--link-line); }
.dsh-alink-targets select { margin: 0; border-color: transparent; background-color: transparent; text-align: right; text-align-last: right; border-radius: 7px; }
.dsh-alink-targets select:hover { background-color: color-mix(in srgb,currentColor 3%,Canvas); }
.dsh-alink-unified { padding: 12px; border: 1px solid var(--link-line); border-radius: 12px; background: var(--link-group); }
.dsh-alink-primary-actions { justify-content: flex-end; padding-top: 2px; gap: 10px; }
.dsh-alink-primary-actions button { flex: 0 1 auto; min-width: 136px; min-height: 40px; padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 500; background: var(--link-group); }
.dsh-alink-primary-actions button.primary { background: var(--link-action); border-color: var(--link-action); color: white; box-shadow: 0 1px 2px #0001; }
.dsh-alink-primary-actions button.primary:hover { background: #005fc9; }
@container (max-width: 460px) { .dsh-alink-targets>label { grid-template-columns: minmax(0,1fr); gap: 0; padding-top: 10px; }.dsh-alink-targets select { text-align: left; text-align-last: left; padding-left: 0; }.dsh-alink-primary-actions button { flex: 1; min-width: 0; padding-inline: 10px; } }
`;

// src/client/index.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var name = "dsh-alink-client";
var inject = ["slots", "connection", "sessions", "uiWorkspace", "layout"];
function apply(ctx) {
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "dsh-alink";
    style.textContent = styles_default;
    document.head.append(style);
    return () => style.remove();
  });
  ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: "dsh-alink" }, () => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MigrationPanel, { ctx })));
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({ name: "sidebar.panellist", id: "dsh-alink", label: "Alink", order: 50 }, () => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { "aria-hidden": "true", children: "\u21E5" })));
}

return module.exports;}});
