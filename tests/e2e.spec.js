const { test, expect } = require('@playwright/test');

// ─── Homepage ──────────────────────────────────────────────────────────────
test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
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
    await expect(ld).toBeAttached();
    const json = await ld.first().textContent();
    const parsed = JSON.parse(json);
    expect(parsed['@context']).toBe('https://schema.org');
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
    expect(count).toBe(6);
    for (let i = 0; i < count; i++) {
      const src = await images.nth(i).getAttribute('src');
      const res = await page.request.get(src);
      expect(res.status(), `Designer image failed: ${src}`).toBe(200);
    }
  });

  test('newsletter section has updated copy', async ({ page }) => {
    await expect(page.getByText(/Wear the Glow First/i)).toBeVisible();
  });

  test('Shop In-House collections section is visible', async ({ page }) => {
    await expect(page.getByText(/Shop In-House/i)).toBeVisible();
  });
});

// ─── Collections ──────────────────────────────────────────────────────────
test.describe('Collections', () => {
  for (const handle of ['men', 'women', 'accessories']) {
    test(`/collections/${handle} loads`, async ({ page }) => {
      const res = await page.goto(`/collections/${handle}`);
      expect(res.status()).toBe(200);
      const body = await page.textContent('body');
      expect(body).not.toContain('Liquid error');
    });

    test(`/collections/${handle} shows empty state when no products`, async ({ page }) => {
      await page.goto(`/collections/${handle}`);
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
    const res = await page.goto('/blogs/journal');
    expect(res.status()).toBe(200);
    const body = await page.textContent('body');
    expect(body).not.toContain('Liquid error');
  });

  test('Hemp article is listed first', async ({ page }) => {
    await page.goto('/blogs/journal');
    const firstArticle = page.locator('article, .blog-post-card, [class*="blog"]').first();
    const text = await firstArticle.textContent();
    expect(text.toLowerCase()).toContain('hemp');
  });

  for (const [, handle] of [
    ['Sustainability in Focus: Hemp Fabrics', 'sustainability-hemp-fabrics'],
    ['Penya Collective: Rooted in Heritage', 'penya-collective-rooted-in-heritage'],
    ['Moto Moto Festival in Germany', 'moto-moto-festival-germany'],
    ['Ivhu Tribe', 'ivhu-tribe-partner-spotlight'],
  ]) {
    test(`article "${handle}" loads without errors`, async ({ page }) => {
      const res = await page.goto(`/blogs/journal/${handle}`);
      expect(res.status()).toBe(200);
      const body = await page.textContent('body');
      expect(body).not.toContain('Liquid error');
    });

    test(`article "${handle}" has Article JSON-LD`, async ({ page }) => {
      await page.goto(`/blogs/journal/${handle}`);
      const ld = page.locator('script[type="application/ld+json"]');
      const count = await ld.count();
      let found = false;
      for (let i = 0; i < count; i++) {
        const json = JSON.parse(await ld.nth(i).textContent());
        if (json['@type'] === 'Article') { found = true; break; }
      }
      expect(found, 'Article JSON-LD missing').toBe(true);
    });
  }
});

// ─── Pages ─────────────────────────────────────────────────────────────────
test.describe('Pages', () => {
  test('Our Story page loads', async ({ page }) => {
    const res = await page.goto('/pages/about');
    expect(res.status()).toBe(200);
    const body = await page.textContent('body');
    expect(body).not.toContain('Liquid error');
  });

  test('Our Story page has hero image', async ({ page }) => {
    await page.goto('/pages/about');
    const heroImg = page.locator('.media-block img, .media-block__media').first();
    await expect(heroImg).toBeVisible();
  });

  for (const handle of ['sustainability', 'contact', 'shipping']) {
    test(`/pages/${handle} loads`, async ({ page }) => {
      const res = await page.goto(`/pages/${handle}`);
      expect(res.status()).toBe(200);
      const body = await page.textContent('body');
      expect(body).not.toContain('Liquid error');
    });
  }
});

// ─── SEO ───────────────────────────────────────────────────────────────────
test.describe('SEO', () => {
  const pages = ['/', '/blogs/journal', '/pages/about', '/collections/men'];

  for (const path of pages) {
    test(`${path} has canonical link`, async ({ page }) => {
      await page.goto(path);
      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toBeAttached();
    });

    test(`${path} has og:title and og:description`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[property="og:title"]')).toBeAttached();
      await expect(page.locator('meta[property="og:description"]')).toBeAttached();
    });

    test(`${path} has no Liquid errors`, async ({ page }) => {
      await page.goto(path);
      const body = await page.textContent('body');
      expect(body).not.toContain('Liquid error');
      expect(body).not.toContain('wrong number of arguments');
    });
  }
});
