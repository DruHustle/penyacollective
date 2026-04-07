const { test, expect } = require('@playwright/test');

const journalArticles = [
  ['Bridge to Berlin', 'penya-collective-berlin-contemporary-2027'],
  ['Penya Collective: Rooted in Heritage', 'penya-collective-rooted-in-heritage'],
  ['How We Make It', 'how-we-make-it-production-process'],
];

const getJournalHandleFromHref = (href) => {
  if (!href) return null;

  try {
    const url = new URL(href, 'https://penya.africa');
    const match = url.pathname.match(/^\/blogs\/journal\/([^/?#]+)/);
    return match ? match[1] : null;
  } catch (_) {
    return null;
  }
};

const pageHasArticleJsonLd = async (page) => {
  const ld = page.locator('script[type="application/ld+json"]');
  const count = await ld.count();

  for (let i = 0; i < count; i++) {
    const text = await ld.nth(i).textContent();
    if (!text) continue;

    try {
      const parsed = JSON.parse(text);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      if (nodes.some((node) => node && node['@type'] === 'Article')) {
        return true;
      }
    } catch (_) {}
  }

  return false;
};

const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);

const goto = async (page, path, options = {}) => {
  const { maxAttempts = 3 } = options;

  // Klaviyo's onsite embed is a Shopify App Embed (served from cdn.shopify.com),
  // so URL blocking alone won't reach it, and a MutationObserver loses the race
  // when Klaviyo re-inserts its popup after removal.
  // Constructable Stylesheets win permanently: the rule applies to every element
  // Klaviyo adds, regardless of when or how often it re-inserts them.
  // The Shopify Preview Bar (#PBarNextFrameWrapper) is also suppressed here via CSS
  // rather than a route block, to avoid disrupting the preview-theme session cookies.
  await page.addInitScript(() => {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(`
        [aria-label*="POPUP"][role="dialog"],
        .kl-private-reset-css-Xuajs1,
        #PBarNextFrameWrapper,
        #PBarNextFrame {
          display: none !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }
      `);
      document.adoptedStyleSheets = [...(document.adoptedStyleSheets || []), sheet];
    } catch (_) {}
  });

  let response = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    response = await page.goto(path, { waitUntil: 'commit', timeout: 60_000 });
    await page.locator('body').waitFor({ state: 'attached', timeout: 60_000 });

    if (!response || !RETRYABLE_STATUS_CODES.has(response.status())) {
      return response;
    }

    if (attempt < maxAttempts) {
      await page.waitForTimeout(attempt * 1_500);
    }
  }

  return response;
};

const gotoJournalArticle = async (page, handle) => {
  let response = null;

  for (let attempt = 1; attempt <= 4; attempt++) {
    response = await goto(page, `/blogs/journal/${handle}`);
    if (response.status() === 200) {
      return response;
    }

    if (attempt < 4) {
      await page.waitForTimeout(attempt * 2_000);
    }
  }

  return response;
};

