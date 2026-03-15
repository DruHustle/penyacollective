import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '../assets');

function imageAttachment(filename) {
  return readFileSync(resolve(assetsDir, filename)).toString('base64');
}

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

async function ensureCollection(handle, title, imageFilename, bodyHtml) {
  const existing = await shopify(`/custom_collections.json?handle=${encodeURIComponent(handle)}`);
  if (existing.custom_collections && existing.custom_collections.length > 0) {
    const current = existing.custom_collections[0];
    const updated = await shopify(`/custom_collections/${current.id}.json`, 'PUT', {
      custom_collection: {
        id: current.id,
        image: { attachment: imageAttachment(imageFilename), filename: imageFilename },
      },
    });
    return updated.custom_collection;
  }
  const created = await shopify('/custom_collections.json', 'POST', {
    custom_collection: {
      title,
      handle,
      body_html: bodyHtml,
      published: true,
      image: { attachment: imageAttachment(imageFilename), filename: imageFilename },
    },
  });
  return created.custom_collection;
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
    title: "Penya Collective: Rooted in Heritage, Designed to Shine",
    handle: "penya-collective-rooted-in-heritage",
    author: "Penya Collective",
    tags: "Journal,Heritage,Sustainability,Craftsmanship",
    image: { attachment: imageAttachment("blog-penya-collective.jpg"), filename: "penya-collective-zimbabwe-heritage-fashion.jpg" },
    summary_html: "Born in Harare, built on heritage. We are a fashion house rooted in Zimbabwean artistry, sustainable values, and a deep commitment to the hands that make our work possible.",
    body_html: "<p>Penya Collective was born from a belief that luxury and integrity are not opposites. Founded in Harare, we are a fashion house that draws its language from the soil, the craft, and the culture of Zimbabwe — and designs for those who want to wear meaning as much as beauty.</p><h3>Rooted in Heritage</h3><p>Zimbabwe has a rich visual and material tradition: woven textiles, intricate beadwork, bold pattern-making, and a design sensibility that is both grounded and luminous. Penya Collective exists to honour that tradition — not as a museum piece, but as a living, evolving practice. Every collection is informed by the codes and craft of our heritage, reinterpreted for the contemporary wardrobe.</p><h3>Working With Zimbabwean Artists & Designers</h3><p>We do not work in isolation. Penya Collective collaborates directly with skilled Zimbabwean artisans, makers, and designers — people whose hands and knowledge carry generations of craft. Our supply chain is built on relationship, not extraction. We believe that fashion at its best is a collective act, and every piece we produce reflects that spirit of collaboration and mutual respect.</p><h3>Sustainable by Design</h3><p>We produce in small batches — intentionally limited quantities that reduce excess, minimise waste, and ensure every piece receives the attention it deserves. Our materials are chosen with care: premium natural fibres including hemp, organic cotton, and responsibly sourced blends that offer durability, breathability, and a lower environmental footprint. We design for permanence. The most sustainable garment is the one you keep wearing.</p><h3>Timeless Over Trend</h3><p>Fast fashion relies on obsolescence. We reject that model entirely. Our silhouettes and craftsmanship are designed to remain relevant across seasons and years — pieces that grow with you, that hold their shape and their story over time. This is what radiant luxury means to us: not excess, but excellence. Not noise, but depth.</p><h3>A House Still Growing</h3><p>We are transparent about where we are still developing. Our work to improve supply chain documentation, expand certified material sourcing, and reduce our shipping footprint is ongoing. We welcome accountability from our community and are committed to improving with every collection.</p>",
    published: true,
  },
  {
    title: "Sustainability in Focus: Hemp Fabrics",
    handle: "sustainability-hemp-fabrics",
    author: "Penya Collective",
    tags: "Journal,Sustainability,Materials",
    image: { attachment: imageAttachment("blog-hemp.jpg"), filename: "sustainable-hemp-fabric-fashion.jpg" },
    summary_html: "Hemp delivers strength, breathability, and a low-impact footprint. Here is how we finish it for softness, structure, and timeless wear.",
    body_html: "<p>Hemp is one of the most promising materials for modern luxury. It is resilient, breathable, and naturally low impact. At Penya, we are exploring how hemp can be refined into cloth that feels elevated, soft, and timeless.</p><h3>Why Hemp</h3><p>Hemp grows quickly, needs far less water than conventional cotton, and enriches the soil. That makes it a powerful foundation for responsible fashion, especially in climates where resource efficiency matters.</p><h3>Finishing For Luxury</h3><p>We focus on finishing processes that elevate the hand feel: careful washes, refined weaves, and thoughtful blends that add drape and durability without compromising the material’s character.</p><h3>Designed To Endure</h3><p>Sustainability is not only about materials. It is also about longevity. Hemp’s strength makes it ideal for pieces that are made to be worn, remembered, and kept.</p>",
    published: true,
  },
  {
    title: "Ivhu Tribe: Rooted in Soil, Dressed in Story",
    handle: "ivhu-tribe-partner-spotlight",
    author: "Penya Collective",
    tags: "Journal,Partners,Moto Moto,Fashion",
    image: { attachment: imageAttachment("blog-ivhu.jpg"), filename: "ivhu-tribe-zimbabwean-fashion.jpg" },
    summary_html: "Ivhu Tribe is a Zimbabwean fashion collective turning tribal prints and ancestral codes into contemporary statements. We sat down with their team ahead of their Moto Moto showcase.",
    body_html: "<p>Established in 2023, Ivhu Tribe is deeply committed to preserving Zimbabwe's cultural identity through fashion. The brand's name, \"Ivhu,\" means \"land\" or \"soil\" in Shona — a symbol of the deep connection to the earth, and the belief that just as soil nourishes life, fashion can breathe new life into African contemporary culture.</p><h3>Fashion as Storytelling</h3><p>With a focus on tribal prints and elements that celebrate Zimbabwe's cultural diversity, Ivhu Tribe seamlessly blends modern aesthetics with the essence of African heritage. Their designs range from extravagant to sleek, always incorporating a signature edge that reflects the vibrancy and spirit of their native land. Each piece is not just fashion — it is a storytelling experience, connecting wearers to the values and traditions of Zimbabwe and the wider African continent.</p><h3>Global Ambition, Rooted Identity</h3><p>Ivhu Tribe's participation in World Fashion Week and World Fashion Exhibition China 2024 is part of a wider mission: to elevate the appreciation of African ethnic wear locally and globally, while preserving the rich history and diversity of African costume. Their collection offers a fresh perspective on African contemporary fashion, combining tradition with innovation.</p><h3>The Creative Mind: Jasper Mandizera</h3><p>Jasper Mandizera, the creative force behind Ivhu Tribe, is passionate about using fashion as a medium to network, educate, and foster cultural exchange. As a filmmaker and movie enthusiast, Jasper has a deep understanding of how costumes carry meaning — and through Ivhu Tribe, he continues to champion cultural diversity in the face of globalisation. Keep an eye out for their upcoming short film, which brings that vision to screen.</p><h3>At Moto Moto — 25 July 2026</h3><p>This July, Ivhu Tribe joins the Moto Moto Festival in Germany for a showcase of their arts, crafts, and fashion. It is a rare opportunity to experience their work in person — garments and handcrafted pieces that carry the soil of Zimbabwe into the heart of Europe.</p>",
    published: true,
  },
  {
    title: "Moto Moto Festival in Germany: Zimbabwe on the Global Stage",
    handle: "moto-moto-festival-germany",
    author: "Penya Collective",
    tags: "Journal,Events,Global",
    image: { attachment: imageAttachment("blog-moto-moto.jpg"), filename: "moto-moto-festival-africa-germany.jpg" },
    summary_html: "Moto Moto Festival is a vibrant celebration of African music, culture, and creativity — and this July, it includes a showcase of Zimbabwean fashion, arts, and crafts.",
    body_html: "<p>Moto Moto Festival is a vibrant celebration of African music, culture, and creativity launched in 2024. Showcasing top talent from Zimbabwe and across the continent, the festival brings together dynamic performances, powerful storytelling, and an unforgettable fusion of traditional and contemporary African sounds. It’s more than a concert — it’s a cultural experience.</p><h3>Zimbabwe On The Global Stage</h3><p>From runway moments to curated installations, the festival has become a platform for Zimbabwean artisans and labels redefining what contemporary African luxury looks and feels like. Each edition deepens the conversation between heritage and innovation.</p><h3>Fashion, Arts & Crafts Showcase — 25 July 2026</h3><p>This year’s festival expands its cultural programme with a dedicated showcase of Zimbabwean fashion, arts, and crafts on the 25th of July. Expect curated garments, handcrafted pieces, and the full expression of Zimbabwe’s design language in front of a new European audience.</p><h3>The Collective Spirit</h3><p>Moto Moto is proof that culture travels. It fosters new connections, creative partnerships, and a deeper appreciation for the artistry that defines Zimbabwe’s creative scene on the international stage.</p>",
    published: true,
  },
];

