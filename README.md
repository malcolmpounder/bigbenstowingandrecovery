# Big Ben's Towing & Recovery — website

Static site for **bigbenstowingandrecovery.co.uk**, deployed to Cloudflare Pages with a couple of Cloudflare Pages Functions for the dynamic bits (DVLA reg lookup, contact form delivery).

## Quick start

```bash
# One-off: install image tooling for the build scripts
npm install -g sharp-cli html-validate lighthouse

# Local dev server (port 4180, mocks /api/reg-lookup from data/fixture-regs.json)
node scripts/serve.js

# Run all codegen + validators (do this before every deploy)
node scripts/build.js

# Same but skip the validation pass (fast local rebuild)
node scripts/build.js --quick
```

## What's where

```
site/                     ← deployable directory (Cloudflare Pages "build output")
  index.html              ← homepage
  about.html              ← about / process explainer
  services.html           ← top-level services listing
  motorbike-recovery.html
  classic-car-transport.html
  ev-recovery.html
  trade.html              ← B2B landing
  auction-collection.html ← Copart, BCA, Manheim, Aston Barclay
  motorway-breakdown.html ← safety guide (HowTo + Speakable schema)
  faq.html                ← FAQPage schema
  reviews.html            ← "leave a Google review" prompt page
  pay.html                ← Stripe Payment Link short-code resolver
  quote.html              ← per-mile recovery quote calculator
  scrap.html              ← scrap-car offer calculator
  contact.html            ← contact form (POSTs to /api/contact)
  areas.html              ← areas index
  areas/<slug>.html       ← 54 area pages (Service + BreadcrumbList + landmarks)
  404.html                ← branded not-found
  offline.html            ← service-worker fallback (works without signal)
  terms.html / privacy.html
  manifest.webmanifest    ← PWA manifest
  sw.js                   ← service worker
  _headers                ← Cloudflare Pages security + cache headers
  _redirects              ← Cloudflare Pages short URLs (e.g. /breakdown)
  robots.txt / sitemap.xml
  css/
    critical.css          ← inlined into every <head> by the build
    style.css             ← full stylesheet
    fonts.css             ← self-hosted @font-face (generated)
  js/
    main.js               ← cookie banner, sticky bar, share-location, FAQ hash, etc.
    quote.js              ← quote calculator
    scrap.js              ← scrap calculator + DVLA reg lookup
    contact.js            ← contact form (validation, honeypot, POST to /api/contact)
    pay.js                ← payment-link code resolver
  data/                   ← hand-editable JSON drives content
    areas.json            ← town list + lat/lng + miles from base
    area-landmarks.json   ← per-town local detail (roads + landmarks)
    weights.json          ← UK make/model → weight band (scrap calc)
    fixture-regs.json     ← demo plates for the reg-lookup mock
    testimonials.json     ← homepage testimonials (auto-hides when empty/template-only)
    recent-jobs.json      ← homepage "recent recoveries" feed (same pattern)
    availability.json     ← live availability badge (available / busy / offline)
    ratings.json          ← AggregateRating schema (set enabled=true once reviews exist)
    payment-links.json    ← short-code → Stripe Payment Link map
  img/                    ← logo, hero, gallery (jpg + webp, multiple icon sizes)
  fonts/                  ← self-hosted Anton + Inter (latin subset)

functions/                ← Cloudflare Pages Functions (server-side)
  api/reg-lookup.js       ← DVLA Vehicle Enquiry Service proxy
  api/contact.js          ← contact form delivery (Web3Forms or Resend)

scripts/                  ← build / codegen tooling
  build.js                ← orchestrator — run this before deploy
  serve.js                ← local dev server (mocks /api/reg-lookup)
  add-canonical-urls.js   ← <link rel="canonical">
  add-pwa-tags.js         ← favicon / manifest / apple-touch-icon
  add-og-tags.js          ← Open Graph + Twitter cards
  add-image-dimensions.js ← width/height attrs for layout-shift prevention
  add-webp-variants.js    ← <picture> wrapping for WebP fallback
  add-breadcrumb-schema.js
  enrich-area-schema.js   ← Service schema + geo per area page
  inject-area-landmarks.js
  inject-aggregate-rating.js
  inline-critical-css.js
  fix-html-issues.js      ← auto-fixes for tel-non-breaking, raw &, button[type]
  build-sitemap.js
  download-fonts.js       ← refresh self-hosted Google Fonts
  swap-to-self-hosted-fonts.js
  strip-inline-js.js
  generate-areas.js       ← regenerates the 54 area pages from areas.json
  validate-html.js
  check-links.js
  build-client-questions-docx.js  ← regenerates CLIENT_FIRST_QUESTIONS.docx
```

## Editing the site as a non-coder (for Big Ben)

Most everyday updates are **just JSON edits** — no HTML changes needed. After editing, run `node scripts/build.js` (or push and let Cloudflare's build do it).

| Want to update… | Edit | Notes |
|---|---|---|
| Customer reviews on the homepage | `site/data/testimonials.json` | Remove the `_template` field on entries you've made real |
| Recent jobs strip on homepage | `site/data/recent-jobs.json` | Same pattern as testimonials |
| Live availability badge | `site/data/availability.json` | `"status": "available" \| "busy" \| "offline"` |
| Google review count + average | `site/data/ratings.json` | Set `enabled: true` once you have real numbers |
| Payment-link short codes | `site/data/payment-links.json` | Map your codes (e.g. `BB-1234`) to Stripe Payment Link URLs |
| Pricing rates | `site/js/quote.js` (`RATE_PER_MILE`) and `site/js/scrap.js` (`EMR_RATE_PER_TONNE`, `MIN_PAYOUT`) | Constants at the top |
| Demo regs for the scrap calculator | `data/fixture-regs.json` | Production also needs DVLA_VES_KEY env var |
| Town list (add/remove areas) | `site/data/areas.json` | Then run `node scripts/generate-areas.js` |

## Build pipeline

`node scripts/build.js` runs the codegen + validation chain in the right order:

1. Image dimensions → 2. WebP `<picture>` wrappers → 3. Canonical URLs → 4. PWA tags →
5. Open Graph + Twitter cards → 6. Area-page rich schema → 7. Area-page landmarks →
8. BreadcrumbList schema → 9. HTML issue auto-fixes → 10. AggregateRating injection →
11. Inline critical CSS → 12. Sitemap → 13. Internal link checker → 14. HTML validation

Build aborts on the first script that fails. Validation steps don't abort the build — they just exit non-zero so CI can flag them.

Pass `--quick` to skip the validation pass for faster local rebuilds.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).

## Tooling versions

This project was built and tested against:

- Node ≥18 (uses `fetch`, `URL`)
- `sharp-cli` (image optimisation)
- `html-validate` (HTML linter)
- `lighthouse` (performance / a11y audit)
- `docx` (regenerates the client questions Word doc)

Cloudflare Pages provides Node 22 by default — these scripts work there too.
