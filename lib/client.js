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
async function call(_ctx, endpoint, payload = {}, signal) {
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

// src/client/MigrationPanel.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var names = { workbuddy: "WorkBuddy", codex: "Codex", raccoon: "\u5C0F\u6D63\u718A", cursor: "Cursor", dsh: "DSH" };
var states = { prepared: "\u6392\u961F\u4E2D", writing: "\u8FC1\u5165\u4E2D", verifying: "\u6838\u5BF9\u4E2D", completed: "\u8FC1\u79FB\u5B8C\u6210", failed: "\u8FC1\u79FB\u5931\u8D25", canceled: "\u5DF2\u53D6\u6D88", "needs-attention": "\u9700\u8981\u6838\u5BF9" };
var labels = { native: "\u539F\u751F\u8FC1\u5165", rendered: "\u5386\u53F2\u8BF4\u660E", "archive-only": "\u4EC5\u4FDD\u7559\u5907\u4EFD", missing: "\u8D44\u6E90\u7F3A\u5931", blocked: "\u9700\u8981\u5904\u7406" };
var issueCopy = {
  tool_history: "\u5DE5\u5177\u53C2\u6570\u4E0E\u7ED3\u679C\u8F6C\u6210\u5386\u53F2\u8BF4\u660E\uFF0C\u4E0D\u6267\u884C\u5DE5\u5177\u3002",
  inactive_or_auxiliary: "\u9690\u85CF\u3001\u65E7\u7248\u672C\u548C\u8F85\u52A9\u8BB0\u5F55\u53EA\u4FDD\u7559\u5728\u5907\u4EFD\u4E2D\u3002",
  unsupported_event: "\u6765\u6E90\u79C1\u6709\u5185\u5BB9\u6216\u7279\u6B8A\u89D2\u8272\u53EA\u4FDD\u7559\u5728\u5907\u4EFD\u4E2D\u3002",
  unsupported_block: "\u4E0D\u652F\u6301\u7684\u5185\u5BB9\u5757\u53EA\u4FDD\u7559\u5728\u5907\u4EFD\u4E2D\u3002",
  resource_discovery_scope: "\u53EA\u6536\u96C6\u53EF\u8BC6\u522B\u4E14\u4F4D\u4E8E\u5141\u8BB8\u76EE\u5F55\u4E2D\u7684\u8D44\u6E90\u3002",
  multi_store_snapshot: "\u65E5\u5FD7\u4E0E\u7D22\u5F15\u5206\u522B\u6355\u83B7\uFF0C\u53EF\u80FD\u4E0D\u5C5E\u4E8E\u5B8C\u5168\u76F8\u540C\u7684\u65F6\u523B\u3002",
  native_cards: "\u6765\u6E90\u5E94\u7528\u7684\u4E13\u7528\u5361\u7247\u4FDD\u7559\u5728\u539F\u59CB\u8BB0\u5F55\u4E2D\u3002",
  cursor_dependency_closure: "\u5171\u4EAB\u8D44\u6E90\u4E0E\u8DE8\u4F1A\u8BDD\u5F15\u7528\u672A\u88AB\u89C6\u4E3A\u5B8C\u6574\u6536\u96C6\u3002",
  unresolved_history: "\u65E0\u6CD5\u5B8C\u6574\u91CD\u5EFA\u6709\u6548\u4E0A\u4E0B\u6587\uFF0C\u9700\u8981\u5148\u5904\u7406\u6765\u6E90\u5386\u53F2\u3002",
  artifact_context: "\u5386\u53F2\u4EA7\u7269\u4EE5\u660E\u786E\u6807\u6CE8\u7684\u4E0A\u4E0B\u6587\u9644\u4EF6\u5173\u8054\u3002",
  reconstructed_history: "DSH \u7684\u8F6E\u6B21\u4E0E\u6D41\u5F0F\u5C55\u793A\u7531\u539F\u6587\u91CD\u5EFA\uFF0C\u4E0D\u4EE3\u8868\u6765\u6E90\u4E2D\u7684\u539F\u751F\u6267\u884C\u4E8B\u4EF6\u3002",
  reconstructed_stream: "\u6765\u6E90\u672A\u63D0\u4F9B\u53EF\u590D\u7528\u7684\u6D41\u5F0F\u8BB0\u5F55\uFF0CDSH \u5C55\u793A\u7ED3\u6784\u7531\u6B63\u6587\u91CD\u5EFA\u3002"
};
function MigrationPanel({ ctx }) {
  const [sources, setSources] = (0, import_react.useState)([]), [targets, setTargets] = (0, import_react.useState)({ workspaces: [], presets: [], defaultPreset: "" });
  const [app, setApp] = (0, import_react.useState)("workbuddy"), [query, setQuery] = (0, import_react.useState)("");
  const [sessions, setSessions] = (0, import_react.useState)([]), [cursor, setCursor] = (0, import_react.useState)();
  const [selected, setSelected] = (0, import_react.useState)(), [cwd, setCwd] = (0, import_react.useState)(""), [preset, setPreset] = (0, import_react.useState)("");
  const [preview, setPreview] = (0, import_react.useState)(), [messages, setMessages] = (0, import_react.useState)([]), [total, setTotal] = (0, import_react.useState)(0);
  const [operations, setOperations] = (0, import_react.useState)([]), [error, setError] = (0, import_react.useState)(""), [busy, setBusy] = (0, import_react.useState)(false), [loading, setLoading] = (0, import_react.useState)(false);
  const [revision, setRevision] = (0, import_react.useState)(0), [issueLimit, setIssueLimit] = (0, import_react.useState)(100), [reviewOnly, setReviewOnly] = (0, import_react.useState)(false);
  const [directory, setDirectory] = (0, import_react.useState)("");
  const requestId = (0, import_react.useRef)(""), action = (0, import_react.useRef)(void 0), mounted = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      action.current?.abort();
    };
  }, []);
  const invalidate = () => {
    action.current?.abort();
    setBusy(false);
    setPreview(void 0);
    setMessages([]);
    requestId.current = "";
    setReviewOnly(false);
    setError("");
  };
  (0, import_react.useEffect)(() => {
    const controller = new AbortController();
    Promise.all([call(ctx, "sources", {}, controller.signal), call(ctx, "targets", {}, controller.signal), call(ctx, "operations", {}, controller.signal)]).then(([sourceList, targetList, jobs]) => {
      if (controller.signal.aborted) return;
      setSources(sourceList);
      setTargets(targetList);
      setOperations(jobs);
      setPreset((value) => value || targetList.defaultPreset);
    }).catch((e) => {
      if (!controller.signal.aborted) setError(friendlyError(e));
    });
    return () => controller.abort();
  }, [ctx, revision]);
  (0, import_react.useEffect)(() => {
    const controller = new AbortController();
    setLoading(true);
    call(ctx, "sessions", { app, text: query, limit: 50 }, controller.signal).then((page) => {
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
  }, [ctx, app, query, revision]);
  const active = operations.some((o) => ["prepared", "writing", "verifying"].includes(o.state));
  (0, import_react.useEffect)(() => {
    if (!active) return;
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      try {
        if (!document.hidden) setOperations(await call(ctx, "operations", {}, controller.signal));
      } catch (e) {
        if (!controller.signal.aborted) setError(friendlyError(e));
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 500);
    };
    timer = setTimeout(poll, 500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [ctx, active]);
  async function perform(work) {
    action.current?.abort();
    const controller = new AbortController();
    action.current = controller;
    setBusy(true);
    setError("");
    try {
      await work(controller.signal);
    } catch (e) {
      if (!controller.signal.aborted && mounted.current) setError(friendlyError(e));
    } finally {
      if (!controller.signal.aborted && mounted.current) setBusy(false);
    }
  }
  function choose(source) {
    invalidate();
    setSelected(source);
    setCwd(source.cwd || "");
  }
  async function prepare(signal) {
    if (!selected) return;
    const value = await call(ctx, "preview", { sourceId: selected.sourceId, target: { cwd, agentPreset: preset } }, signal);
    const page = await call(ctx, "previewPage", { previewId: value.previewId, offset: 0 }, signal);
    if (signal.aborted) return;
    setPreview(value);
    setMessages(page.items);
    setTotal(page.total);
    setReviewOnly(false);
    setIssueLimit(100);
    requestId.current = crypto.randomUUID();
  }
  async function commit(signal) {
    if (!preview) return;
    const op = await call(ctx, "commit", { previewId: preview.previewId, reportHash: preview.report.reportHash, requestId: requestId.current || (requestId.current = crypto.randomUUID()) }, signal);
    setOperations((old) => [op, ...old.filter((o) => o.operationId !== op.operationId)]);
  }
  function reportDownload() {
    if (!preview) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(preview, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "dsh-alink-report.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  async function upload(file, signal) {
    const format = file.name.endsWith(".zip") ? "alink" : "dsh";
    const response = await fetch(`api/dsh-alink.upload?format=${format}&filename=${encodeURIComponent(file.name)}`, { method: "POST", credentials: "same-origin", body: file, signal });
    const result = await response.json();
    if (!result.ok) throw Object.assign(new Error(result.error.message), { code: result.error.code });
    choose(result.value);
  }
  const differences = preview?.report.issues.filter((i) => i.disposition !== "native") ?? [];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsh-alink", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "dsh-alink-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "\u4F1A\u8BDD\u8FC1\u79FB" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u5C06\u5DF2\u6709\u5BF9\u8BDD\u5E26\u5165 DSH\uFF0C\u63A5\u7740\u5B8C\u6210\u5DE5\u4F5C\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => {
        invalidate();
        setRevision((v) => v + 1);
      }, children: "\u5237\u65B0\u6765\u6E90" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-alink-note", children: "\u4EC5\u663E\u793A\u672A\u5F52\u6863\u4E14\u5F53\u524D\u6709\u6548\u7684\u4F1A\u8BDD" }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-alink-error", role: "alert", children: error }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-columns", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", { className: "dsh-alink-sources", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
          "\u6765\u6E90\u5E94\u7528",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { "aria-label": "\u6765\u6E90\u5E94\u7528", value: app, onChange: (e) => {
            invalidate();
            setSelected(void 0);
            setApp(e.target.value);
          }, children: ["workbuddy", "codex", "raccoon", "cursor"].map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: id, children: [
            names[id],
            " \xB7 ",
            sources.find((s) => s.app === id)?.count ?? 0,
            " \u4E2A\u6709\u6548\u4F1A\u8BDD"
          ] }, id)) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { "aria-label": "\u641C\u7D22\u6765\u6E90\u4F1A\u8BDD", placeholder: "\u641C\u7D22\u4F1A\u8BDD\u6216\u9879\u76EE", value: query, onChange: (e) => {
          invalidate();
          setSelected(void 0);
          setQuery(e.target.value);
        } }),
        sources.find((s) => s.app === app)?.error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-alink-note", children: "\u6765\u6E90\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u6216\u5B58\u50A8\u683C\u5F0F\u5C1A\u672A\u652F\u6301\u3002" }),
        sources.find((s) => s.app === app)?.unknown && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-alink-note", children: "\u90E8\u5206\u4F1A\u8BDD\u7684\u5F52\u6863\u72B6\u6001\u65E0\u6CD5\u6838\u5B9E\uFF0C\u5DF2\u6392\u9664\u3002" }),
        loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u4F1A\u8BDD\u5217\u8868\u2026" }) : !sessions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-alink-empty", children: "\u6CA1\u6709\u53EF\u8FC1\u79FB\u7684\u6709\u6548\u4F1A\u8BDD\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-alink-session-list", children: sessions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { "aria-label": "\u6253\u5F00\u9884\u89C8\uFF1A" + s.title, className: selected?.sourceId === s.sourceId ? "selected" : "", onClick: () => choose(s), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: s.title }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { title: s.cwd, children: s.cwd || "\u672A\u5173\u8054\u672C\u673A\u9879\u76EE" })
        ] }, s.sourceId)) }),
        cursor && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => void perform(async (signal) => {
          const page = await call(ctx, "sessions", { app, text: query, cursor, limit: 50 }, signal);
          setSessions((old) => [...old, ...page.items]);
          setCursor(page.nextCursor);
        }), children: "\u52A0\u8F7D\u66F4\u591A\u4F1A\u8BDD" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: "dsh-alink-import", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: "\u4ECE\u5907\u4EFD\u5BFC\u5165" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u5907\u4EFD\u5FC5\u987B\u80FD\u5173\u8054\u5230\u539F\u5E94\u7528\u4E2D\u4ECD\u6709\u6548\u7684\u4F1A\u8BDD\u3002" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsh-alink-file", children: [
            "\u9009\u62E9 ALink ZIP \u6216\u65E7 DSH \u65E5\u5FD7",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { "aria-label": "\u5907\u4EFD\u6587\u4EF6", type: "file", accept: ".zip,.jsonl,.zstd", onChange: (e) => {
              const file = e.target.files?.[0];
              if (file) void perform((signal) => upload(file, signal));
              e.target.value = "";
            } })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
            "DSH \u6240\u5728\u7535\u8111\u4E0A\u7684\u5907\u4EFD\u76EE\u5F55",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { "aria-label": "\u5907\u4EFD\u76EE\u5F55", value: directory, onChange: (e) => setDirectory(e.target.value), placeholder: "\u5DF2\u6709 .alink \u76EE\u5F55\u7684\u5B8C\u6574\u8DEF\u5F84" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: !directory || busy, onClick: () => void perform(async (signal) => {
            choose(await call(ctx, "registerFile", { path: directory, format: "alink" }, signal));
          }), children: "\u8BFB\u53D6\u5907\u4EFD\u76EE\u5F55" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", { className: "dsh-alink-preview", children: !selected && !preview ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-empty", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u9009\u62E9\u4E00\u6761\u4F1A\u8BDD" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u5148\u67E5\u770B\u5185\u5BB9\u4E0E\u8FC1\u79FB\u5DEE\u5F02\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u5BFC\u5165\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u5BFC\u5165\u4F1A\u65B0\u589E\u72EC\u7ACB\u4F1A\u8BDD\uFF0C\u539F\u5E94\u7528\u7684\u6570\u636E\u4FDD\u6301\u4E0D\u53D8\u3002" })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        selected && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: selected.title }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-targets", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
              "\u76EE\u6807\u9879\u76EE\u76EE\u5F55",
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { "aria-label": "\u76EE\u6807\u9879\u76EE\u76EE\u5F55", list: "dsh-alink-workspaces", value: cwd, onChange: (e) => {
                invalidate();
                setCwd(e.target.value);
              }, placeholder: "\u9009\u62E9\u6216\u586B\u5199\u5DF2\u5B58\u5728\u7684\u76EE\u5F55" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", { id: "dsh-alink-workspaces", children: targets.workspaces.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: w.path, children: w.title }, w.id)) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
              "DSH \u914D\u7F6E",
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { "aria-label": "DSH \u914D\u7F6E", value: preset, onChange: (e) => {
                invalidate();
                setPreset(e.target.value);
              }, children: targets.presets.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: p.id, disabled: !!p.broken, children: [
                p.name || { standard: "\u6807\u51C6\u6A21\u5F0F", minimal: "\u7CBE\u7B80\u6A21\u5F0F", cordis: "Cordis \u6A21\u5F0F", ptc: "PTC \u6A21\u5F0F" }[p.id] || p.id,
                p.broken ? "\uFF08\u4E0D\u53EF\u7528\uFF09" : ""
              ] }, p.id)) })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "primary", disabled: busy || !cwd || !preset, onClick: () => void perform(prepare), children: busy && !preview ? "\u6B63\u5728\u51C6\u5907\u2026" : "\u751F\u6210\u8FC1\u79FB\u9884\u89C8" })
        ] }),
        preview && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-alink-counts", children: Object.entries(preview.report.counts).filter(([, n]) => n > 0).map(([key, count]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: key === "blocked" ? "blocked" : "", children: [
            labels[key],
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: count }),
            " \u9879"
          ] }, key)) }),
          differences.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { open: true, className: "dsh-alink-differences", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", { children: [
              "\u8FC1\u79FB\u5DEE\u5F02 \xB7 ",
              differences.length,
              " \u9879"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: differences.slice(0, issueLimit).map((i, n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: labels[i.disposition] }),
              " ",
              issueCopy[i.code] || i.detail
            ] }, n)) }),
            differences.length > issueLimit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setIssueLimit((v) => v + 100), children: "\u663E\u793A\u66F4\u591A\u5DEE\u5F02" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-preview-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
              total,
              " \u6761\u8FC1\u5165\u540E\u5386\u53F2"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: reportDownload, children: "\u4FDD\u5B58\u62A5\u544A" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-alink-messages", children: messages.map((m, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { className: m.role, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: m.role === "user" ? "\u7528\u6237 / \u5386\u53F2\u4E0A\u4E0B\u6587" : "\u52A9\u624B / \u5386\u53F2\u8BF4\u660E" }),
            m.content.map((b, j) => b.type === "text" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { children: b.text }, j) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u{1F4CE} \u5386\u53F2\u9644\u4EF6" }, j))
          ] }, i)) }),
          messages.length < total && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => void perform(async (signal) => {
            const page = await call(ctx, "previewPage", { previewId: preview.previewId, offset: messages.length }, signal);
            setMessages((old) => [...old, ...page.items]);
          }), children: "\u67E5\u770B\u66F4\u591A\u5386\u53F2" }),
          !reviewOnly && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-submit", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u539F\u59CB\u8BB0\u5F55\u4E0E\u8D44\u6E90\u4FDD\u7559\u5728\u5907\u4EFD\u4E2D\u3002\u5DE5\u5177\u5386\u53F2\u4E0D\u4F1A\u88AB\u6267\u884C\u3002" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "primary", disabled: busy || preview.report.counts.blocked > 0 || active, onClick: () => void perform(commit), children: preview.report.counts.blocked ? "\u8BF7\u5148\u5904\u7406\u6765\u6E90\u5386\u53F2" : differences.length ? "\u6309\u4E0A\u8FF0\u5DEE\u5F02\u5BFC\u5165" : "\u5BFC\u5165\u4F1A\u8BDD" })
          ] })
        ] })
      ] }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsh-alink-operations", "aria-label": "\u8FC1\u79FB\u8BB0\u5F55", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u8FC1\u79FB\u8BB0\u5F55" }),
      !operations.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-alink-note", children: "\u5B8C\u6210\u4E00\u6B21\u8FC1\u79FB\u540E\uFF0C\u53EF\u4EE5\u5728\u8FD9\u91CC\u67E5\u770B\u7ED3\u679C\u3002" }),
      operations.map((op) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: op.title }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { role: "status", children: states[op.state] }),
          op.errorCode && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: friendlyError({ code: op.errorCode }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-alink-operation-actions", children: [
          op.state === "completed" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => void perform(() => openImportedSession(ctx, op.targetSessionId)), children: "\u6253\u5F00\u4F1A\u8BDD" }),
          ["failed", "needs-attention", "canceled"].includes(op.state) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: busy, onClick: () => void perform(async (signal) => {
            const page = await call(ctx, "previewPage", { previewId: op.previewId }, signal);
            if (!page.preview) return;
            const retry = await call(ctx, "commit", { previewId: op.previewId, reportHash: page.preview.report.reportHash, requestId: crypto.randomUUID() }, signal);
            setOperations((old) => old.map((o) => o.operationId === retry.operationId ? retry : o));
          }), children: "\u91CD\u65B0\u6838\u5BF9\u5E76\u91CD\u8BD5" }),
          ["prepared", "writing", "verifying"].includes(op.state) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => void perform(async (signal) => {
            await call(ctx, "cancel", { operationId: op.operationId }, signal);
          }), children: "\u8BF7\u6C42\u505C\u6B62" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => void perform(async (signal) => {
            const page = await call(ctx, "previewPage", { previewId: op.previewId }, signal);
            setSelected(void 0);
            setPreview(page.preview);
            setMessages(page.items);
            setTotal(page.total);
            setReviewOnly(true);
          }), children: "\u67E5\u770B\u62A5\u544A" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: "api/dsh-alink.archive?operationId=" + encodeURIComponent(op.operationId), download: true, children: "\u4FDD\u5B58\u5907\u4EFD" })
        ] })
      ] }, op.operationId))
    ] })
  ] });
}

