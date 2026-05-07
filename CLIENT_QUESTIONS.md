# Big Ben's Towing & Recovery — Questions for the Client

Every figure, policy and claim baked into the website that's been **assumed**, not verified with the client. Each question links back to where the assumption is used in the code so you can change the answer and we know exactly what to update.

Format: `🔴 Critical` (must be answered before launch — legal / safety / accuracy) · `🟠 High` (significantly improves accuracy) · `🟢 Operational` (good to confirm) · `🔵 Future` (no rush).

---

## A. Business basics

| # | Status | Question | Used in |
|---|---|---|---|
| A1 | 🔴 | What's the legal trading name? "Big Ben's Towing & Recovery" — is that the trading name, and what's the proprietor's actual name? | terms.html, schema.org JSON-LD on every page |
| A2 | 🔴 | **Sole trader** or **Ltd company**? If Ltd, company number please. | `terms.html` §1 — currently states "sole trader" |
| A3 | 🔴 | **VAT-registered?** Currently the terms say no. | `terms.html` §3.5 |
| A4 | 🔴 | **Goods-in-transit insurance** — provider, policy number, cover amount per vehicle? Same questions for **public liability**. | `terms.html` §8, services.html, faq.html |
| A5 | 🔴 | **ICO registration** (Data Protection Act fee, £40–£60/yr)? Required because the site collects personal data. | `privacy.html` |
| A6 | 🟠 | Trading address — `Great Lumley, Chester-le-Street, DH3 4HU` — correct? Is that the depot/yard or just correspondence? | every footer |
| A7 | 🟢 | Is the depot open to walk-ins, or only for breakdown/transport call-outs? | contact.html says "We come to you — no need to visit the depot" |

## B. Phone, WhatsApp & email

| # | Status | Question | Used in |
|---|---|---|---|
| B1 | 🔴 | Is **07754 984 147** the right primary 24/7 number? | every page, sticky bar, JSON-LD |
| B2 | 🔴 | **WhatsApp** — same number? (Currently the WhatsApp link assumes the same number.) | `js/main.js` constant `WHATSAPP_NUM` |
| B3 | 🔴 | Existing email inbox he wants `info@bigbenstowingandrecovery.co.uk` to forward to? | hosting decision (option A) |
| B4 | 🟠 | Anyone else who answers the phone (partner / family on-call)? Any genuinely unanswered windows? | claim of "24/7" in copy |
| B5 | 🔵 | Want any other addresses set up? (e.g. `quotes@`, `scrap@`, `trade@`?) Cloudflare forwarding is free per address. | hosting setup |

## C. Operating hours

| # | Status | Question | Used in |
|---|---|---|---|
| C1 | 🔴 | Genuinely 24/7, or core hours + on-call after hours? Be honest — affects the legal accuracy of the "24/7" claim. | every page, schema.org `openingHoursSpecification` says 24/7 |
| C2 | 🟠 | Bank holidays — surcharge mentioned in terms. Standard rate or always +X%? | `terms.html` §3.4 |

## D. Pricing — recovery & transport

| # | Status | Question | Used in |
|---|---|---|---|
| D1 | 🔴 | **£1.75 per mile** — still the current rate? | `js/quote.js` line 14, terms, faq, every area page |
| D2 | 🔴 | **£40 minimum local job** — correct? | `js/quote.js` line 109, terms §3.3 |
| D3 | 🟠 | **20% urgent uplift** — keep, change, or remove? | `js/quote.js` line 16 |
| D4 | 🟠 | **15% classic / low-clearance uplift** — keep? | `js/quote.js` line 17 |
| D5 | 🟠 | Quote validity — how long does an indicative price stay valid for? (Currently silent.) | could add to T&Cs |
| D6 | 🟢 | Is the round-trip mileage methodology fair (base→pickup→drop-off→base)? | `js/quote.js` |
| D7 | 🟢 | Is there ever a reason to NOT charge return-to-base mileage (e.g. customer-pays-only-leg deals)? | quote calculator |

## E. Pricing — scrap

| # | Status | Question | Used in |
|---|---|---|---|
| E1 | 🔴 | **EMR Sunderland** — is this his actual ATF? Any other ATFs he uses? | `js/scrap.js` line 18, scrap.html, services.html, faq.html |
| E2 | 🔴 | Current EMR scrap rate per tonne? (We have **£270/tonne** as of 2026.) | `js/scrap.js` line 14 |
| E3 | 🔴 | **£30 minimum scrap payout** — correct? Should it ever be £0 (not bother)? | `js/scrap.js` line 16, terms §3.3 |
| E4 | 🟠 | Catalytic converter bonus typical range? (Currently £60 / £30 / £0.) | `js/scrap.js`, scrap.html dropdowns |
| E5 | 🟠 | V5C — mandatory or "no V5C accepted with signed declaration"? | terms §10, faq Q10 |
| E6 | 🟠 | Photo ID requirement at collection? | implied in faq Q10 |
| E7 | 🟢 | How quickly can scrap collection realistically happen? (FAQ says "same day if before lunchtime".) | `faq.html` Q13 |
| E8 | 🟢 | Vehicle weight bands — accuracy? We use: small 0.95t / medium 1.30t / large 1.55t / SUV 1.85t / MPV 1.70t / van 2.00t. | `scrap.html` `<select id="vclass">` |

