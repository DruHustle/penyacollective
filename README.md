# Penya Collective — Shopify Theme

Custom Shopify storefront for **Penya Collective**, a Harare-born luxury fashion house. Built on the Shopify Heritage theme (v3.4.0) with bespoke section configurations, brand content, and a CI/CD pipeline for automated deployment.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Theme base | Shopify Heritage v3.4.0 |
| Templating | Liquid + JSON section schemas |
| Styling | CSS custom properties (no build step) |
| Testing | Playwright (E2E) |
| CI/CD | GitHub Actions |
| Deployment | Shopify CLI (`shopify theme push`) |
| Email marketing | Mailchimp (newsletter section) |

---

## Repository Structure

```
penyacollective/
├── assets/          # Images, fonts, JS, CSS files
├── blocks/          # Reusable theme blocks
├── config/
│   ├── settings_data.json    # Active theme settings
│   └── settings_schema.json  # Theme settings schema
├── layout/          # Root layout (theme.liquid)
├── locales/         # Translation strings
├── sections/        # Section templates (Liquid + JSON)
├── snippets/        # Reusable Liquid partials
├── templates/       # Page templates (JSON)
│   ├── index.json            # Homepage
│   ├── collection.json       # Collection pages
│   ├── product.json          # Product pages
│   ├── page.about.json       # About page
│   ├── page.sustainability.json
│   ├── page.contact.json
│   ├── page.shipping.json
│   ├── page.terms.json
│   ├── page.privacy.json
│   ├── blog.json
│   ├── article.json
│   ├── cart.json
│   ├── search.json
│   └── 404.json
├── tests/
│   └── e2e.spec.js           # Playwright end-to-end tests
├── .github/
│   └── workflows/ci.yml      # CI/CD pipeline
├── playwright.config.js
└── package.json
```

---

## Local Development

### Prerequisites

