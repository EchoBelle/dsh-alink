import { openHarness } from '../helpers/browser.js';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';

test.skip(!!process.env.DSH_ALINK_DISABLED, 'Enabled-plugin check');
test('installs one native migration panel and survives navigation', async ({ page }) => {
  const note = (s: string) => appendFileSync('.local/verification/browser.log', s + '\n');
  page.on('console', m => { if (m.type() === 'error') note(m.text().slice(0, 1200)); });
  page.on('pageerror', e => note(String(e)));
  note('page created');
  const { url } = JSON.parse(await readFile((process.env.DSH_ALINK_TEST_HOME || '.local/dsh-alink-contract-home') + '/host.json', 'utf8'));
  await openHarness(page, url);
  note('document loaded');
  await expect(page.getByRole('button', { name: '会话迁移', exact: true })).toBeVisible({ timeout: 20000 });
  note('button visible');
  await page.getByRole('button', { name: '会话迁移', exact: true }).click({ timeout: 10000 });
  note('button clicked');
  await expect(page.getByRole('heading', { name: '会话迁移', exact: true })).toBeVisible();
  await expect(page.getByText('仅显示未归档且当前有效的会话')).toBeVisible();
  await page.screenshot({ path: '.local/verification/plugin-panel.png' });
  const result = JSON.parse(await readFile((process.env.DSH_ALINK_TEST_HOME || '.local/dsh-alink-contract-home') + '/continuation-result.json', 'utf8'));
  expect(result.passed).toBe(true);
  expect(result.coldRead).toBe(true);
  await page.getByRole('treeitem').filter({ hasText: result.title.title }).first().click();
  await expect(page.getByText('续聊已读取：海星', { exact: true })).toBeVisible();
});
