import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests-ts/e2e', timeout: 90000, workers: 1,
  use: { headless: true, channel: 'chrome', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' } });