- [Shopify CLI](https://shopify.dev/docs/storefronts/themes/tools/cli) — `npm install -g @shopify/cli@latest`
- [Node.js](https://nodejs.org/) v20+
- A Shopify Partner account with a development store

### Setup

```bash
# Clone the repo
git clone https://github.com/your-org/penyacollective.git
cd penyacollective

# Install dev dependencies (Playwright)
npm install

# Authenticate with Shopify
shopify auth login --store your-store.myshopify.com

# Start local dev server (hot-reload preview)
shopify theme dev --store your-store.myshopify.com
```

The dev server runs at `http://127.0.0.1:9292` by default.

---

## Pushing to Shopify

### Manual push (to a specific theme)

```bash
# Push to a theme by ID (leaves existing theme intact, uploads changes)
shopify theme push --store your-store.myshopify.com --theme THEME_ID

# Push and make it the live theme
shopify theme push --store your-store.myshopify.com --theme THEME_ID --allow-live

# Push as a new unpublished theme (safe for review before going live)
shopify theme push --store your-store.myshopify.com
```

Find your `THEME_ID` in the Shopify admin under **Online Store → Themes**, or via:

```bash
shopify theme list --store your-store.myshopify.com
```

### Automated deployment (GitHub Actions)

Merging to `main` triggers the CI pipeline:

1. **Theme Check** — Shopify's linter validates Liquid/JSON syntax
2. **E2E Tests** — Playwright runs against a live preview URL
3. **Deploy** — `shopify theme push` publishes to the live theme (only if secrets are configured)

#### Required GitHub Secrets

Set these in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | e.g. `penyacollective.myshopify.com` |
| `SHOPIFY_CLI_THEME_TOKEN` | Theme access token — generate in Shopify admin under **Apps → Develop apps** |
| `SHOPIFY_THEME_ID` | The numeric ID of the live theme to deploy to |
| `E2E_BASE_URL` | The Shopify preview URL for your staging/dev theme (enables E2E tests in CI) |

#### Generating a Theme Access Token

1. Shopify Admin → **Apps → Develop apps**
2. Create a new app (e.g. "GitHub Actions Deploy")
3. Under **Configuration**, enable **Theme access**
4. Install the app and copy the **Admin API access token**
5. Add it as `SHOPIFY_CLI_THEME_TOKEN` in GitHub Secrets

> The deploy step is skipped if any of the three Shopify secrets are absent, allowing safe use on forks or draft PRs.

---

## Running Tests

```bash
# Headless (CI mode)
npm run test:e2e

# With browser visible
npm run test:e2e:headed

# Playwright debug mode (step through)
npm run test:e2e:debug
```

Tests run against `http://127.0.0.1:9292` by default. Override with:

```bash
E2E_BASE_URL=https://your-preview-url.myshopify.com npm run test:e2e
```

---

## Updating Store Content

All day-to-day content updates are done through the **Shopify Admin** — no code changes required.

### Products & Pricing

Navigate to: Shopify Admin → Products

- **Add a product** — click **Add product**, fill in title, description, images, and set the price under **Pricing**
- **Edit a price** — open the product, scroll to **Pricing**, update the **Price** field. For sale prices, set a **Compare at price** (the original) and a lower **Price** (the sale price) — Shopify will show the discount automatically
- **Variants** (sizes, colours) — under **Variants**, each variant has its own price, stock level, and SKU
- **Stock levels** — update under **Inventory** on each product or via **Products → Inventory** for bulk updates

> Prices update live as soon as you click **Save** — no theme push needed.

### Images

Where images are managed depends on what they're attached to:

| Image type | Where to update |
|---|---|
| Product images | Shopify Admin → Products → [product] → Media |
| Collection cover image | Shopify Admin → Products → Collections → [collection] → Image |
| Homepage / section images | Shopify Admin → Online Store → Themes → Customise → [section] |
| Blog post featured image | Shopify Admin → Content → Blog posts → [post] → Featured image |
| Site logo | Shopify Admin → Online Store → Themes → Customise → Header |

**Replacing theme asset images** (hero, Instagram grid, etc.) — upload the new file to the repo under `/assets/` with the **same filename**, then push:

```bash
shopify theme push --store your-store.myshopify.com --theme THEME_ID
```

Or upload directly in **Shopify Admin → Online Store → Themes → [theme] → Edit code → Assets**.

### Blog Posts (Journal)

Navigate to: Shopify Admin → Content → Blog posts

1. Click **Write a blog post**
2. Add a title, body content (rich text editor), and a **Featured image**
3. Set the **Blog** to `Journal` (or create a new blog under **Content → Blogs**)
4. Add tags for filtering if needed
5. Set **Visibility** to **Visible** and click **Save**

The homepage journal section pulls the 3 most recent published posts automatically.

### Pages (About, Sustainability, etc.)

Navigate to: Shopify Admin → Content → Pages

- Edit page content (title, body text) directly in the rich text editor
- The theme applies the correct template automatically based on the page handle (e.g. a page with handle `about` uses `page.about.json`)
- To change the handle: scroll down to **Search engine listing** → edit the URL slug

### Collections

Navigate to: Shopify Admin → Products → Collections

- **Create a collection** — choose **Manual** (hand-pick products) or **Automated** (rules-based, e.g. tag = "new-arrivals")
- **Add products to a collection** — open the collection and use the **Products** section to search and add
- The collection title, description, and image all appear on the collection page automatically

### Announcement Bar

Navigate to: Shopify Admin → Online Store → Themes → Customise → Header group → Announcements

Edit the announcement text blocks directly in the theme customiser. No code change needed.

### Navigation Menus

Navigate to: Shopify Admin → Content → Navigation

- `main-menu` — used in the site header
- `footer` — used under "Client Care" in the footer

Add, remove, or reorder links within each menu. Changes apply immediately.

---

## Mailchimp Integration

The homepage newsletter section captures emails. To connect it to Mailchimp:

### Option A — Shopify Email (recommended for simplicity)

Use Shopify's native email marketing. No external integration needed — subscribers are captured in **Shopify Admin → Customers → Email subscribers**.

### Option B — Mailchimp via Shopify App

1. Install the [Mailchimp for Shopify app](https://apps.shopify.com/mailchimp) from the Shopify App Store
2. Connect your Mailchimp account and select the audience list to sync to
3. The app syncs Shopify email subscribers and purchase data to Mailchimp automatically
4. In Mailchimp, set up your welcome automation under **Automations → Email → Welcome new subscribers**

### Option C — Mailchimp embedded form (custom)

If you want a Mailchimp-hosted form directly in the newsletter section:

1. In Mailchimp, go to **Audience → Signup forms → Embedded forms**
2. Select **Naked** form style and copy the `<form>` HTML
3. In Shopify admin, navigate to the newsletter section in the theme editor and paste the form into a **Custom Liquid** block, replacing the default form

> Note: Using Mailchimp's embedded form means subscribers go directly to Mailchimp and are **not** added to Shopify's customer list. Use the Shopify app (Option B) if you want data in both places.

---

## Key Brand Assets

All brand assets live in `/assets/`:

| File | Usage |
|---|---|
| `penya logo.png` | Site logo (set in theme settings) |
| `penya-hero-main.jpg` | Primary homepage hero image |
| `penya-hero-desert.jpg` | Secondary hero image |
| `penya-about-collective.jpg` | About page hero |
| `penya-instagram-*.jpg` | Instagram grid placeholders (6 images) |
| `penya-blog-*.jpg` | Journal/blog featured images |
| `Penya.jpg` | Brand editorial image |

---

## Theme Customisation Notes

- **Color schemes** are defined in `config/settings_data.json`. The theme uses named schemes: `scheme-1` (dark/charcoal), `scheme-2` (warm cream), `scheme-3` (footer dark), `scheme-4` (announcement bar).
- **Section heights** for the hero use `svh` units. The `section_height` field accepts only preset values: `auto`, `small`, `medium`, `large`, `full-screen`, `custom`. When set to `custom`, `section_height_custom` is an integer percentage of `svh` (e.g. `95` = `95svh`).
- **Instagram grid** — the grid currently renders local asset images as placeholders. When a live Instagram integration is available, replace the `custom-liquid` section in `templates/index.json` with a third-party Instagram feed app block.
- **Transparent header** is enabled on the homepage via `header-group.json`. The hero height accounts for the announcement bar offset (`--header-group-height: 32px`).

---

## Deployment Checklist (going live)

- [ ] Upload all images in `/assets/` to the Shopify theme via `shopify theme push`
- [ ] Create the required Shopify **Pages** in the admin: About, Sustainability, Contact, Shipping, Privacy, Terms
- [ ] Set up **Navigation** menus: `main-menu` and `footer` in Shopify Admin → Navigation
- [ ] Configure **Social links** in the footer (Instagram, TikTok, Pinterest already set)
- [ ] Connect **Mailchimp** or enable Shopify Email marketing
- [ ] Set up **GitHub Secrets** for automated CI/CD deployment
- [ ] Add products and collections to the store
- [ ] Review and publish the theme from Shopify Admin → Online Store → Themes