// src/client/styles.css
var styles_default = ".dsh-alink{height:100%;overflow:auto;padding:28px;box-sizing:border-box;color:inherit;font:inherit;--link-line:color-mix(in srgb,currentColor 15%,transparent);--link-muted:color-mix(in srgb,currentColor 60%,transparent)}\n.dsh-alink *{box-sizing:border-box}.dsh-alink h1{font-size:26px;letter-spacing:-.5px;margin:0 0 6px}.dsh-alink h2{font-size:17px;margin:0 0 18px}.dsh-alink p{line-height:1.6}.dsh-alink-header{display:flex;justify-content:space-between;align-items:center;gap:20px}.dsh-alink-header p,.dsh-alink-note{color:var(--link-muted);font-size:13px;margin:0 0 16px}.dsh-alink-note{margin:12px 0 22px}\n.dsh-alink button,.dsh-alink input,.dsh-alink select,.dsh-alink-operation-actions a{font:inherit;font-size:13px;border:1px solid var(--link-line);border-radius:8px;padding:9px 12px;color:inherit;background:transparent}.dsh-alink button,.dsh-alink-operation-actions a{cursor:pointer;text-decoration:none}.dsh-alink button:hover{background:color-mix(in srgb,currentColor 6%,transparent)}.dsh-alink button:disabled{opacity:.45;cursor:default}.dsh-alink button.primary{background:CanvasText;color:Canvas;border-color:CanvasText}.dsh-alink input,.dsh-alink select{width:100%;margin-top:7px;background:Canvas}.dsh-alink label{font-size:12px;font-weight:500;display:block}.dsh-alink button:focus-visible,.dsh-alink input:focus-visible,.dsh-alink select:focus-visible{outline:2px solid Highlight;outline-offset:2px}\n.dsh-alink-columns{display:grid;grid-template-columns:minmax(220px,30%) minmax(0,1fr);border:1px solid var(--link-line);border-radius:12px;min-height:440px;overflow:hidden}.dsh-alink-sources{padding:18px;border-right:1px solid var(--link-line)}.dsh-alink-sources>input{margin:13px 0}.dsh-alink-session-list{display:grid;gap:5px;max-height:500px;overflow:auto}.dsh-alink-session-list button{text-align:left;border:1px solid transparent;padding:12px 10px;width:100%;display:grid;gap:6px}.dsh-alink-session-list button.selected{background:color-mix(in srgb,currentColor 7%,transparent);border-color:var(--link-line)}.dsh-alink-session-list strong{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-alink-session-list small{color:var(--link-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.dsh-alink-import{font-size:12px;margin-top:22px;border-top:1px solid var(--link-line);padding-top:16px}.dsh-alink-import summary{cursor:pointer}.dsh-alink-import p{color:var(--link-muted)}.dsh-alink-import label{margin-bottom:14px}.dsh-alink-file input{font-size:11px;max-width:100%}\n.dsh-alink-preview{padding:24px;min-width:0}.dsh-alink-empty{padding:28px 6px;color:var(--link-muted);font-size:13px}.dsh-alink-targets{display:grid;grid-template-columns:minmax(0,1fr) 160px;gap:14px;margin-bottom:15px}.dsh-alink-counts{display:flex;flex-wrap:wrap;gap:7px;margin:24px 0 14px}.dsh-alink-counts span{font-size:11px;background:color-mix(in srgb,currentColor 5%,transparent);border-radius:20px;padding:6px 10px}.dsh-alink-counts .blocked{color:#c43e32}.dsh-alink-differences{font-size:12px;border:1px solid var(--link-line);border-radius:8px;padding:12px}.dsh-alink-differences summary{cursor:pointer}.dsh-alink-differences ul{max-height:170px;overflow:auto;margin:12px 0;padding-left:20px;line-height:1.8;color:var(--link-muted)}.dsh-alink-differences b{font-weight:500}.dsh-alink-preview-actions{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--link-muted);margin:18px 0 12px}.dsh-alink-messages{max-height:430px;overflow:auto;border:1px solid var(--link-line);border-radius:9px}.dsh-alink-messages article{padding:14px 16px;border-bottom:1px solid var(--link-line)}.dsh-alink-messages article:last-child{border-bottom:0}.dsh-alink-messages small{font-size:11px;color:var(--link-muted)}.dsh-alink-messages pre{font:inherit;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;margin:9px 0 0}.dsh-alink-submit{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:20px}.dsh-alink-submit p{font-size:11px;color:var(--link-muted);max-width:60%}.dsh-alink-error{border:1px solid #c43e3260;background:#c43e320c;color:#c43e32;border-radius:9px;padding:12px 15px;margin-bottom:16px;font-size:13px}\n.dsh-alink-operations{margin-top:28px}.dsh-alink-operations article{border-top:1px solid var(--link-line);padding:16px 0;display:flex;align-items:center;justify-content:space-between;gap:12px}.dsh-alink-operations article>div:first-child{display:grid;gap:5px;font-size:13px}.dsh-alink-operations article span,.dsh-alink-operations article small{font-size:11px;color:var(--link-muted)}.dsh-alink-operation-actions{display:flex;flex-wrap:wrap;gap:6px}.dsh-alink-operation-actions button,.dsh-alink-operation-actions a{font-size:11px;padding:7px 9px}@media(max-width:850px){.dsh-alink{padding:18px}.dsh-alink-columns{grid-template-columns:1fr}.dsh-alink-sources{border-right:0;border-bottom:1px solid var(--link-line)}.dsh-alink-session-list{max-height:220px}.dsh-alink-targets{grid-template-columns:1fr}.dsh-alink-operations article{align-items:start;flex-direction:column}.dsh-alink-submit{align-items:stretch;flex-direction:column}.dsh-alink-submit p{max-width:none}}\n";

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
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({ name: "sidebar.panellist", id: "dsh-alink", label: "\u4F1A\u8BDD\u8FC1\u79FB", order: 50 }, () => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { "aria-hidden": "true", children: "\u21E5" })));
}

return module.exports;}});