## F. Cancellation & deposits

| # | Status | Question | Used in |
|---|---|---|---|
| F1 | 🟠 | **£25 wasted-trip charge** + already-driven mileage on driver-dispatched cancellations — fair? | `terms.html` §6.2 |
| F2 | 🟠 | **25% deposit** for pre-booked transport — correct percentage? | `terms.html` §4.2 |
| F3 | 🟠 | Deposit non-refundable inside 24h of pickup, unless slot re-let — agree? | `terms.html` §6.4 |

## G. Payment & invoicing

| # | Status | Question | Used in |
|---|---|---|---|
| G1 | 🔴 | **Stripe account** — has one already, or needs help setting one up? | terms §5.2, faq Q3, scrap.html, quote.html copy |
| G2 | 🔴 | Card-on-the-spot — does he carry a card reader (Stripe / SumUp / Square)? Or only phone-link payment? | quote calculator copy |
| G3 | 🟢 | Bank account name & sort code for scrap bank-transfer payouts (sent privately, not to me)? | for his records |
| G4 | 🟢 | **Late-payment interest 4% above BoE base** — keep, or simplify to "we'll send a reminder"? | `terms.html` §5.3 |
| G5 | 🟢 | **Apple Pay / Google Pay** — enable them in Stripe? (Free, increases conversion.) | Stripe dashboard |

## H. Service area

| # | Status | Question | Used in |
|---|---|---|---|
| H1 | 🔴 | Confirm coverage: County Durham + Tyne & Wear + Northumberland + Teesside. Anything to add or drop? | every area page, areas.html, areas.json |
| H2 | 🟠 | Realistic ETA from base to common areas? (We claim "most North East jobs inside the hour".) | faq Q1, every area page |
| H3 | 🟢 | Any areas he refuses (e.g. specific city centres for parking)? | could add to T&Cs |
| H4 | 🟠 | UK-wide for transport — any actual upper limit? Highlands? Northern Ireland? | services.html copy, faq Q12 |
| H5 | 🟢 | The 54 area pages cover his target towns — any to add (e.g. specific villages he gets repeat work from) or remove? | `data/areas.json` |

## I. Vehicle types covered

