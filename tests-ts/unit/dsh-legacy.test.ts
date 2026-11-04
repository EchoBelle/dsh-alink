import { expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { zstdCompressSync } from 'node:zlib';
import { SourceRegistry } from '../../src/sources/registry.js';
import { sourceKey } from '../../src/sources/types.js';
import { readEvents } from '../../src/archive.js';

it('only admits a legacy DSH file whose source archive registry proves it active', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-alink-v0-'));
  try {
    await mkdir(path.join(root, 'sessions/project/s1'), { recursive: true }); await mkdir(path.join(root, 'storages'));
    const source = path.join(root, 'sessions/project/s1/session.jsonl.zstd');
    const rows = [{ type: 'session', version: 0, id: 's1', cwd: root }, { type: 'user/message', seq: 0, time: 1000, data: { content: [{ type: 'text', text: 'old history' }] } }];
    await writeFile(source, zstdCompressSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n'));
    const state = path.join(root, 'storages/workspace.json');
    await writeFile(state, JSON.stringify({ unit: { name: 'workspace', version: 2 }, global: { archivedSessionIds: [] } }));
    const registry = new SourceRegistry({ dsh: root });
    expect((await registry.sessions('dsh')).items).toEqual([]);
    const capture = await registry.capture(sourceKey('dsh', root, 's1'), path.join(root, 'capture'));
    expect((await readEvents(capture.archivePath)).find(e => e.kind === 'message')!.content[0].text).toBe('old history');
    await writeFile(state, JSON.stringify({ unit: { name: 'workspace', version: 2 }, global: { archivedSessionIds: ['s1'] } }));
    await expect(registry.assertActive(sourceKey('dsh', root, 's1'))).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
    await rm(state);
    await expect(registry.assertActive(sourceKey('dsh', root, 's1'))).rejects.toMatchObject({ code: 'SOURCE_INACTIVE' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