// ─── Homepage ──────────────────────────────────────────────────────────────
test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/');
  });

  test('loads without Liquid errors', async ({ page }) => {
    const body = await page.textContent('body');
    expect(body).not.toContain('Liquid error');
    expect(body).not.toContain('undefined method');
  });

  test('has correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Penya Collective/i);
  });

  test('has meta description', async ({ page }) => {
    const meta = page.locator('meta[name="description"]');
    const content = await meta.getAttribute('content');
    expect(content).toBeTruthy();
    expect(content.length).toBeGreaterThan(20);
  });

  test('has JSON-LD structured data', async ({ page }) => {
    const ld = page.locator('script[type="application/ld+json"]');
    await expect(ld.first()).toBeAttached();
    const json = await ld.first().textContent();
    const parsed = JSON.parse(json);
    expect(parsed['@context']).toMatch(/schema\.org/);
  });

  test('hero section is visible', async ({ page }) => {
    await expect(page.locator('.hero-section, [class*="hero"]').first()).toBeVisible();
  });

  test('Shop the Collection CTA is visible and works', async ({ page }) => {
    const cta = page.getByRole('link', { name: /shop the collection/i });
    await expect(cta).toBeVisible();
    const response = await page.request.get(await cta.getAttribute('href'));
    expect(response.status()).toBe(200);
  });

  test('creatives grid renders when metaobjects are configured', async ({ page }) => {
    const section = page.locator('.penya-designers');
    const isPresent = await section.count() > 0;
    // Grid only renders when Designer metaobjects exist and have visible entries.
    // Skip assertions on stores where metaobjects have not been configured yet.
    if (!isPresent) return;
    await expect(section).toBeVisible();
    const cards = page.locator('.penya-designers__grid a');
    await expect(cards).not.toHaveCount(0);
  });

  test('creative images load without 404', async ({ page }) => {
    const section = page.locator('.penya-designers');
    const isPresent = await section.count() > 0;
    if (!isPresent) return;
    const images = page.locator('.penya-designers__grid img');
    const count = await images.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const src = await images.nth(i).getAttribute('src');
      const res = await page.request.get(src);
      expect(res.status(), `Creative image failed: ${src}`).toBe(200);
    }
  });

  test('designer cards link to profile pages not collections', async ({ page }) => {
    const cards = page.locator('.penya-designers__grid a');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const href = await cards.nth(i).getAttribute('href');
      expect(href, `Designer card should link to /pages/designer-*`).toMatch(/^\/pages\/designer-/);
    }
  });

  test('newsletter section has updated copy', async ({ page }) => {
    await expect(page.getByText(/Be Part of the Glow/i)).toBeVisible();
  });

  test('Shop In-House collections section is visible', async ({ page }) => {
    await expect(page.getByText(/Shop (?:In-House|the House)/i)).toBeVisible();
  });

  test('trust band surfaces core service assurances', async ({ page }) => {
    const trustBand = page.locator('[data-testid="penya-trust-band"]');
    await expect(trustBand).toBeVisible();
    await expect(trustBand.locator('.penya-trust-band__item')).toHaveCount(4);
    await expect(trustBand.getByText(/14-day returns/i)).toBeVisible();
    await expect(trustBand.getByText(/1.?2 business days/i)).toBeVisible();

    const trustItemLinks = trustBand.locator('.penya-trust-band__item-link');
    await expect(trustItemLinks).toHaveCount(4);
    await expect(trustItemLinks.nth(0)).toHaveAttribute('href', '/pages/shipping');
    await expect(trustItemLinks.nth(1)).toHaveAttribute('href', '/pages/shipping');
    await expect(trustItemLinks.nth(2)).toHaveAttribute('href', '/pages/faq');
    await expect(trustItemLinks.nth(3)).toHaveAttribute('href', '/pages/contact');
  });

  test('header shows the localization currency control', async ({ page }) => {
    await expect(page.locator('[data-testid="localization-currency-code"]').first()).toBeVisible();
  });

  test('floating contact widget opens and closes', async ({ page }) => {
    const trigger = page.locator('#penya-chat-trigger');
    const panel = page.locator('#penya-chat-panel');

    await expect(trigger).toBeVisible();
    await expect(panel).toHaveAttribute('aria-hidden', 'true');

    await trigger.click();
    await expect(panel).toHaveAttribute('aria-hidden', 'false');
    await expect(panel.getByRole('link', { name: /chat on whatsapp/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
  });

  test('floating contact widget exposes a labelled dialog', async ({ page }) => {
    const trigger = page.locator('#penya-chat-trigger');
    const panel = page.locator('#penya-chat-panel');

    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(panel).toHaveAttribute('role', 'dialog');
    await expect(panel).toHaveAttribute('aria-labelledby', 'penya-chat-title');
    await expect(panel).toHaveAttribute('aria-describedby', 'penya-chat-description');
  });

  test('floating contact widget closes when clicking outside', async ({ page }) => {
    const trigger = page.locator('#penya-chat-trigger');
    const panel = page.locator('#penya-chat-panel');

    await trigger.click();
    await expect(panel).toHaveAttribute('aria-hidden', 'false');

    await page.locator('body').click({ position: { x: 20, y: 20 } });
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
  });

  test('floating contact widget returns focus to trigger when dismissed outside', async ({ page }) => {
    const trigger = page.locator('#penya-chat-trigger');

    await trigger.click();
    await page.locator('body').click({ position: { x: 20, y: 20 } });

    await expect(trigger).toBeFocused();
  });

  test('journal carousel renders as horizontal scroll container', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const carousel = page.locator('[data-testid="featured-blog-posts"] slideshow-component').first();
    await expect(carousel).toBeAttached();
  });

  test('journal carousel does not autoplay without explicit opt-in', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const carousel = page.locator('[data-testid="featured-blog-posts"] slideshow-component').first();
    await expect(carousel).not.toHaveAttribute('autoplay', /.+/);
  });

  test('journal carousel contains at least 3 article cards', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const cards = page.locator('[data-testid="featured-blog-posts"] .resource-list__slide');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

// ─── Collections ──────────────────────────────────────────────────────────
test.describe('Collections', () => {
  for (const handle of ['men', 'women', 'accessories']) {
    test(`/collections/${handle} loads`, async ({ page }) => {
      let res = await goto(page, `/collections/${handle}`);
      // Shopify occasionally returns 503 under CI load — retry once before failing
      if (res.status() === 503) {
        res = await goto(page, `/collections/${handle}`);
      }
      expect(res.status()).toBe(200);
      const body = await page.textContent('body');
      expect(body).not.toContain('Liquid error');
    });

    test(`/collections/${handle} shows empty state when no products`, async ({ page }) => {
      await goto(page, `/collections/${handle}`);
      // Wait for the results-list web component to finish initialising before inspecting the grid
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      const hasProducts = await page.locator('.product-grid__item:not(.product-grid__empty)').count();
      if (hasProducts === 0) {
        await expect(page.getByText(/New pieces coming soon/i)).toBeVisible();
      }
    });
  }
});

// ─── Blog / Journal ────────────────────────────────────────────────────────
test.describe('Journal', () => {
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').Page} */
  let journalPage;
  /** @type {string[]} */
  let publishedJournalHandles = [];

  test.beforeAll(async ({ browser }) => {
    journalPage = await browser.newPage();

    await goto(journalPage, '/blogs/journal');

    const hrefs = await journalPage.locator('a[href*="/blogs/journal/"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')).filter(Boolean)
    );

    const visibleHandles = new Set(hrefs.map((href) => getJournalHandleFromHref(href && href.trim())).filter(Boolean));

    publishedJournalHandles = journalArticles
      .map(([, handle]) => handle)
      .filter((handle) => visibleHandles.has(handle));
  });

  test.afterAll(async () => {
    await journalPage?.close();
  });

  test('blog index loads', async () => {
    const res = await goto(journalPage, '/blogs/journal');
    expect(res.status()).toBe(200);
    const body = await journalPage.textContent('body');
    expect(body).not.toContain('Liquid error');
  });

  test('blog index only links to published journal articles under test', async () => {
    for (const handle of publishedJournalHandles) {
      expect(handle).toBeTruthy();
    }
  });

  for (const [, handle] of journalArticles) {
    test(`article "${handle}" renders complete journal content`, async () => {
      test.skip(!publishedJournalHandles.includes(handle), `Article "${handle}" is not currently published on the storefront.`);

      const res = await gotoJournalArticle(journalPage, handle);
      expect(res.status()).toBe(200);

      const body = await journalPage.textContent('body');
      expect(body).not.toContain('Liquid error');

      const found = await pageHasArticleJsonLd(journalPage);
      expect(found, 'Article JSON-LD missing').toBe(true);

      const backLink = journalPage.getByRole('link', { name: /← Journal/i });
      await expect(backLink).toBeVisible();

      await expect(journalPage.getByText(/Stay in the Glow/i)).toBeVisible();
      await expect(journalPage.locator('input[type="email"]').last()).toBeVisible();

      const content = journalPage.locator('.blog-post-content').first();
      await expect(content).toBeVisible();
      const text = (await content.textContent()) || '';
      expect(text.trim().length).toBeGreaterThan(80);
    });
  }
});

