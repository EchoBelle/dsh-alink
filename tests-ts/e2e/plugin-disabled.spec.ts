import { openHarness } from '../helpers/browser.js';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test.skip(!process.env.DSH_ALINK_DISABLED, 'Run with the isolated plugin removed');
test('imported native conversation remains readable without dsh-alink', async ({ page }) => {
  const { url } = JSON.parse(await readFile((process.env.DSH_ALINK_TEST_HOME || '.local/dsh-alink-contract-home') + '/host.json', 'utf8'));
  const result = JSON.parse(await readFile((process.env.DSH_ALINK_TEST_HOME || '.local/dsh-alink-contract-home') + '/continuation-result.json', 'utf8'));
  await openHarness(page, url);
  await expect(page.getByRole('button', { name: 'Plugins', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '会话迁移', exact: true })).toHaveCount(0);
  await page.getByRole('treeitem').filter({ hasText: result.title.title }).first().click();
  await expect(page.getByText('续聊已读取：海星', { exact: true })).toBeVisible();
});
