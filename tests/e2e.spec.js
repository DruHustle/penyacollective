const { test, expect } = require('@playwright/test');

const goto = async (page, path) => {
  const response = await page.goto(path, { waitUntil: 'commit', timeout: 60_000 });
  await page.locator('body').waitFor({ state: 'attached', timeout: 60_000 });
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

  test('Shop by Designer section is visible', async ({ page }) => {
    await expect(page.locator('.penya-designers')).toBeVisible();
  });

  test('Shop by Designer shows all 6 designers', async ({ page }) => {
    const cards = page.locator('.penya-designers__grid a');
    await expect(cards).toHaveCount(6);
  });

  test('designer images load without 404', async ({ page }) => {
    const images = page.locator('.penya-designers__grid img');
    const count = await images.count();
    expect(count).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < count; i++) {
      const src = await images.nth(i).getAttribute('src');
      const res = await page.request.get(src);
      expect(res.status(), `Designer image failed: ${src}`).toBe(200);
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
    await expect(page.getByText(/Wear the Glow First/i)).toBeVisible();
  });

  test('Shop In-House collections section is visible', async ({ page }) => {
    await expect(page.getByText(/Shop (?:In-House|the House)/i)).toBeVisible();
  });

  test('header shows the localization currency control', async ({ page }) => {
    await expect(page.locator('[data-testid="localization-currency-code"]').first()).toBeVisible();
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
  test('blog index loads', async ({ page }) => {
    const res = await goto(page, '/blogs/journal');
    expect(res.status()).toBe(200);
    const body = await page.textContent('body');
    expect(body).not.toContain('Liquid error');
  });

  for (const [, handle] of [
    ['Sustainability in Focus: Hemp Fabrics', 'sustainability-hemp-fabrics'],
    ['Penya Collective: Rooted in Heritage', 'penya-collective-rooted-in-heritage'],
    ['Ivhu Tribe', 'ivhu-tribe-partner-spotlight'],
    ['Haus of Stone', 'haus-of-stone-partner-spotlight'],
    ['By Bakari', 'by-bakari-partner-spotlight'],
    ['How We Make It', 'how-we-make-it-production-process'],
  ]) {
    test(`article "${handle}" loads without errors`, async ({ page }) => {
      const res = await goto(page, `/blogs/journal/${handle}`);
      expect(res.status()).toBe(200);
      const body = await page.textContent('body');
      expect(body).not.toContain('Liquid error');
    });

    test(`article "${handle}" has Article JSON-LD`, async ({ page }) => {
      await goto(page, `/blogs/journal/${handle}`);
      const ld = page.locator('script[type="application/ld+json"]');
      const count = await ld.count();
      let found = false;
      for (let i = 0; i < count; i++) {
        const json = JSON.parse(await ld.nth(i).textContent());
        if (json['@type'] === 'Article') { found = true; break; }
      }
      expect(found, 'Article JSON-LD missing').toBe(true);
    });

    test(`article "${handle}" has Back to Journal link`, async ({ page }) => {
      await goto(page, `/blogs/journal/${handle}`);
      const backLink = page.getByRole('link', { name: /← Journal/i });
      await expect(backLink).toBeVisible();
    });

    test(`article "${handle}" has post-read newsletter signup`, async ({ page }) => {
      await goto(page, `/blogs/journal/${handle}`);
      await expect(page.getByText(/Stay in the Glow/i)).toBeVisible();
      await expect(page.locator('input[type="email"]').last()).toBeVisible();
    });
  }
});

// ─── Pages ─────────────────────────────────────────────────────────────────
test.describe('Pages', () => {
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

  test('size table has accessible column headers', async ({ page }) => {
    const headers = page.locator('.fit-guide__table th[scope="col"]');
    await expect(headers).toHaveCount(6);
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
