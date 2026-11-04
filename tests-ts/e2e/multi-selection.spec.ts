import { expect, test } from '@playwright/test';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openHarness } from '../helpers/browser.js';

test.skip(!process.env.DSH_ALINK_PACKAGE_MATRIX, 'Clean package matrix only');
test('shows every selected conversation with separate pagination, collapse and retry', async ({ page }) => {
  const root = process.env.DSH_ALINK_TEST_HOME!, { url } = JSON.parse(await readFile(path.join(root, 'host.json'), 'utf8'));
  const ids = ['multi-a', 'multi-b', 'multi-c', 'multi-d'];
  const db = new DatabaseSync(path.join(root, 'sources/workbuddy/workbuddy.db'));
  const file = (id: string) => path.join(root, 'sources/workbuddy/projects/p', id + '.jsonl');
  const rows = (id: string) => Array.from({ length: 82 }, (_, index) => JSON.stringify({
    type: 'message', role: index % 2 ? 'assistant' : 'user', content: `${id} 对话 ${index}`, sessionId: id,
  })).join('\n') + '\n';
  try {
    for (const id of ids) {
      db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?,?)').run(id, id, root, 'completed', null, 0);
      await writeFile(file(id), rows(id));
    }
    await openHarness(page, url); await page.getByRole('button', { name: 'Alink', exact: true }).click();
    await page.getByRole('textbox', { name: '搜索来源会话', exact: true }).fill('multi-');
    await expect(page.getByRole('checkbox', { name: /^选择会话：multi-/ })).toHaveCount(4);
    await page.getByRole('checkbox', { name: '全选当前列表', exact: true }).check();
    const cards = page.locator('.dsh-alink-inspect');
    await expect(cards).toHaveCount(4);
    for (const id of ids) {
      const card = page.locator('.dsh-alink-inspect[aria-label="会话内容：' + id + '"]');
      await expect(card.getByRole('region', { name: '对话历史', exact: true })).toContainText(id + ' 对话 0');
      await expect(card.locator('article')).toHaveCount(80);
    }
    const first = page.locator('.dsh-alink-inspect').filter({ has: page.getByRole('heading', { name: 'multi-a', exact: true }) });
    await first.getByRole('button', { name: '加载更多对话', exact: true }).click();
    await expect(first.locator('article')).toHaveCount(82);
    await expect(first).toContainText('multi-a 对话 81');
    await first.locator('summary').click();
    await expect(first.getByRole('region', { name: '对话历史', exact: true })).toBeHidden();
    await first.locator('summary').click();
    await expect(first.locator('article')).toHaveCount(82);
    await page.getByRole('checkbox', { name: '选择会话：multi-b', exact: true }).uncheck();
    await expect(cards).toHaveCount(3);
    await expect(first.locator('article')).toHaveCount(82);
    await page.screenshot({ path: '.local/verification/alink-multi-dialogues.png' });
    // A source becoming unreadable affects only its own card; the others still load.
    await rm(file('multi-c'));
    await page.getByRole('button', { name: '刷新来源', exact: true }).click();
    const failed = cards.filter({ has: page.getByRole('heading', { name: 'multi-c', exact: true }) });
    await expect(failed.getByRole('button', { name: '重新读取', exact: true })).toBeVisible();
    await expect(first.locator('article')).toHaveCount(80);
    await writeFile(file('multi-c'), rows('multi-c'));
    await failed.getByRole('button', { name: '重新读取', exact: true }).click();
    await expect(failed.locator('article')).toHaveCount(80);
    await page.getByRole('button', { name: '清空选择', exact: true }).click();
    await expect(cards).toHaveCount(0);
  } finally {
    for (const id of ids) { db.prepare('DELETE FROM sessions WHERE id=?').run(id); await rm(file(id), { force: true }); }
    db.close();
  }
});
