import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection';

export class LinkError extends Error {
  constructor(readonly code: string, message = code) { super(message); }
}
export function makeRpcHandler(dispatch: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>): ConnectionRpcHandler {
  return async (endpoint, payload, signal, peer) => {
    if (peer.principal.kind !== 'owner') return { ok: false, error: { code: 'FORBIDDEN', message: '仅宿主所有者可迁移会话', details: {} } };
    try {
      signal.throwIfAborted();
      return { ok: true, value: await dispatch(endpoint, payload, signal) };
    } catch (error) {
      return { ok: false, error: { code: error instanceof LinkError ? error.code : 'IMPORT_FAILED',
        message: error instanceof LinkError ? error.message : '操作未完成，请查看迁移状态', details: {} } };
    }
  };
}

import { Ajv } from 'ajv';
const text = (maxLength = 4096) => ({ type: 'string', minLength: 1, maxLength });
const id = { ...text(36), pattern: '^[a-f0-9-]{36}$' };
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const target = object({ cwd: text(), agentPreset: text(128) });
const queryFields = { text: { type: 'string', maxLength: 300 }, cursor: text(4096), limit: { type: 'integer', minimum: 1, maximum: 100 } };
const requestSchemas: Record<string, unknown> = {
  sources: object({}), targets: object({}), operations: object({}),
  sessions: object({ app: { enum: ['workbuddy', 'codex', 'raccoon', 'cursor'] }, ...queryFields }, ['app']),
  preview: object({ sourceId: text(128), target }),
  previewPage: object({ previewId: id, offset: { type: 'integer', minimum: 0 } }, ['previewId']),
  commit: object({ previewId: id, reportHash: { ...text(64), pattern: '^[a-f0-9]{64}$' }, requestId: text(128) }),
  operation: object({ operationId: id }), cancel: object({ operationId: id }),
  registerFile: object({ path: text(), format: { enum: ['alink', 'dsh'] } }),
};
const ajv = new Ajv();
const validators = Object.fromEntries(Object.entries(requestSchemas).map(([key, schema]) => [key, ajv.compile(schema as object)]));
export function validateRequest(value: unknown): { endpoint: string; payload: Record<string, any> } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LinkError('INVALID_REQUEST');
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(k => k !== 'endpoint' && k !== 'payload') || typeof row.endpoint !== 'string' || !Object.hasOwn(validators, row.endpoint)) throw new LinkError('INVALID_REQUEST');
  if (!validators[row.endpoint](row.payload)) throw new LinkError('INVALID_REQUEST');
  return { endpoint: row.endpoint, payload: row.payload as Record<string, any> };
}
export function errorResult(error: unknown) {
  return { ok: false as const, error: { code: error instanceof LinkError ? error.code : 'IMPORT_FAILED',
    message: error instanceof LinkError ? error.message : '操作未完成，请查看迁移记录', details: {} } };
}
