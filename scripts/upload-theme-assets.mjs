import { readFileSync } from 'fs';

const SHOP = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';
const THEME_ID = process.env.SHOPIFY_THEME_ID || process.env.SHOPIFY_DEV_THEME_ID;
const files = process.argv.slice(2);

if (!SHOP || !TOKEN || !THEME_ID) {
  console.error('Missing SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_API_TOKEN, or SHOPIFY_THEME_ID/SHOPIFY_DEV_THEME_ID.');
  process.exit(1);
}

if (files.length === 0) {
  console.error('Pass one or more theme asset paths to upload.');
  process.exit(1);
}

const url = `https://${SHOP}/admin/api/${API_VERSION}/themes/${THEME_ID}/assets.json`;

for (const key of files) {
  const value = readFileSync(key, 'utf8');
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ asset: { key, value } }),
  });

  if (!res.ok) {
    throw new Error(`${key}: ${res.status} ${await res.text()}`);
  }

  console.log(`Uploaded ${key}`);
}
