/**
 * setup-designer-metaobjects.mjs
 *
 * Creates the "Designer" Metaobject definition and populates one entry per
 * existing designer.  Run this once after the theme has been pushed to make
 * designers manageable entirely from the Shopify Admin.
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=yourstore.myshopify.com \
 *   SHOPIFY_ADMIN_API_TOKEN=shpat_xxx \
 *   node scripts/setup-designer-metaobjects.mjs
 *
 * After running, go to Shopify Admin → Content → Metaobjects → Designer to:
 *   • Add a new designer   — click "Add entry"
 *   • Hide a designer      — open the entry and set Status → Hidden
 *   • Show a designer      — open the entry and set Status → Published
 *   • Remove a designer    — delete the entry
 *   • Reorder designers    — drag entries into the desired order
 *
 * Fields per entry:
 *   name         Brand name, e.g. "Ivhu Tribe"
 *   country      Origin label, e.g. "Zimbabwe"
 *   hero_image   Portrait image — upload via the file picker in Admin
 *   page_handle  Shopify page slug, e.g. "designer-ivhu-tribe"
 *                Must match a page created by seed-shopify-content.mjs
 *
 * NOTE: hero_image is intentionally left blank in this seed — upload images
 * manually in Admin or via a staged-upload script. Until an image is uploaded
 * the theme falls back to the page's hero_image_asset metafield (set by
 * seed-shopify-content.mjs).
 */

const SHOP    = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN   = process.env.SHOPIFY_ADMIN_API_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION || '2025-04';

if (!SHOP || !TOKEN) {
  console.error(
    'Missing required env vars.\n' +
    'Usage: SHOPIFY_STORE_DOMAIN=store.myshopify.com SHOPIFY_ADMIN_API_TOKEN=shpat_xxx node scripts/setup-designer-metaobjects.mjs'
  );
  process.exit(1);
}

// ── GraphQL helper ────────────────────────────────────────────────────────────

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

  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors, null, 2)}`);
  }

  return json.data;
}

// ── Definition ────────────────────────────────────────────────────────────────

async function ensureDefinition() {
  // Check if the definition already exists.
  const existing = await graphql(`
    query {
      metaobjectDefinitionByType(type: "designer") {
        id
        type
        name
      }
    }
  `);

  if (existing.metaobjectDefinitionByType) {
    console.log(`Metaobject definition already exists: ${existing.metaobjectDefinitionByType.name} (${existing.metaobjectDefinitionByType.id})`);
    return existing.metaobjectDefinitionByType;
  }

  // Create the definition.
  const data = await graphql(
    `
    mutation MetaobjectDefinitionCreate($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition {
          id
          type
          name
        }
        userErrors {
          field
          message
          code
        }
      }
    }
    `,
    {
      definition: {
        type: 'designer',
        name: 'Designer',
        displayNameKey: 'name',
        fieldDefinitions: [
          {
            key: 'name',
            name: 'Name',
            description: 'Brand name as it appears on the homepage grid and designer cards.',
            type: 'single_line_text_field',
            required: true,
          },
          {
            key: 'country',
            name: 'Country',
            description: 'Origin country shown as a label above the designer name.',
            type: 'single_line_text_field',
            required: false,
          },
          {
            key: 'hero_image',
            name: 'Hero Image',
            description: 'Portrait/card image shown on the homepage grid. Upload a 3:4 ratio image for best results.',
            type: 'file_reference',
            required: false,
          },
          {
            key: 'page_handle',
            name: 'Page Handle',
            description: 'Shopify page slug for the designer profile, e.g. "designer-ivhu-tribe". Must match an existing page.',
            type: 'single_line_text_field',
            required: true,
          },
        ],
        capabilities: {
          publishable: { enabled: true },
        },
      },
    }
  );

  const { userErrors, metaobjectDefinition } = data.metaobjectDefinitionCreate;

  if (userErrors.length) {
    throw new Error(`Failed to create definition: ${JSON.stringify(userErrors, null, 2)}`);
  }

  console.log(`Created metaobject definition: ${metaobjectDefinition.name} (${metaobjectDefinition.id})`);
  return metaobjectDefinition;
}

// ── Entries ───────────────────────────────────────────────────────────────────

/**
 * Creates or updates (upserts) a metaobject entry.
 * hero_image is omitted — add images manually via Admin or a staged-upload script.
 */
async function upsertDesigner({ handle, name, country, pageHandle }) {
  const data = await graphql(
    `
    mutation MetaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject {
          id
          handle
          displayName
        }
        userErrors {
          field
          message
          code
        }
      }
    }
    `,
    {
      handle: { type: 'designer', handle },
      metaobject: {
        fields: [
          { key: 'name',        value: name },
          { key: 'country',     value: country },
          { key: 'page_handle', value: pageHandle },
        ],
        capabilities: {
          publishable: { status: 'ACTIVE' },
        },
      },
    }
  );

  const { userErrors, metaobject } = data.metaobjectUpsert;

  if (userErrors.length) {
    throw new Error(`Failed to upsert designer "${name}": ${JSON.stringify(userErrors, null, 2)}`);
  }

  return metaobject;
}

// ── Designer data ─────────────────────────────────────────────────────────────
// Matches the pages created by seed-shopify-content.mjs.
// Display order on the storefront follows the order of entries in Admin
// (drag-and-drop to reorder). The seed creates them in the order listed here.

const designers = [
  { handle: 'ivhu-tribe',                name: 'Ivhu Tribe',                country: 'Zimbabwe', pageHandle: 'designer-ivhu-tribe' },
  { handle: 'a-tribe-called-zimbabwe',   name: 'A Tribe Called Zimbabwe',   country: 'Zimbabwe', pageHandle: 'designer-a-tribe-called-zimbabwe' },
  { handle: 'feli-nandi',                name: 'Feli Nandi',                country: 'Zimbabwe', pageHandle: 'designer-feli-nandi' },
  { handle: 'haus-of-stone',             name: 'Haus of Stone',             country: 'Zimbabwe', pageHandle: 'designer-haus-of-stone' },
  { handle: 'panashe',                   name: 'Panashe',                   country: 'Zimbabwe', pageHandle: 'designer-panashe' },
  { handle: 'by-bakari',                 name: 'By Bakari',                 country: 'Zimbabwe', pageHandle: 'designer-by-bakari' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Setting up Designer metaobject definition…\n');
  await ensureDefinition();

  console.log('\nUpserting designer entries…\n');
  for (const designer of designers) {
    const entry = await upsertDesigner(designer);
    console.log(`  ✓ ${entry.displayName} → /admin/content/entries/${entry.handle} (id: ${entry.id})`);
  }

  console.log(`
Done. ${designers.length} designer entries are now active.

Next steps:
  1. Go to Shopify Admin → Content → Metaobjects → Designer
  2. Open each entry and upload a Hero Image using the file picker
     (Until uploaded, the theme falls back to the image set by seed-shopify-content.mjs)
  3. Drag entries to set the display order on the homepage grid
  4. To add a new designer: click "Add entry", fill in the fields, set Status → Published
  5. To hide a designer: open the entry and set Status → Draft
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