const pages = [
  {
    handle: 'about',
    title: 'The Story of Penya Collective',
    templateSuffix: 'about',
    bodyHtml: 'Born in the heart of Harare, Penya Collective is a premium fashion house dedicated to the art of radiance.',
  },
  {
    handle: 'sustainability',
    title: 'Sustainability',
    templateSuffix: 'sustainability',
    bodyHtml: 'At Penya Collective, luxury is rooted in integrity.',
  },
  {
    handle: 'contact',
    title: 'Contact',
    templateSuffix: 'contact',
    bodyHtml: 'Get in touch with the Penya Collective team.',
  },
  {
    handle: 'shipping',
    title: 'Shipping & Returns',
    templateSuffix: 'shipping',
    bodyHtml: 'Information on shipping, delivery, and returns.',
  },
];

const collections = [
  {
    handle: 'men',
    title: 'Men',
    imageFilename: 'collection-men.jpg',
    bodyHtml: 'Elevated essentials for the modern man. Rooted in heritage, designed for today.',
  },
  {
    handle: 'women',
    title: 'Women',
    imageFilename: 'collection-women.avif',
    bodyHtml: 'Radiant, considered pieces for women who dress with intention.',
  },
  {
    handle: 'accessories',
    title: 'Accessories',
    imageFilename: 'collection-accessories.jpg',
    bodyHtml: 'Finishing touches crafted with the same care as every Penya garment.',
  },
];

async function main() {
  const blog = await ensureBlog('journal', 'Journal');

  for (const collection of collections) {
    const result = await ensureCollection(collection.handle, collection.title, collection.imageFilename, collection.bodyHtml);
    console.log(`Collection ready: ${result.title} → /collections/${result.handle}`);
  }

  for (const page of pages) {
    const result = await ensurePage(page.handle, page.title, page.templateSuffix, page.bodyHtml);
    console.log(`Page ready: ${result.title} → /pages/${result.handle}`);
  }

  for (const article of articles) {
    const result = await ensureArticle(blog.id, article);
    console.log(`Article ready: ${result.title} → /blogs/journal/${result.handle}`);
  }

  console.log('\nDone. All content seeded.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
