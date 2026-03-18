const path = require('path');
const { defineConfig } = require('@playwright/test');

const previewThemeId = process.env.E2E_PREVIEW_THEME_ID;
const previewStatePath = path.join(__dirname, '.playwright', 'preview-state.json');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 0,
  globalSetup: previewThemeId ? require.resolve('./tests/setup-preview-state.js') : undefined,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:9292',
    headless: true,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    navigationTimeout: 60_000,
    storageState: previewThemeId ? previewStatePath : undefined,
  },
  reporter: [['list']],
});
