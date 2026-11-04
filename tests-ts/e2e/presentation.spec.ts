import { expect, test } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openHarness } from '../helpers/browser.js';

test.skip(!process.env.DSH_ALINK_PACKAGE_MATRIX, 'Clean package matrix only');
test('groups projects, shows only dialogue and keeps long content inside both layouts', async ({ page }) => {
  const root = process.env.DSH_ALINK_TEST_HOME!;
  const { url } = JSON.parse(await readFile(path.join(root, 'host.json'), 'utf8'));
  const project = path.join(root, 'project-b-' + 'long-name-'.repeat(12));
  await mkdir(project);
  const db = new DatabaseSync(path.join(root, 'sources/workbuddy/workbuddy.db'));
  db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?,?)').run('presentation', '布局测试：' + '较长的会话标题'.repeat(12), project, 'completed', null, 0);
  db.close();
  const message = (role: string, content: string) => ({ type: 'message', role, content, sessionId: 'presentation' });
  await writeFile(path.join(root, 'sources/workbuddy/projects/p/presentation.jsonl'), [
    message('user', '# AGENTS.md instructions\n<INSTRUCTIONS>\n自动规则不应显示\n</INSTRUCTIONS>'),
    message('user', '<environment_context>自动环境不应显示</environment_context>'),
    message('user', '这是用户的问题。' + 'long-content-'.repeat(120)),
    { type: 'function_call', name: 'exec', call_id: 'test', arguments: '工具细节不应显示', sessionId: 'presentation' },
    message('assistant', '这是助手的回答。'),
  ].map(row => JSON.stringify(row)).join('\n') + '\n');
  await openHarness(page, url);
  await page.getByRole('button', { name: 'Alink', exact: true }).click();
  const groups = page.locator('.dsh-alink-project');
  await expect(groups).toHaveCount(2);
  const group = groups.filter({ has: page.locator('summary', { hasText: 'project-b-' }) });
  await group.locator('summary').click();
  await expect(group.getByRole('button')).toBeHidden();
  await group.locator('summary').click();
  await group.getByRole('button').click();
  await page.getByRole('button', { name: '生成迁移预览', exact: true }).click();
  const history = page.getByRole('region', { name: '对话历史', exact: true });
  await expect(history.locator('article')).toHaveCount(2);
  await expect(history).toContainText('这是用户的问题。');
  await expect(history).toContainText('这是助手的回答。');
  await expect(history).not.toContainText('不应显示');
  await expect(page.getByText('迁移差异', { exact: false })).toHaveCount(0);
  await expect(page.getByText('仅显示未归档且当前有效的会话')).toHaveCount(0);
  for (const width of [1440, 900, 600]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.locator('.dsh-alink').evaluate(root => {
      const sources = root.querySelector('.dsh-alink-sources')!.getBoundingClientRect();
      const preview = root.querySelector('.dsh-alink-preview')!.getBoundingClientRect();
      const noOverlap = sources.right <= preview.left + 1 || sources.bottom <= preview.top + 1;
      const contained = [...root.querySelectorAll<HTMLElement>('.dsh-alink-sources,.dsh-alink-preview,.dsh-alink-messages')].every(el => el.scrollWidth <= el.clientWidth + 1);
      const selects = [...root.querySelectorAll('select')].every(el => {
        const style = getComputedStyle(el);
        return style.appearance === 'none' && parseFloat(style.paddingRight) >= 36 && el.getBoundingClientRect().height === 40;
      });
      return noOverlap && contained && selects && root.scrollWidth <= root.clientWidth + 1;
    })).toBe(true);
    await page.screenshot({ path: `.local/verification/alink-${width}.png` });
  }
});