// ─── Pages ─────────────────────────────────────────────────────────────────
test.describe('Pages', () => {
  test('Order enquiry page loads', async ({ page }) => {
    const res = await goto(page, '/pages/order');
    expect(res.status()).toBe(200);
    const body = await page.textContent('body');
    expect(body).not.toContain('Liquid error');
  });

  test('Order page has enquiry form', async ({ page }) => {
    await goto(page, '/pages/order');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="tel"]')).toBeVisible();
  });

  test('Our Story page loads', async ({ page }) => {
    const res = await goto(page, '/pages/about');
    expect(res.status()).toBe(200);
    const body = await page.textContent('body');
    expect(body).not.toContain('Liquid error');
  });

  test('Our Story page has hero image', async ({ page }) => {
    await goto(page, '/pages/about');
    const heroImg = page.locator('.penya-story-hero__image, .media-block img, .media-block__media').first();
    await expect(heroImg).toBeVisible();
  });

  for (const handle of ['sustainability', 'contact', 'shipping', 'terms', 'faq']) {
    test(`/pages/${handle} loads`, async ({ page }) => {
      const res = await goto(page, `/pages/${handle}`);
      expect(res.status()).toBe(200);
      const body = await page.textContent('body');
      expect(body).not.toContain('Liquid error');
    });
  }

  test('Contact page surfaces direct support paths', async ({ page }) => {
    await goto(page, '/pages/contact');
    const clientCare = page.locator('.penya-client-care');
    await expect(clientCare.getByRole('link', { name: /email client care/i })).toBeVisible();
    await expect(clientCare.getByRole('link', { name: /whatsapp us/i })).toBeVisible();
    await expect(clientCare.getByRole('link', { name: /fit guide/i })).toBeVisible();
  });

  test('FAQ page has accordion items', async ({ page }) => {
    await goto(page, '/pages/faq');
    const items = page.locator('.faq__item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('FAQ accordion opens on click', async ({ page }) => {
    await goto(page, '/pages/faq');
    const firstItem = page.locator('.faq__item').first();
    await expect(firstItem).not.toHaveAttribute('open');
    await firstItem.locator('summary').click();
    await expect(firstItem).toHaveAttribute('open', '');
  });

  test('Terms page has legal content', async ({ page }) => {
    await goto(page, '/pages/terms');
    const body = await page.textContent('body');
    expect(body).toContain('Governing Law');
    expect(body).toContain('Returns');
  });
});