| # | Status | Question | Used in |
|---|---|---|---|
| I1 | 🔴 | **Confirm**: cars, vans, motorbikes, classics, EVs, write-offs. Anything missing or should be removed? | services.html, faq Q7, scrap.html |
| I2 | 🟠 | **EVs** — does the truck handle them? (Many EVs can't be flat-towed; need a tilt-bed in neutral or a dolly.) | services.html, faq Q7 |
| I3 | 🟠 | **HGVs / lorries / minibuses / PSVs** — covered or not? | currently silent |
| I4 | 🟠 | **Caravans / trailers** — covered? | currently silent |
| I5 | 🟢 | **High-value** (supercar / Tesla S Plaid / classic Aston) — any insurance cap on the vehicle value? | terms §8.4 says "Glass's Guide value" |
| I6 | 🟢 | **Multiple bikes per load** — actually doable? (We claim it.) | services.html, faq Q7 |

## J. Insurance / bodyshop / fleet work

| # | Status | Question | Used in |
|---|---|---|---|
| J1 | 🟠 | Currently does work for insurers? Any preferred insurer relationships to mention? | services.html |
| J2 | 🟠 | Any bodyshops / dealers he has standing arrangements with? | services.html, contact.html |
| J3 | 🔵 | Want to actively pursue trade accounts (PO billing, 30-day terms)? Implications for the website's "Trade landing page" idea. | future feature |

## K. Auction & trade

| # | Status | Question | Used in |
|---|---|---|---|
| K1 | 🟠 | Currently collects from auctions? Which? (We mention Copart and BCA.) | faq Q11, services.html |
| K2 | 🟢 | Specific auction yards he knows in the North East? (Copart Sunderland? BCA Bedlington? Aston Barclay?) | could add to "Auction collection" page |
| K3 | 🔵 | Any pre-existing trade rate (different from retail per-mile)? | future trade page |

## L. Equipment

| # | Status | Question | Used in |
|---|---|---|---|
| L1 | 🟠 | The truck — confirm: Iveco tilt-bed flatbed, year and model? Reg? (We used **SR16KPX** as a fixture-data placeholder.) | services.html copy, fixture-regs.json line 14 |
| L2 | 🟢 | Truck capacity — weight limit and length limit? | useful for honesty in marketing |
| L3 | 🟢 | Other kit: winch, vehicle dolly, low-loader skates, soft straps for bikes — confirm? | services.html, faq Q7 |

## M. Photos & brand

| # | Status | Question | Used in |
|---|---|---|---|
| M1 | 🔴 | The 7 photos in `site/img/` — are these all his own work, with permission to use? (`hero-night.jpg`, `truck-jag.png`, `truck-merc.png`, `truck-motorbike.png`, `truck-van1.png`, `truck-branded.png`, `logo.jpg`) | gallery, hero, services, cta-banner |
| M2 | 🟠 | Any newer/better photos? Especially: the truck branded, an action shot at night, motorway recovery, EV on the bed. | gallery |
| M3 | 🟢 | The "BIG BEN'<span>S</span>" stylised name lock-up — keep, or use the supplied logo only? | every header |
| M4 | 🟢 | Brand palette: black + yellow + orange + red — keep? | css custom properties |
| M5 | 🟢 | Provide vector logo (SVG) if available — replaces the current 52×52 raster `.jpg`. | could swap in |

## N. Accreditations & memberships

| # | Status | Question | Used in |
|---|---|---|---|
| N1 | 🟠 | **PAS 43 / NHSS 17B** — currently certified? (Industry standard for highways/police rotation lists.) Interested in pursuing? | not currently mentioned |
| N2 | 🟢 | **RHA / IRTE / IVRA** memberships? | could display badges |
| N3 | 🟢 | Anything else with a logo we can show (e.g. Trading Standards approved, FSB, local Chamber of Commerce)? | trust signals |

## O. Reviews / Google Business / social

| # | Status | Question | Used in |
|---|---|---|---|
| O1 | 🔴 | **Google Business Profile** — exists? URL? (Needed for the live reviews widget I previously suggested.) | future Reviews feature |
| O2 | 🟠 | **Trustpilot** account — has one? | future Reviews feature |
| O3 | 🟠 | **Facebook business page** — link? | footer / contact |
| O4 | 🟢 | Any past customer reviews / quotes we can hard-code as static testimonials while reviews build up? | new homepage section |
| O5 | 🟢 | Is he OK to text/email past customers asking for a Google review (with a one-tap link we generate)? | review-collection campaign |

## P. DVLA / data licensing

| # | Status | Question | Used in |
|---|---|---|---|
| P1 | 🔴 | **DVLA Vehicle Enquiry Service (VES) API key** — happy to apply for one? Free, takes ~5–10 working days. Without it, the scrap calculator's reg lookup falls back to fixtures only. | `functions/api/reg-lookup.js`, scrap.html |
| P2 | 🔵 | **DVSA MOT API key** — optional, gives richer model data than VES alone. | future enhancement |

## Q. Existing online presence

| # | Status | Question | Used in |
|---|---|---|---|
| Q1 | 🟠 | **Existing website** to redirect from? URL + 301-redirect map? | DNS / pages config |
| Q2 | 🟠 | **Existing email** he's been using on business cards / van? Need to keep that working? | mailbox decision |
| Q3 | 🟢 | Any other listings to update post-launch? (Yell, ThomsonLocal, Facebook, Google Business…) | manual housekeeping |

## R. Quote / contact form delivery

| # | Status | Question | Used in |
|---|---|---|---|
| R1 | 🔴 | When the contact form is submitted, where does the message go? Email? SMS? Both? (Currently no delivery wired up.) | `contact.html`, `quote.html` |
| R2 | 🟠 | Auto-reply to the customer ("we got your message")? With phone number reminder? | future |
| R3 | 🟢 | Honeypot / Turnstile to keep bots out? (Free with Cloudflare.) | recommended |

## S. Future scope (not blocking launch)

| # | Status | Question | Used in |
|---|---|---|---|
| S1 | 🔵 | A live "we're available now / in a job until 14:30" indicator? | future |
| S2 | 🔵 | SMS-based booking flow ("text RECOVER to XXX")? | future |
| S3 | 🔵 | Integration with a job-management app for invoicing + scheduling? | future |
| S4 | 🔵 | Subscription / contract product (e.g. fleet breakdown cover for a small haulier)? | future |

## T. Domain & second domain

| # | Status | Question | Used in |
|---|---|---|---|
| T1 | 🟢 | Worth registering **`bigbenstowing.co.uk`** as a short alias and 301-redirecting? Better for print/business-cards/van wraps. ~£5/yr extra at Cloudflare. | optional |
| T2 | 🟢 | Want to lock the **`.uk`** variant too (`bigbenstowingandrecovery.uk`) as a defensive registration? | optional |

---

## Quick win list (asking these first will unblock the most build work)

1. **A4** — insurance details (any number / proof we can quote)
2. **B1, B2, B3** — phone, WhatsApp, forwarding email
3. **D1, E2, E3** — confirm pricing rates
4. **G1, G2** — Stripe status & card reader
5. **M1** — photo permission
6. **O1** — Google Business Profile URL
7. **P1** — DVLA API key application — get the form in early as it takes a week
8. **R1** — where the contact form should send messages

Once those are answered I can flip the corresponding placeholders and the site is launch-ready.
