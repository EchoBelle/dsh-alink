import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { openHarness } from '../helpers/browser.js';

test.skip(!process.env.DSH_ALINK_PACKAGE_MATRIX, 'Clean package matrix only');
test('automatically loads the focused dialogue, ignores a stale response, and supports dark selection controls', async ({ page }) => {
  const root = process.env.DSH_ALINK_TEST_HOME!, { url } = JSON.parse(await readFile(path.join(root, 'host.json'), 'utf8'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    const state = { held: false, released: false, calls: 0, release: () => {} };
    Object.assign(window, { alinkReadTest: state });
    window.fetch = async (input, init) => {
      const request = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      if (request.endpoint !== 'inspect') return original(input, init);
      state.calls++;
      const response = await original(input, init);
      if (state.held) return response;
      state.held = true; const body = await response.text();
      await new Promise<void>(resolve => { state.release = resolve; }); state.released = true;
      return new Response(body, { status: response.status, headers: response.headers });
    };
  });
  await openHarness(page, url); await page.getByRole('button', { name: 'Alink', exact: true }).click();
  await expect(page.getByRole('region', { name: '任务进度' })).toHaveCount(0);
  await page.getByRole('button', { name: '打开会话：活动会话 海星', exact: true }).click();
  await expect(page.getByRole('status', { name: '正在加载对话', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '导入所选（1）', exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'alinkReadTest').held)).toBe(true);
  await page.getByRole('button', { name: /打开会话：布局测试/ }).click();
  const history = page.getByRole('region', { name: '对话历史', exact: true });
  await expect(history).toContainText('这是用户的问题。');
  await page.evaluate(() => Reflect.get(window, 'alinkReadTest').release());
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'alinkReadTest').released)).toBe(true);
  await expect(history).not.toContainText('项目代号：海星');
  await expect(page.getByRole('button', { name: '查看对话', exact: true })).toHaveCount(0);
  await page.getByLabel('导入项目', { exact: true }).selectOption('single');
  await page.getByLabel('目标项目目录', { exact: true }).fill('/missing-project');
  await expect(history).toContainText('这是用户的问题。');
  expect(await page.evaluate(() => Reflect.get(window, 'alinkReadTest').calls)).toBe(2);
  expect(await page.getByRole('checkbox', { name: '全选当前列表', exact: true }).evaluate(el => getComputedStyle(el).appearance)).toBe('none');
  await page.screenshot({ path: '.local/verification/alink-dark.png' });
});
