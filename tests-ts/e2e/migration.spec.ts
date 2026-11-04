import { openHarness } from '../helpers/browser.js';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

test('only shows active source sessions and imports one into the native DSH conversation', async ({ page }) => {
  const root = path.resolve(process.env.DSH_ALINK_TEST_HOME || '.local/dsh-alink-contract-home');
  const { url } = JSON.parse(await readFile(path.join(root, 'host.json'), 'utf8'));
  await openHarness(page, url);
  await expect(page.getByRole('button', { name: '会话迁移', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '会话迁移', exact: true }).click();
  await expect(page.getByText('仅显示未归档且当前有效的会话')).toBeVisible();
  await expect(page.getByRole('button', { name: '打开预览：活动会话 海星' })).toBeVisible();
  await expect(page.getByRole('button', { name: '打开预览：已归档会话 不应出现' })).toHaveCount(0);
  await page.getByRole('button', { name: '打开预览：活动会话 海星' }).click();
  await page.getByLabel('目标项目目录').fill(root);
  await page.getByRole('button', { name: '生成迁移预览', exact: true }).click();
  await expect(page.getByText('项目代号：海星', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^(导入会话|按上述差异导入)$/ }).click();
  await expect(page.getByText('迁移完成', { exact: true }).first()).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: '.local/verification/migration-complete.png' });
  await page.getByRole('button', { name: '打开会话', exact: true }).first().click();
  await expect(page.getByText('项目代号：海星', { exact: true })).toBeVisible();
  await expect(page.getByText('已记录海星。', { exact: true })).toBeVisible();
});
