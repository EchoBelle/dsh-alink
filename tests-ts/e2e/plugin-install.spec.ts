import { expect, test } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { openHarness } from '../helpers/browser.js';

test.skip(!process.env.DSH_ALINK_INSTALL_SPEC, 'Run with release-smoke --ui');
test('installs Alink through the native Add plugin dialog', async ({ page }) => {
  const root = process.env.DSH_ALINK_TEST_HOME!;
  const { url } = JSON.parse(await readFile(path.join(root, 'host.json'), 'utf8'));
  await openHarness(page, url);
  await expect(page.getByRole('button', { name: 'Alink', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Plugins', exact: true }).click();
  await page.getByRole('button', { name: 'Add plugin', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add plugin', exact: true });
  await dialog.getByRole('textbox', { name: 'Package name or address' }).fill(process.env.DSH_ALINK_INSTALL_SPEC!);
  await dialog.getByRole('button', { name: 'Install', exact: true }).click();
  let result = '';
  await expect.poll(async () => {
    const manifest = JSON.parse(await readFile(path.join(root, 'profiles/web/package.json'), 'utf8'));
    if (manifest.dependencies?.['dsh-alink'] && await page.getByRole('dialog', { name: 'Installed', exact: true }).isVisible()) return result = 'installed';
    const logs = path.join(root, 'profiles/web/.plugin-manager/logs');
    for (const entry of await readdir(logs).catch(() => [])) {
      const text = await readFile(path.join(logs, entry, 'pnpm.log'), 'utf8').catch(() => '');
      const error = text.match(/ERR_PNPM_[A-Z_]+/);
      if (error) return result = error[0];
    }
    return '';
  }, { timeout: 60000 }).not.toBe('');
  await page.screenshot({ path: '.local/verification/plugin-ui-install.png', fullPage: true });
  expect(result).toBe('installed');
  await page.getByRole('button', { name: 'Enable now', exact: true }).click();
  await expect.poll(async () => JSON.parse(await readFile(path.join(root, 'profiles/web/package.json'), 'utf8')).dsh.profile.bundles).toContain('dsh-alink');
});
