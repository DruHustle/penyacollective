import { chromium } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL;
const previewThemeId = process.env.E2E_PREVIEW_THEME_ID;

const articleHandles = [
  'penya-collective-berlin-contemporary-2027',
  'penya-collective-rooted-in-heritage',
  'ivhu-tribe-partner-spotlight',
  'haus-of-stone-partner-spotlight',
  'by-bakari-partner-spotlight',
  'a-tribe-called-zimbabwe-partner-spotlight',
  'feli-nandi-partner-spotlight',
  'panashe-partner-spotlight',
  'how-we-make-it-production-process',
];

if (!baseURL || !previewThemeId) {
  console.error('Missing E2E_BASE_URL or E2E_PREVIEW_THEME_ID.');
  process.exit(1);
}

const buildPreviewUrl = (url, themeId) => {
  const previewUrl = new URL(url);
  previewUrl.searchParams.set('preview_theme_id', themeId);
  return previewUrl.toString();
};

const isArticleReady = (html) => {
  if (!html) return false;
  if (/Liquid error|undefined method/i.test(html)) return false;

  return (
    /"@type"\s*:\s*"Article"/.test(html) &&
    html.includes('Stay in the Glow') &&
    html.includes('blog-post-content') &&
    html.includes('Journal')
  );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto(buildPreviewUrl(baseURL, previewThemeId), {
    waitUntil: 'commit',
    timeout: 90_000,
  });
  await page.locator('body').waitFor({ state: 'attached', timeout: 15_000 });

  for (const handle of articleHandles) {
    let ready = false;

    for (let attempt = 1; attempt <= 10; attempt++) {
      const articleUrl = new URL(`/blogs/journal/${handle}`, baseURL).toString();
      const response = await page.goto(articleUrl, {
        waitUntil: 'commit',
        timeout: 60_000,
      });
      await page.locator('body').waitFor({ state: 'attached', timeout: 15_000 });
      const html = await page.content();

      if (response?.status() === 200 && isArticleReady(html)) {
        console.log(`Article ready after ${attempt} attempt(s): ${handle}`);
        ready = true;
        break;
      }

      console.log(
        `Waiting for article "${handle}" (attempt ${attempt}/10, status ${response?.status?.() ?? 'n/a'})`
      );

      if (attempt < 10) {
        await sleep(4000);
      }
    }

    if (!ready) {
      console.error(`Article did not become ready in time: ${handle}`);
      process.exit(1);
    }
  }

  console.log('All journal articles are storefront-ready.');
} finally {
  await browser.close();
}
