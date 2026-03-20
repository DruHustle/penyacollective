const fs = require('fs/promises');
const path = require('path');
const { chromium } = require('@playwright/test');

const previewThemeId = process.env.E2E_PREVIEW_THEME_ID;
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:9292';
const storageStatePath = path.join(__dirname, '..', '.playwright', 'preview-state.json');

function buildPreviewUrl(url, themeId) {
  const previewUrl = new URL(url);
  previewUrl.searchParams.set('preview_theme_id', themeId);
  return previewUrl.toString();
}

module.exports = async () => {
  if (!previewThemeId) {
    return;
  }

  await fs.mkdir(path.dirname(storageStatePath), { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await page.goto(buildPreviewUrl(baseURL, previewThemeId), {
      waitUntil: 'commit',
      timeout: 90_000,
    });

    await page.locator('body').waitFor({ state: 'attached', timeout: 15_000 });

    try {
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    } catch (error) {
      console.warn(`[setup-preview-state] networkidle timeout for ${baseURL}: ${error.message}`);
    }

    await context.storageState({ path: storageStatePath });
  } finally {
    await browser.close();
  }
};
