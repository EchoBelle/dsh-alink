import { openHarness } from '../helpers/browser.js';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.skip(!process.env.DSH_ALINK_PACKAGE_MATRIX, 'Clean package matrix only');
test('installs one native migration panel and survives navigation', async ({ page }) => {
  const { url } = JSON.parse(await readFile(process.env.DSH_ALINK_TEST_HOME + '/host.json', 'utf8'));
  await openHarness(page, url);
  await expect(page.getByRole('button', { name: '会话迁移', exact: true })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: '会话迁移', exact: true }).click({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: '会话迁移', exact: true })).toBeVisible();
  await expect(page.getByText('仅显示未归档且当前有效的会话')).toBeVisible();
  await page.screenshot({ path: '.local/verification/plugin-panel.png' });
  await page.getByRole('treeitem').filter({ hasText: 'Codex 活动会话' }).first().click();
  await expect(page.getByText('已记录海星。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '会话迁移', exact: true }).click();
  await expect(page.getByRole('heading', { name: '会话迁移', exact: true })).toHaveCount(1);
});