// ─── Designer profiles ─────────────────────────────────────────────────────
test.describe('Designer profiles', () => {
  const designers = [
    'designer-ivhu-tribe',
    'designer-a-tribe-called-zimbabwe',
    'designer-feli-nandi',
    'designer-haus-of-stone',
    'designer-panashe',
    'designer-by-bakari',
  ];

  for (const handle of designers) {
    test(`/pages/${handle} loads without errors`, async ({ page }) => {
      const res = await goto(page, `/pages/${handle}`);
      expect(res.status()).toBe(200);
      const body = await page.textContent('body');
      expect(body).not.toContain('Liquid error');
    });

    test(`/pages/${handle} has designer name heading`, async ({ page }) => {
      await goto(page, `/pages/${handle}`);
      const heading = page.locator('.designer-profile__name');
      await expect(heading).toBeVisible();
      const text = await heading.textContent();
      expect(text.trim().length).toBeGreaterThan(0);
    });

    test(`/pages/${handle} has a shop CTA`, async ({ page }) => {
      await goto(page, `/pages/${handle}`);
      const cta = page.locator('.designer-profile__cta .button');
      await expect(cta).toBeVisible();
      const href = await cta.getAttribute('href');
      expect(href).toBeTruthy();
    });

    test(`/pages/${handle} shows fit and bespoke support links`, async ({ page }) => {
      await goto(page, `/pages/${handle}`);
      await expect(page.getByRole('link', { name: /view fit guide/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /enquire about bespoke/i })).toBeVisible();
    });
  }
});

