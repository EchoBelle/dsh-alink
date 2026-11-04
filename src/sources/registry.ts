import path from 'node:path';
import os from 'node:os';
import { stat } from 'node:fs/promises';
import { LinkError } from '../transport.js';
import type { CaptureResult, Page, SourceApp, SourceSession } from '../contracts.js';
import type { SourceLocator, SourceRoots } from './types.js';
import { discoverWorkBuddy, captureWorkBuddy } from './workbuddy.js';
import { discoverLegacy, captureLegacy } from './dsh-legacy.js';
import { discoverRaccoon, captureRaccoon } from './raccoon.js';
import { discoverCursor, captureCursor } from './cursor.js';
import { discoverCodex, captureCodex } from './codex.js';
export function defaultRoots(): SourceRoots {
  const home = os.homedir(); return { workbuddy: path.join(home, '.workbuddy'), codex: path.join(home, '.codex'), dsh: path.join(home, '.dsh'),
    raccoon: path.join(home, 'Library/Application Support/office-raccoon'), cursor: path.join(home, 'Library/Application Support/Cursor') };
}
export class SourceRegistry {
  constructor(readonly roots: SourceRoots = defaultRoots(), readonly resourceRoots: readonly string[] = []) {}
  private async discover(app: SourceApp): Promise<SourceLocator[]> {
    const root = this.roots[app];
    if (!root || !await stat(root).catch(() => undefined)) return [];
    if (app === 'workbuddy') return discoverWorkBuddy(path.resolve(root));
    if (app === 'codex') return discoverCodex(path.resolve(root));
    if (app === 'raccoon') return discoverRaccoon(path.resolve(root));
    if (app === 'cursor') return discoverCursor(path.resolve(root));
    if (app === 'dsh') return discoverLegacy(path.resolve(root));
    return [];
  }
  async sources() {
    const result = [];
    for (const app of ['workbuddy', 'codex', 'raccoon', 'cursor'] as const) {
      try { const rows = await this.discover(app); result.push({ app, available: !!this.roots[app] && !!await stat(this.roots[app]!).catch(() => undefined), count: rows.filter(r => r.eligibility === 'active').length, unknown: rows.some(r => r.eligibility === 'unknown') }); }
      catch { result.push({ app, available: false, count: 0, error: '来源结构不支持或当前无法读取' }); }
    }
    return result;
  }
  async sessions(app: SourceApp, query: { text?: string; cursor?: string; limit?: number } = {}): Promise<Page<SourceSession>> {
    if (!['workbuddy', 'codex', 'raccoon', 'cursor', 'dsh'].includes(app)) throw new LinkError('INVALID_SOURCE');
    if (app === 'dsh') return { items: [] };
    const limit = query.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new LinkError('INVALID_QUERY');
    let offset = 0;
    if (query.cursor) {
      try { const cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString());
        if (cursor.app !== app || cursor.text !== (query.text ?? '') || !Number.isSafeInteger(cursor.offset) || cursor.offset < 0) throw new Error(); offset = cursor.offset;
      } catch { throw new LinkError('INVALID_CURSOR'); }
    }
    const rows = (await this.discover(app)).filter(s => s.eligibility === 'active' && (!query.text || (s.title + '\n' + s.cwd).toLowerCase().includes(query.text.toLowerCase())))
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || a.sourceId.localeCompare(b.sourceId));
    const items = rows.slice(offset, offset + limit).map(({ root: _root, file: _file, eligibility: _eligibility, ...publicFields }) => publicFields);
    return { items, ...(offset + limit < rows.length ? { nextCursor: Buffer.from(JSON.stringify({ app, text: query.text ?? '', offset: offset + limit })).toString('base64url') } : {}) };
  }
  async assertActive(sourceId: string): Promise<SourceLocator> {
    if (!/^(workbuddy|codex|raccoon|cursor|dsh):[a-f0-9]{32}$/.test(sourceId)) throw new LinkError('INVALID_SOURCE');
    const app = sourceId.split(':')[0] as SourceApp;
    const source = (await this.discover(app)).find(s => s.sourceId === sourceId);
    if (!source) throw new LinkError('SOURCE_INACTIVE', '原会话已不存在或无法核实当前状态');
    if (source.eligibility !== 'active') throw new LinkError('SOURCE_INACTIVE', '原会话已归档、删除或当前状态无法核实');
    return { ...source, resourceRoots: this.resourceRoots };
  }
  async capture(sourceId: string, destination: string, signal?: AbortSignal): Promise<CaptureResult> {
    const source = await this.assertActive(sourceId);
    const result = source.app === 'workbuddy' ? await captureWorkBuddy(source, destination, signal)
      : source.app === 'codex' ? await captureCodex(source, destination, signal)
      : source.app === 'raccoon' ? await captureRaccoon(source, destination, signal)
      : source.app === 'cursor' ? await captureCursor(source, destination, signal)
      : source.app === 'dsh' ? await captureLegacy(source, destination, signal) : undefined;
    if (!result) throw new LinkError('UNSUPPORTED_SOURCE');
    await this.assertActive(sourceId);
    return result;
  }
}
