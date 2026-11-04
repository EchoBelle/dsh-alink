import type { Page } from '@playwright/test';
export async function openHarness(page: Page, url: string): Promise<void> {
  const preview = page.getByRole('dialog', { name: 'Preview Notice', exact: true });
  await page.addLocatorHandler(preview, async () => { await preview.getByRole('button', { name: 'Continue', exact: true }).click(); });
  const onboarding = page.getByRole('dialog', { name: 'Get started', exact: true });
  await page.addLocatorHandler(onboarding, async () => { await onboarding.getByRole('button', { name: 'Close', exact: true }).click(); });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
}
