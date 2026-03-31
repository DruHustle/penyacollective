/**
 * hide-all-designers.mjs
 *
 * Sets every Designer metaobject entry to Hidden, removing all designers
 * from the storefront immediately.
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=yourstore.myshopify.com \
 *   SHOPIFY_ADMIN_API_TOKEN=shpat_xxx \
 *   node scripts/hide-all-designers.mjs
 *
 * To re-show individual designers, go to:
 *   Shopify Admin → Content → Metaobjects → Designer
 *   Open an entry → set Status → Published
 */

const SHOP    = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN   = process.env.SHOPIFY_ADMIN_API_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION || '2025-04';

if (!SHOP || !TOKEN) {
  console.error(
    'Missing required env vars.\n' +
    'Usage: SHOPIFY_STORE_DOMAIN=store.myshopify.com SHOPIFY_ADMIN_API_TOKEN=shpat_xxx node scripts/hide-all-designers.mjs'
  );
  process.exit(1);
}

async function graphql(query, variables = {}) {
  const res = await fetch(`https://${SHOP}/admin/api/${VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify GraphQL HTTP error ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors, null, 2)}`);
  return json.data;
}

async function fetchAllDesigners() {
  const data = await graphql(`
    query {
      metaobjects(type: "designer", first: 50) {
        edges {
          node {
            id
            handle
            displayName
          }
        }
      }
    }
  `);

  return data.metaobjects.edges.map((e) => e.node);
}

async function setDraft(id, displayName) {
  const data = await graphql(
    `
    mutation MetaobjectUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
      metaobjectUpdate(id: $id, metaobject: $metaobject) {
        metaobject { id handle displayName }
        userErrors { field message code }
      }
    }
    `,
    {
      id,
      metaobject: {
        capabilities: { publishable: { status: 'DRAFT' } },
      },
    }
  );

  const { userErrors } = data.metaobjectUpdate;
  if (userErrors.length) {
    throw new Error(`Failed to set hidden "${displayName}": ${JSON.stringify(userErrors, null, 2)}`);
  }
}

async function main() {
  const designers = await fetchAllDesigners();

  if (designers.length === 0) {
    console.log('No designer metaobject entries found.');
    console.log('Run scripts/setup-designer-metaobjects.mjs first to create them.');
    process.exit(0);
  }

  console.log(`Found ${designers.length} designer(s). Setting all to Hidden…\n`);

  for (const designer of designers) {
    await setDraft(designer.id, designer.displayName);
    console.log(`  ✓ ${designer.displayName} → Hidden`);
  }

  console.log('\nDone. All designers are now hidden from the storefront.');
  console.log('To show a designer: Shopify Admin → Content → Metaobjects → Designer → open entry → Status → Published');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