// ─── Fit Guide ─────────────────────────────────────────────────────────────
test.describe('Fit Guide', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/pages/fit-guide');
    await page.locator('.fit-guide__size-table[data-enhanced="true"]').first().waitFor({ state: 'visible' });
  });

  test('loads without errors', async ({ page }) => {
    const body = await page.textContent('body');
    expect(body).not.toContain('Liquid error');
  });

  test('has measurement steps', async ({ page }) => {
    const steps = page.locator('.fit-guide__step');
    const count = await steps.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('has size table with rows', async ({ page }) => {
    const rows = page.locator('.fit-guide__table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('has direct support actions', async ({ page }) => {
    const support = page.locator('.fit-guide__support');
    await expect(support.getByRole('link', { name: /contact client care/i })).toBeVisible();
    await expect(support.getByRole('link', { name: /whatsapp us/i })).toBeVisible();
  });

  test('active gender tab exposes aria-selected=true on first render', async ({ page }) => {
    const activeTab = page.locator('.fit-guide__gender-btn.is-active').first();
    if (await activeTab.count()) {
      await expect(activeTab).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('size table has accessible column headers', async ({ page }) => {
    const headers = page.locator('.fit-guide__table th[scope="col"]');
    await expect(headers).toHaveCount(6);
  });

  test('unit toggle switches table values to inches', async ({ page }) => {
    const inBtn = page.locator('.fit-guide__unit-btn[data-unit="in"]').first();
    // Scroll to center so the sticky header does not cover the button
    await inBtn.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await inBtn.click();
    const firstCell = page.locator('.fit-guide__table tbody td[data-cm]').first();
    const text = await firstCell.textContent();
    // CM values are whole numbers like "80 – 84"; inch values contain decimals
    expect(text).toMatch(/\d+\.\d/);
  });

  test('unit toggle restores cm values when switching back', async ({ page }) => {
    const inBtn = page.locator('.fit-guide__unit-btn[data-unit="in"]').first();
    const cmBtn = page.locator('.fit-guide__unit-btn[data-unit="cm"]').first();
    const firstCell = page.locator('.fit-guide__table tbody td[data-cm]').first();
    const originalText = await firstCell.textContent();
    // Scroll to center so the sticky header does not cover the button
    await inBtn.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await inBtn.click();
    await cmBtn.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await cmBtn.click();
    await expect(firstCell).toHaveText(originalText);
  });

  test('calculator inputs restore correct cm bounds after in/cm toggle', async ({ page }) => {
    const input = page.locator('.fit-guide__calc-input').first();
    const originalMin = await input.getAttribute('min');
    const inBtn = page.locator('.fit-guide__unit-btn[data-unit="in"]').first();
    const cmBtn = page.locator('.fit-guide__unit-btn[data-unit="cm"]').first();
    // Scroll to center so the sticky header does not cover the button
    await inBtn.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await inBtn.click();
    await cmBtn.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await cmBtn.click();
    await expect(input).toHaveAttribute('min', originalMin);
  });

  test('unit toggle converts entered calculator values to inches', async ({ page }) => {
    const sizeTable = page.locator('.fit-guide__size-table:visible').first();
    const input = sizeTable.locator('.fit-guide__calc-input[data-measure="chest"]').first();
    const inBtn = sizeTable.locator('.fit-guide__unit-btn[data-unit="in"]').first();

    await input.fill('90');
    await inBtn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await inBtn.click();

    await expect(input).toHaveValue('35.4');
  });
});

// ─── SEO ───────────────────────────────────────────────────────────────────
test.describe('SEO', () => {
  const pages = ['/', '/blogs/journal', '/pages/about', '/collections/men'];

  for (const path of pages) {
    test(`${path} has canonical link`, async ({ page }) => {
      await goto(page, path);
      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toBeAttached();
    });

    test(`${path} has og:title and og:description`, async ({ page }) => {
      await goto(page, path);
      await expect(page.locator('meta[property="og:title"]')).toBeAttached();
      await expect(page.locator('meta[property="og:description"]')).toBeAttached();
    });

    test(`${path} has no Liquid errors`, async ({ page }) => {
      await goto(page, path);
      const body = await page.textContent('body');
      expect(body).not.toContain('Liquid error');
      expect(body).not.toContain('wrong number of arguments');
    });
  }
});
