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

async function ensurePageMetafield(pageId, namespace, key, value) {
  const existing = await shopify(
    `/pages/${pageId}/metafields.json?namespace=${encodeURIComponent(namespace)}&key=${encodeURIComponent(key)}`
  );
  if (existing.metafields && existing.metafields.length > 0) {
    const mf = existing.metafields[0];
    if (mf.value === value) return mf; // already correct — skip write
    await shopify(`/pages/${pageId}/metafields/${mf.id}.json`, 'PUT', {
      metafield: { id: mf.id, value },
    });
    return mf;
  }
  const created = await shopify(`/pages/${pageId}/metafields.json`, 'POST', {
    metafield: { namespace, key, value, type: 'single_line_text_field' },
  });
  return created.metafield;
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
    tags: "Journal,Partners,Fashion",
    image: { attachment: imageAttachment("blog-ivhu.jpg"), filename: "ivhu-tribe-zimbabwean-fashion.jpg" },
    summary_html: "Ivhu Tribe is a Zimbabwean fashion collective turning tribal prints and ancestral codes into contemporary statements. A closer look at the brand and the creative mind behind it.",
    body_html: "<p>Established in 2023, Ivhu Tribe is deeply committed to preserving Zimbabwe's cultural identity through fashion. The brand's name, \"Ivhu,\" means \"land\" or \"soil\" in Shona — a symbol of the deep connection to the earth, and the belief that just as soil nourishes life, fashion can breathe new life into African contemporary culture.</p><h3>Fashion as Storytelling</h3><p>With a focus on tribal prints and elements that celebrate Zimbabwe's cultural diversity, Ivhu Tribe seamlessly blends modern aesthetics with the essence of African heritage. Their designs range from extravagant to sleek, always incorporating a signature edge that reflects the vibrancy and spirit of their native land. Each piece is not just fashion — it is a storytelling experience, connecting wearers to the values and traditions of Zimbabwe and the wider African continent.</p><h3>Global Ambition, Rooted Identity</h3><p>Ivhu Tribe's participation in World Fashion Week and World Fashion Exhibition China 2024 is part of a wider mission: to elevate the appreciation of African ethnic wear locally and globally, while preserving the rich history and diversity of African costume. Their collection offers a fresh perspective on African contemporary fashion, combining tradition with innovation.</p><h3>The Creative Mind: Jasper Mandizera</h3><p>Jasper Mandizera, the creative force behind Ivhu Tribe, is passionate about using fashion as a medium to network, educate, and foster cultural exchange. As a filmmaker and movie enthusiast, Jasper has a deep understanding of how costumes carry meaning — and through Ivhu Tribe, he continues to champion cultural diversity in the face of globalisation. Keep an eye out for their upcoming short film, which brings that vision to screen.</p>",
    published: true,
  },
  {
    title: "Haus of Stone: Architecture Dressed in Fabric",
    handle: "haus-of-stone-partner-spotlight",
    author: "Penya Collective",
    tags: "Journal,Partners,Fashion",
    image: { attachment: imageAttachment("blog-penya-collective.jpg"), filename: "haus-of-stone-zimbabwean-fashion.jpg" },
    summary_html: "Haus of Stone draws from Zimbabwe's ancient stone architecture and bold natural landscapes to create garments that carry the weight and beauty of the land.",
    body_html: "<p>Haus of Stone takes its name from the very bedrock of Zimbabwe — the ancient stone structures and geological formations that have shaped the land for millennia. For this brand, fashion is architecture: structured, considered, and built to endure.</p><h3>Stone as Inspiration</h3><p>The Great Zimbabwe ruins — dry-stone walls assembled without mortar, standing for over 800 years — represent a philosophy of precision and permanence that Haus of Stone channels directly into its design language. Clean lines, deliberate silhouettes, and a restrained palette of earthen tones and charcoal greys form the visual vocabulary of every collection.</p><h3>Materials That Mirror the Land</h3><p>Haus of Stone prioritises heavyweight natural fabrics — linen, structured cotton, and textured wool blends — that carry the same sense of gravity and intention as the landscapes that inspire them. These are pieces built for presence, not trend.</p><h3>A Voice for Zimbabwean Modernism</h3><p>What makes Haus of Stone distinctive within the Penya Collective is its commitment to contemporary minimalism rooted in African context. It challenges the assumption that African fashion must be loud or ornate — instead offering quiet confidence through cut, texture, and restraint. A powerful counterpoint, and a necessary one.</p>",
    published: true,
  },
  {
    title: "By Bakari: Swahili Soul, Global Stage",
    handle: "by-bakari-partner-spotlight",
    author: "Penya Collective",
    tags: "Journal,Partners,Fashion",
    image: { attachment: imageAttachment("designer-bybakari.jpg"), filename: "by-bakari-african-fashion.jpg" },
    summary_html: "By Bakari brings a pan-African sensibility to contemporary fashion — weaving Swahili coastal culture, East African textiles, and a quietly confident design voice into every piece.",
    body_html: "<p>The name Bakari carries weight. In Swahili tradition, it means \"of noble promise\" — and By Bakari lives up to it. This is a brand built on the conviction that African fashion does not need to choose between its roots and the world stage. It can, and should, hold both.</p><h3>A Coastal Vocabulary</h3><p>Where many Zimbabwean designers draw from the landlocked highlands and savannah of the interior, By Bakari brings something distinct to the Penya Collective: the light and rhythm of East Africa's coastline. Kangas, kikois, and the geometric traditions of Swahili textile culture inform the brand's colour palette and surface treatment — rich, warm, and unapologetically coastal.</p><h3>Tailoring Meets Tradition</h3><p>By Bakari's signature is the meeting point between sharp contemporary tailoring and traditional textile knowledge. A structured blazer cut from kitenge. A relaxed wide-leg trouser in a hand-dyed Swahili print. The genius is in the tension — formal structure carrying something ancient and specific in its fabric.</p><h3>Dressing the Diaspora</h3><p>By Bakari speaks directly to Africans living globally — people who carry multiple cultural identities and want their wardrobe to reflect that complexity. Not costume. Not appropriation. Just honest representation of who they are: cosmopolitan, rooted, and elegantly themselves.</p><h3>Why By Bakari Belongs in the Collective</h3><p>Penya Collective has always been more than a single country's story. By Bakari reinforces that — bringing East African craft traditions and a diaspora-aware design voice that expands what the Collective represents. When you see their work alongside Ivhu Tribe or Haus of Stone, the conversation becomes richer. That is exactly the point.</p>",
    published: true,
  },
  {
    title: "How We Make It: Inside the Penya Production Process",
    handle: "how-we-make-it-production-process",
    author: "Penya Collective",
    tags: "Journal,Craftsmanship,Behind the Scenes",
    image: { attachment: imageAttachment("blog-hemp.jpg"), filename: "penya-collective-production-process.jpg" },
    summary_html: "From first sketch to finished garment, here is what intentional production actually looks like — and why every step matters.",
    body_html: "<p>We get asked often: what does small-batch actually mean? How does a piece go from concept to the hands of someone in Harare, London, or Heidelberg? This is our attempt to answer that honestly.</p><h3>It Starts With a Brief, Not a Trend</h3><p>Our collections do not begin with a mood board pulled from international runways. They begin with a conversation — with our artisan partners, with the materials available in a given season, with the stories we feel need to be told. The brief asks: what do we want this piece to say? Who is it for? How long should it last?</p><h3>Pattern Making and Fitting</h3><p>Every pattern is developed in collaboration with our Harare-based tailors. We run multiple toile fittings before cutting into final fabric — a process that slows things down deliberately. A pattern that does not fit correctly on a real body is a pattern that gets adjusted, not pushed through.</p><h3>Cutting and Construction</h3><p>We cut in small runs — typically between 20 and 60 units per style. This is not a limitation we apologise for; it is a feature. Small runs mean every piece is handled by fewer hands, inspected more closely, and finished with attention that is impossible at scale. Our construction follows garment-industry best practice: reinforced seams, matched patterns, hand-finished hems where the design requires it.</p><h3>Quality Control</h3><p>Before any piece is approved for fulfilment, it passes through a final QC check covering construction integrity, finish quality, sizing accuracy, and label placement. Pieces that do not pass are either reworked or removed from the run. We do not ship seconds.</p><h3>Packaging and Fulfilment</h3><p>Orders are fulfilled from our warehouse in Heidelberg, Germany, using minimal, recyclable packaging. No tissue paper for the sake of it. No unnecessary inserts. The unboxing experience should feel considered, not cluttered.</p><h3>Why It Matters</h3><p>Every step we have described above takes more time and costs more than the fast-fashion alternative. We believe that cost is worth bearing — because the result is a garment that someone can wear for a decade, not discard after a season. That is the exchange we are asking you to make with us. We think it is a fair one.</p>",
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
  {
    handle: 'fit-guide',
    title: 'Find Your Fit',
    templateSuffix: 'fit-guide',
    bodyHtml: '',
  },
  {
    handle: 'designer-ivhu-tribe',
    title: 'Ivhu Tribe',
    templateSuffix: 'designer',
    heroAsset: 'designer-ivhutribe.jpg',
    collectionHandle: 'ivhu-tribe',
    bodyHtml: '<p>Ivhu — the Shona word for soil — tells you everything about what this brand is reaching for. Not spectacle for its own sake, but fashion that is tethered to earth, culture, and memory.</p><h3>Born From the Land</h3><p>Founded in 2023 by self-taught designer Jasper Mandizera, Ivhu Tribe entered the Zimbabwean fashion landscape with a clear philosophical anchor: culture is not background noise. It is the whole story. Every silhouette, every textile choice, every collection asks the same question — how do we honour what came before while speaking to where we are going?</p><h3>The Aesthetic</h3><p>Ivhu Tribe moves between extravagance and restraint with ease. Their collections range from bold ceremonial statements to quietly powerful everyday pieces — always carrying the visual codes of Zimbabwe\'s cultural traditions without becoming costumes. Tribal prints are recontextualised, natural fibres speak to sustainability, and the occasional unexpected material — including an outfit made from baobab tree — signals a brand unafraid to experiment from a place of deep knowledge.</p><h3>A Global Voice</h3><p>In just one year, Ivhu Tribe represented Zimbabwe at World Fashion Week China 2024 and the World Fashion Exhibition — a testament to both the quality of their work and the urgency of the story they carry. Co-led by Jasper and model Charlotte Muziri, the brand understands that fashion is performance, film, and education as much as it is clothing.</p><h3>Why They Shine</h3><p>In a crowded global fashion conversation, Ivhu Tribe does something rare: they speak from specific, rooted experience — and the specificity is what makes them universal. This is the Penya Collective ethos made visible.</p>',
  },
  {
    handle: 'designer-a-tribe-called-zimbabwe',
    title: 'A Tribe Called Zimbabwe',
    templateSuffix: 'designer',
    heroAsset: 'designer-atcz.jpg',
    collectionHandle: 'a-tribe-called-zimbabwe',
    bodyHtml: '<p>The name says everything. A Tribe Called Zimbabwe is not a fashion brand with heritage as a marketing angle — it is heritage as the point of origin, and fashion as the medium of declaration.</p><h3>An Identity, Not a Trend</h3><p>ATCZ was built to articulate something that many Zimbabwean creatives feel but rarely see reflected back: pride that is not performative, identity that is not explained away, culture that is worn with full conviction and zero apology. The brand\'s work does not reference Zimbabwean identity. It is Zimbabwean identity — translated into cut, colour, and construction.</p><h3>The Aesthetic</h3><p>Expect deliberate palettes drawn from the land: ochre, clay, storm-cloud grey, the deep green of Zimbabwe\'s highlands. Expect silhouettes that carry weight — structured pieces that refuse to be ignored. ATCZ garments are not background pieces. They are opening statements.</p><h3>Craft as Declaration</h3><p>Every piece from ATCZ reflects the belief that Zimbabwean craft belongs at the highest level of fashion — not as curiosity, not as exception, but as standard. The finishing is meticulous. The storytelling runs through every seam. When you wear ATCZ, you are wearing an argument — that African luxury is not aspiring to something. It already is something.</p><h3>Why They Shine</h3><p>At Penya Collective, we need voices that speak without hedging. ATCZ is exactly that voice — bold, grounded, and unapologetically Zimbabwean.</p>',
  },
  {
    handle: 'designer-feli-nandi',
    title: 'Feli Nandi',
    templateSuffix: 'designer',
    heroAsset: 'designer-felinandi.jpg',
    collectionHandle: 'feli-nandi-apparels',
    bodyHtml: '<p>Fashion is language. Music is language. Feli Nandi speaks both — and has spent her career proving that they were always the same conversation.</p><h3>Designer, Musician, One Vision</h3><p>Felistus Chipendo — known artistically as Feli Nandi — launched her eponymous apparel label in 2021 alongside an already active music career. For many, that would be a distraction. For Feli Nandi, it was completion. The same soul that writes songs about identity, womanhood, and African belonging now translates those themes directly into fabric. The result is clothing that sounds like something — confident, melodic, unapologetically female.</p><h3>The Aesthetic</h3><p>Feli Nandi Apparel works in the register of contemporary African elegance: clean lines informed by traditional textile traditions, colour that draws from the landscape and the continent\'s rich visual culture, and silhouettes designed specifically for the bodies and lives of African women. Her pieces are not replicas of heritage — they are its future form.</p><h3>Recognition at the Highest Level</h3><p>When the newly inaugurated President of Namibia, Netumbo Nandi-Ndaitwah, chose to mark her historic moment in a Feli Nandi creation, it was not a brand decision. It was a statement of values. The President of a nation, on one of the most significant days in her country\'s history, wanted to be dressed in African craft. That is the weight this brand carries.</p><h3>Zimbabwe Music Awards</h3><p>In 2023, Feli Nandi was named Best Female Artist at the Zimbabwe Music Awards — recognition not just of her musical output, but of the cultural contribution she makes across disciplines. A rare creative who excels at multiple crafts without diminishing either.</p><h3>Why She Shines</h3><p>Feli Nandi represents something important for the Penya Collective: the designer as complete creative. Not just someone who makes beautiful things, but someone who understands beauty as a full-spectrum practice — sonic, visual, cultural, political.</p>',
  },
  {
    handle: 'designer-haus-of-stone',
    title: 'Haus of Stone',
    templateSuffix: 'designer',
    heroAsset: 'designer-hausofstone.jpg',
    collectionHandle: 'hausofstone',
    bodyHtml: '<p>There is a phrase that defines Haus of Stone: where fantasy intersects with reality. It sounds like a tagline. It is actually a design philosophy — and once you understand it, every piece makes sudden, perfect sense.</p><h3>The Origin</h3><p>Founded by Danayi Chapfika Madondo in 2014 and relaunched with renewed focus in 2018 with her collection "Ode to Askana," Haus of Stone draws its name and its spirit from the Shona phrase "Dzimba Dzemabwe" — the origin of the word Zimbabwe itself, meaning "houses of stone." The Great Zimbabwe ruins — dry-stone walls assembled without mortar, standing for over eight centuries — are not just a historical reference. They are a design model: structures of extraordinary precision and permanence.</p><h3>Afro-Minimal, Slow Fashion</h3><p>Haus of Stone operates as a slow fashion brand. In a world addicted to volume and velocity, Danayi deliberately slows down. She repurposes artisan-made home objects and bestows luxury status on them. She looks at everyday African scenarios — domestic, communal, intimate — and reframes them as high fashion. The result is clothing that carries the weight of real life while elevating it to art.</p><h3>The World Has Noticed</h3><p>Haus of Stone has been featured in Vogue and Glamour Magazine. Their work was selected to represent Zimbabwe at the British Council\'s Creative DNA programme at London Fashion Week. Their film "Exodus: A Journey To New Worlds" screened at the 9th Fashion Film Festival Milano. They have exhibited at the CANEX Inter Africa Trade Fair — operating comfortably at international level, entirely on their own terms.</p><h3>Why They Shine</h3><p>Haus of Stone proves that Afro-minimal fashion — rooted in Africa but stripped of stereotype — is not just viable. It is compelling on a world stage. That is exactly the kind of proof the Penya Collective is built to carry forward.</p>',
  },
  {
    handle: 'designer-panashe',
    title: 'Panashe',
    templateSuffix: 'designer',
    heroAsset: 'designer-panashe.jpg',
    collectionHandle: 'panashe-designs',
    bodyHtml: '<p>Chipo Hwami arrived in the United States from Zimbabwe with four hundred dollars and a single suitcase. She built a fashion brand from that. But the more important detail is not the hustle — it is the why.</p><h3>Fashion as Confidence</h3><p>Panashe Designs was not built to fill a wardrobe gap. It was built to fill an emotional one. Chipo\'s work starts from a belief that clothing is not decorative — it is functional in the deepest sense. A well-made, intentionally designed garment gives a woman presence before she speaks a word. That is the exchange Panashe offers: deliberate style as a form of armour, confidence, and declaration.</p><h3>The Aesthetic</h3><p>Panashe pieces are bold. Not loud — bold. There is a difference. Loud seeks attention. Bold commands respect. Chipo\'s work favours rich colours, statement silhouettes, and finishes that make clear this garment was not made by accident. Limited production runs ensure exclusivity — these are pieces for women who want to stand apart, not just dress up.</p><h3>Rooted in Zimbabwe</h3><p>Despite her international base, Chipo\'s design language remains unmistakably Zimbabwean. The heritage is not worn as nostalgia — it is used as a design vocabulary. The patterns, the colour relationships, the sense of proportion: all informed by where she came from, channelled into clothing made for wherever her customers are going.</p><h3>Why She Shines</h3><p>Panashe is a reminder that Zimbabwean fashion does not only live in Harare. It lives wherever Zimbabwean creators carry it — and Chipo Hwami carries it with exceptional intention.</p>',
  },
  {
    handle: 'designer-by-bakari',
    title: 'By Bakari',
    templateSuffix: 'designer',
    heroAsset: 'designer-bybakari.jpg',
    collectionHandle: 'by-bakari',
    bodyHtml: '<p>Bakari Sibanda grew up in Bulawayo. He came to fashion not through a design school or an apprenticeship, but through a deep personal conviction that African textiles were being misread — and a determination to correct the record.</p><h3>Reframing the African Print</h3><p>By Bakari was built to dismantle a familiar story. Bakari\'s work takes vibrant, pattern-rich, culturally loaded textiles and repositions them in the contemporary wardrobe. Not because he wants to modernise African print, but because he knows it was never just historical. It was always current. Always elegant. Always capable of sitting alongside any other fashion tradition in the world.</p><h3>The Aesthetic</h3><p>By Bakari has a signature energy: confident, wearable, urban. His pieces are not conceptual exercises — they are clothes people want to live in. The construction is clean, the proportions are considered, and the textiles do the talking. He targets a generation that is global in its references and unambiguously African in its identity.</p><h3>Digital-First, International by Design</h3><p>By Bakari took his brand global through social media — international orders arriving from the UK, Canada, Australia. He built those relationships without intermediaries, on the strength of the work and the clarity of the brand\'s voice. A Zimbabwean brand with a genuinely international audience, built from the ground up.</p><h3>Why He Shines</h3><p>By Bakari is proof that the appetite for genuine African fashion — not Western fashion with African accents, but fashion made by and for African people — is global. Bakari found that audience by trusting the work. At Penya Collective, we trust it too.</p>',
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
    if (page.heroAsset) {
      await ensurePageMetafield(result.id, 'custom', 'hero_image_asset', page.heroAsset);
      console.log(`  ↳ hero_image_asset = ${page.heroAsset}`);
    }
    if (page.collectionHandle) {
      await ensurePageMetafield(result.id, 'custom', 'collection_handle', page.collectionHandle);
      console.log(`  ↳ collection_handle = ${page.collectionHandle}`);
    }
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
