const SHOP = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

if (!SHOP || !TOKEN) {
  console.error(
    'Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_TOKEN. Example: SHOPIFY_STORE_DOMAIN=penyacollective.myshopify.com'
  );
  process.exit(1);
}

const baseUrl = `https://${SHOP}/admin/api/${API_VERSION}`;

async function shopify(path, method = 'GET', body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function ensureBlog(handle, title) {
  const existing = await shopify(`/blogs.json?handle=${encodeURIComponent(handle)}`);
  if (existing.blogs && existing.blogs.length > 0) {
    return existing.blogs[0];
  }
  const created = await shopify('/blogs.json', 'POST', {
    blog: { title, handle },
  });
  return created.blog;
}

async function ensurePage(handle, title, templateSuffix, bodyHtml) {
  const existing = await shopify(`/pages.json?handle=${encodeURIComponent(handle)}`);
  if (existing.pages && existing.pages.length > 0) {
    return existing.pages[0];
  }
  const created = await shopify('/pages.json', 'POST', {
    page: {
      title,
      handle,
      template_suffix: templateSuffix,
      body_html: bodyHtml,
      published: true,
    },
  });
  return created.page;
}

async function ensureArticle(blogId, article) {
  const existing = await shopify(`/blogs/${blogId}/articles.json?handle=${encodeURIComponent(article.handle)}`);
  if (existing.articles && existing.articles.length > 0) {
    const current = existing.articles[0];
    const updated = await shopify(`/blogs/${blogId}/articles/${current.id}.json`, 'PUT', {
      article,
    });
    return updated.article;
  }
  const created = await shopify(`/blogs/${blogId}/articles.json`, 'POST', {
    article,
  });
  return created.article;
}

const articles = [
  {
    title: 'Design & Fashion in Zimbabwe: A New Radiance',
    handle: 'design-fashion-zimbabwe',
    author: 'Penya Collective',
    tags: 'Journal,Design,Heritage',
    summary_html:
      'From Harare ateliers to emerging runways, Zimbabwe’s design language is bold, tailored, and luminous. We explore the craft, the codes, and the future.',
    body_html:
      '<p>Zimbabwean fashion is a study in contrast: refined tailoring set against vibrant patterning, heritage craft framed by a global lens. From Harare ateliers to emerging runways, designers are defining a visual language that is both rooted and future-facing.</p><h3>Craft As Culture</h3><p>Local craftsmanship sits at the heart of the industry. Beading, woven textiles, and hand-finished details are not accents here; they are the foundation. The result is clothing that carries story, skill, and purpose in every seam.</p><h3>Modern Silhouettes, Ancestral Codes</h3><p>Today’s designers are blending sharp, architectural silhouettes with motifs that speak to lineage. Tailored coats, sculptural knitwear, and fluid separates are finished with patterns that nod to place, memory, and identity.</p><h3>Radiance Beyond Borders</h3><p>The momentum is growing, powered by a generation that sees no divide between heritage and innovation. The goal is clear: to shine globally while remaining unmistakably Zimbabwean.</p>',
    published: true,
  },
  {
    title: 'Sustainability in Focus: Hemp Fabrics',
    handle: 'sustainability-hemp-fabrics',
    author: 'Penya Collective',
    tags: 'Journal,Sustainability,Materials',
    summary_html:
      'Hemp delivers strength, breathability, and a low-impact footprint. Here is how we finish it for softness, structure, and timeless wear.',
    body_html:
      '<p>Hemp is one of the most promising materials for modern luxury. It is resilient, breathable, and naturally low impact. At Penya, we are exploring how hemp can be refined into cloth that feels elevated, soft, and timeless.</p><h3>Why Hemp</h3><p>Hemp grows quickly, needs far less water than conventional cotton, and enriches the soil. That makes it a powerful foundation for responsible fashion, especially in climates where resource efficiency matters.</p><h3>Finishing For Luxury</h3><p>We focus on finishing processes that elevate the hand feel: careful washes, refined weaves, and thoughtful blends that add drape and durability without compromising the material’s character.</p><h3>Designed To Endure</h3><p>Sustainability is not only about materials. It is also about longevity. Hemp’s strength makes it ideal for pieces that are made to be worn, remembered, and kept.</p>',
    published: true,
  },
  {
    title: 'Moto Moto Festival in Germany: Zimbabwe on the Global Stage',
    handle: 'moto-moto-festival-germany',
    author: 'Penya Collective',
    tags: 'Journal,Events,Global',
    summary_html:
      'A celebration of Zimbabwean fashion and design abroad, spotlighting artisans, labels, and the glow of heritage in a European cultural hub.',
    body_html:
      '<p>Moto Moto is a vibrant cultural festival in Germany that celebrates African creativity across fashion, design, and music. This year, Zimbabwe’s fashion scene took center stage, revealing a bold, luminous vision to a new audience.</p><h3>Zimbabwe On The Global Stage</h3><p>From runway moments to curated installations, the showcase highlighted artisans and labels that are redefining what contemporary African luxury looks and feels like.</p><h3>Heritage Meets Innovation</h3><p>Collections fused heritage patterns with modern silhouettes, proving that tradition and innovation are not opposites but collaborators.</p><h3>The Collective Spirit</h3><p>The festival’s impact went beyond the garments. It fostered new connections, creative partnerships, and a deeper appreciation for Zimbabwe’s design language on the international stage.</p>',
    published: true,
  },
];

async function main() {
  const blog = await ensureBlog('journal', 'Journal');
  await ensurePage(
    'about',
    'The Story of Penya Collective',
    'about',
    'Born in the heart of Harare, Penya Collective is a premium fashion house dedicated to the art of radiance.'
  );

  for (const article of articles) {
    await ensureArticle(blog.id, article);
  }

  console.log('Seeded Journal articles and About page.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
