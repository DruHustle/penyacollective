const { test, expect } = require('@playwright/test');

test('click-through: home to collection and journal article', async ({ page }) => {
  await page.goto('/');

  const shopCta = page.getByRole('link', { name: 'Shop the Collection' });
  await expect(shopCta).toBeVisible();

  const [collectionResponse] = await Promise.all([
    page.waitForNavigation(),
    shopCta.click(),
  ]);
  expect(collectionResponse.status()).toBe(200);

  await page.goBack();

  const blogCard = page.locator('[data-testid="featured-blog-posts-card"]').first();
  await expect(blogCard).toBeVisible();
  const blogLink = blogCard.locator('a.featured-blog-posts-card__link');
  const blogHref = await blogLink.getAttribute('href');
  expect(blogHref).toBeTruthy();

  const [blogResponse] = await Promise.all([
    page.waitForNavigation(),
    blogLink.click(),
  ]);
  expect(blogResponse.status()).toBe(200);
});
