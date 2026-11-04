import { describe, expect, it } from 'vitest';
import { makeRpcHandler, validateRequest } from '../../src/transport.js';

describe('migration owner boundary', () => {
  it('refuses non-owner before calling the file-reading service', async () => {
    let reads = 0;
    const handler = makeRpcHandler(async () => { reads++; return []; });
    const result = await handler('sessions', {}, new AbortController().signal, { principal: { kind: 'guest' } } as never);
    expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(reads).toBe(0);
  });
});

it('rejects unknown endpoints and malformed commit payloads before dispatch', async () => {
  const { validateRequest } = await import('../../src/transport.js');
  expect(() => validateRequest({ endpoint: 'execute-shell', payload: {} })).toThrow();
  expect(() => validateRequest({ endpoint: 'commit', payload: { previewId: '../../x', reportHash: 123 } })).toThrow();
  expect(validateRequest({ endpoint: 'sessions', payload: { app: 'codex', limit: 50 } }).endpoint).toBe('sessions');
});

it('accepts bounded batch requests and rejects forged identifiers and archive overrides', () => {
  const source = 'codex:' + 'a'.repeat(32), requestId = '00000000-0000-4000-8000-000000000001';
  expect(validateRequest({ endpoint: 'importMany', payload: { requestId, sourceIds: [source], target: { agentPreset: 'standard' } } }).endpoint).toBe('importMany');
  for (const sourceIds of [[], ['__proto__'], ['../../outside'], [source, source]]) {
    expect(() => validateRequest({ endpoint: 'exportMany', payload: { requestId, sourceIds } })).toThrow();
  }
  expect(() => validateRequest({ endpoint: 'exportMany', payload: { requestId, sourceIds: [source], includeArchived: true } })).toThrow();
});
