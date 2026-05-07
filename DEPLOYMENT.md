# Deployment — Cloudflare Pages

End-to-end checklist for getting the site live on **bigbenstowingandrecovery.co.uk** with email and form delivery working.

## Why Cloudflare Pages

Free hosting + free Functions (the dynamic bits — DVLA reg lookup, contact form). DNS, SSL, edge caching, Brotli compression and bot protection are all included. The `_headers` and `_redirects` files in `site/` are read by Cloudflare automatically.

---

## 1. One-time setup

### Domain
1. Buy `bigbenstowingandrecovery.co.uk` at **Cloudflare Registrar** (cheapest at-cost, ~£5/year, manages DNS automatically). Alternative: any registrar — point nameservers at Cloudflare afterwards.
2. Once Cloudflare has the domain, the rest of the setup is in the Cloudflare dashboard.

### Pages project
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** (or **Direct upload** if you'd rather drag-drop).
2. Build settings:
   - **Framework preset**: None
   - **Build command**: `node scripts/build.js --quick` (skip validation if you've already run a full build locally; use `node scripts/build.js` to also lint)
   - **Build output directory**: `site`
3. Custom domain: dashboard → **Custom domains → Set up a custom domain → bigbenstowingandrecovery.co.uk**. Cloudflare adds the DNS record automatically.

### Environment variables (Pages project → Settings → Environment variables)
| Name | Where to get it | Required for |
|---|---|---|
| `DVLA_VES_KEY` | [DVLA developer portal](https://developer-portal.driver-vehicle-licensing.api.gov.uk/) — apply for VES, ~5–10 working days | Live reg lookup in the scrap calculator |
| `WEB3FORMS_KEY` *(option 1)* | [web3forms.com](https://web3forms.com) — free | Contact form email delivery |
| `RESEND_API_KEY` *(option 2)* | [resend.com](https://resend.com) — free for 3k emails/month | Contact form email delivery (cleaner branding than Web3Forms) |
| `CONTACT_RECIPIENT` | The inbox info@…  forwards to (e.g. Big Ben's Gmail) | Resend only |

Pick **either** Web3Forms or Resend — `functions/api/contact.js` checks `WEB3FORMS_KEY` first, then `RESEND_API_KEY`.

### Email — Cloudflare Email Routing (free)
1. Cloudflare dashboard → **Email → Email Routing → Get started**.
2. Add `info@bigbenstowingandrecovery.co.uk` and forward it to Big Ben's existing inbox.
3. Verify the destination (one-click email).
4. Optional: add `quotes@`, `scrap@`, `trade@` etc — same destination, helps with sorting.

### Sending "as" the new address (Gmail example)
1. In Gmail → Settings → Accounts and Import → "Send mail as" → Add another email.
2. Email: `info@bigbenstowingandrecovery.co.uk`. SMTP: `smtp.gmail.com` or use Gmail's "Send through Gmail" option (the simpler one).
3. Verify via the email Cloudflare forwards through.
4. Now Gmail can compose and reply *as* `info@…` while the inbox is just regular Gmail.

---

## 2. Going live (every deploy)

```bash
git push origin main
```

…or use Cloudflare's "Direct upload" tab if you're not using git.

Cloudflare runs `node scripts/build.js --quick` (or whatever you set), uploads `site/`, swaps in the new build atomically. Functions in `functions/` deploy alongside.

You should see green checks at:
- `https://bigbenstowingandrecovery.co.uk/` (homepage loads)
- `https://bigbenstowingandrecovery.co.uk/api/reg-lookup?reg=AB12CDE` (returns JSON — the fixture works without a key)
- `https://bigbenstowingandrecovery.co.uk/sitemap.xml` (lists all 70 URLs)
- `https://bigbenstowingandrecovery.co.uk/manifest.webmanifest` (shows the manifest JSON)

---

## 3. Post-deploy housekeeping

### Submit the sitemap
- **Google Search Console** → Add property → bigbenstowingandrecovery.co.uk → verify (Cloudflare adds the TXT record for you) → Sitemaps → submit `https://bigbenstowingandrecovery.co.uk/sitemap.xml`.
- **Bing Webmaster Tools** → same flow.

### Test the social cards
- Open Facebook's [sharing debugger](https://developers.facebook.com/tools/debug/) and paste the homepage URL — should render the og-image card.
- Twitter's [card validator](https://cards-dev.twitter.com/validator) — same check.

### Test rich results
- [Google Rich Results Test](https://search.google.com/test/rich-results) — paste:
  - Homepage (`AutomotiveBusiness` schema)
  - FAQ page (`FAQPage` schema)
  - Motorway breakdown page (`HowTo` + `Speakable` schema)
  - An area page (`Service` + `BreadcrumbList`)

### Set up Google Business Profile
1. [google.com/business](https://www.google.com/business) → register `Big Ben's Towing & Recovery`, address `Great Lumley, DH3 4HU`.
2. Verify by postcard (Google posts a code, takes 1–2 weeks) or phone if available.
3. Once live, send the URL to me — I'll wire it into `site/reviews.html` so the "Leave a Google review" button deep-links straight to the review form.
4. As real reviews come in, edit `site/data/ratings.json` (set `enabled: true`, fill in `ratingValue` and `reviewCount`) and re-deploy. Gold stars will appear in Google search snippets within a few days.

### Apply for the DVLA VES API key
1. [DVLA developer portal](https://developer-portal.driver-vehicle-licensing.api.gov.uk/) → register → request VES (Vehicle Enquiry Service) access.
2. Approval takes ~5–10 working days.
3. Once issued, paste the key into Cloudflare Pages → Settings → Environment variables → `DVLA_VES_KEY` and re-deploy.
4. Test: hit `/api/reg-lookup?reg=YOUR_OWN_REG` in a browser — should return real make/model/year data.

### Pick a contact-form provider
- **Web3Forms** (recommended for simplicity): create an access key at web3forms.com, paste into `WEB3FORMS_KEY`.
- **Resend** (recommended if you want sender-domain branding): verify the domain in Resend, set `RESEND_API_KEY` and `CONTACT_RECIPIENT`.

Submit a test message via the contact form once configured — should land in the destination inbox within a minute.

---

## 4. Updating content without a redeploy

The JSON files in `site/data/` are short-cached (1 hour) by `_headers`, so simple content edits become visible quickly:

- **Testimonials**: edit `site/data/testimonials.json`, push — visitors see new testimonials within an hour.
- **Recent jobs**: same with `site/data/recent-jobs.json`.
- **Availability badge**: `site/data/availability.json` — could even be updated from a phone shortcut (POST to GitHub API → triggers a Pages rebuild, takes ~1 minute end-to-end).
- **Ratings (Google review count + average)**: `site/data/ratings.json`, then `node scripts/inject-aggregate-rating.js && node scripts/build-sitemap.js`, push.

Anything else (new page, copy edits, pricing change) needs a real redeploy.

---

## 5. Incident response — the site is broken

| Symptom | First check | Then |
|---|---|---|
| Site won't load | Cloudflare dashboard → status page | Roll back: dashboard → Pages → Deployments → previous deploy → "Roll back" |
| Reg lookup broken | DVLA status: developer-portal.driver-vehicle-licensing.api.gov.uk/status | Confirm `DVLA_VES_KEY` env var is still set |
| Contact form not delivering | Cloudflare dashboard → Functions logs (real-time tail) | Confirm the provider key (Web3Forms/Resend) is set + valid |
| Spam in inbox | The honeypot blocks 90%+ of bots | If volume rises, swap the contact form to use Cloudflare Turnstile (free) |

---

## 6. Costs (post-launch, recurring)

| Service | Cost |
|---|---|
| Cloudflare Pages hosting + Functions | **Free** (within generous limits — site won't approach them) |
| Cloudflare Registrar (domain renewal) | **~£5/year** |
| Cloudflare Email Routing | **Free** |
| DVLA VES API | **Free** (subject to fair use, plenty for one operator) |
| Web3Forms (contact form) | **Free** (250 submissions/month) |
| ICO data protection registration | **£40–60/year** (UK GDPR — required for any business that handles personal data, including a quote enquiry) |

**Total recurring: ~£45–65/year.**

If a real mailbox you can log into is wanted instead of forwarding, add IONOS Mail Basic (~£12/year) — see the answer Malcolm sent over.
