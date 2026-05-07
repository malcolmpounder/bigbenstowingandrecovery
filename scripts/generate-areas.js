#!/usr/bin/env node
/* =========================================================
   Generate one SEO-tuned landing page per town listed in
   data/areas.json into site/areas/<slug>.html

   Run:   node scripts/generate-areas.js
   ========================================================= */
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'areas.json'), 'utf8'));
const outDir = path.join(ROOT, 'site', 'areas');
fs.mkdirSync(outDir, { recursive: true });

const RATE = 1.75;

// Sample-quote scenarios so each area page shows real numbers
const SAMPLES = [
  { label: 'Local recovery (5 miles within town)',         miPickupToDrop:  5 },
  { label: 'Recovery to a Newcastle bodyshop',             miPickupToDrop: 10 },
  { label: 'Long-distance transport to Manchester (~140 mi)', miPickupToDrop: 140, extraReturn: 20 }
];

function priceFor(area, mid, extraReturn) {
  // base→pickup + pickup→drop + drop→base
  const total = area.miles + mid + (area.miles + (extraReturn || 0));
  let price = Math.round(total * RATE);
  if (price < 40) price = 40;   // matches the £40 min in T&Cs
  return { total, price };
}

function template(area, neighbours) {
  const lines = [];
  const samples = SAMPLES.map(s => {
    const { total, price } = priceFor(area, s.miPickupToDrop, s.extraReturn || 0);
    return `<tr><td>${s.label}</td><td>${total} mi</td><td>£${price}</td></tr>`;
  }).join('');

  const neighbourLinks = neighbours.map(n =>
    `<a href="${n.slug}.html">${n.name}</a>`
  ).join(' · ');

  const fullPostcode = area.postcode.includes(' ') ? area.postcode : area.postcode + '*';

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Vehicle Recovery in ${area.name} | Big Ben's Towing &amp; Recovery</title>
<meta name="description" content="24/7 vehicle recovery, breakdown and transport in ${area.name}, ${area.county}. Honest per-mile pricing from Great Lumley. Call 07754 984 147." />
<link rel="icon" href="../img/logo.jpg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700&display=swap" />
<link rel="stylesheet" href="../css/style.css" />
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "serviceType": "Vehicle Recovery",
  "provider": {
    "@type": "AutomotiveBusiness",
    "name": "Big Ben's Towing & Recovery",
    "telephone": "+447754984147",
    "address": { "@type":"PostalAddress","addressLocality":"Great Lumley","postalCode":"DH3 4HU","addressCountry":"GB" }
  },
  "areaServed": { "@type":"Place", "name":"${area.name}, ${area.county}" }
}
</script>
</head>
<body>

<header class="site-header">
  <div class="container nav">
    <a class="brand" href="../index.html"><img src="../img/logo.jpg" alt="" /><div><div class="name">BIG BEN'<span>S</span></div><div class="tag">Towing &amp; Recovery</div></div></a>
    <button class="nav-toggle" onclick="document.getElementById('navlinks').classList.toggle('open')">&#9776;</button>
    <nav class="nav-links" id="navlinks">
      <a href="../index.html">Home</a><a href="../services.html">Services</a>
      <a href="../quote.html">Get a Quote</a><a href="../scrap.html">Scrap My Car</a>
      <a href="../areas.html">Areas</a><a href="../contact.html">Contact</a>
    </nav>
    <a class="btn btn-call danger" href="tel:+447754984147">07754&nbsp;984&nbsp;147</a>
  </div>
</header>
<div class="stripe"></div>

<section class="hero" style="min-height:50vh;">
  <div class="container">
    <h1>Vehicle Recovery in<br/><span class="accent">${area.name}</span></h1>
    <p class="lede">24/7 breakdown, accident recovery and transport across ${area.name} and the wider ${area.county} area. Just ${area.miles} miles from our base in Great Lumley — most jobs reached inside the hour.</p>
    <div class="hero-cta">
      <a class="btn danger btn-call" href="tel:+447754984147">Call 07754 984 147</a>
      <a class="btn ghost" href="../quote.html">Instant Quote &rarr;</a>
    </div>
  </div>
</section>
<div class="stripe"></div>

<section style="padding: 60px 0;">
  <div class="container">
    <div class="section-head" style="text-align:left;">
      <h2>Recovery in <span class="accent">${area.name}</span> — what we do</h2>
      <p>If you've broken down, had a bump, or need a vehicle moving in or out of ${area.name}, we'll be with you fast. Postcode coverage <strong>${fullPostcode}</strong> and surrounding villages.</p>
    </div>

    <div class="grid">
      <article class="card"><div class="icon">🚨</div><h3>Breakdown in ${area.name}</h3><p>Won't start, flat battery, mechanical fault — call any time. We get you off the roadside and to a garage of your choice.</p></article>
      <article class="card"><div class="icon">💥</div><h3>Accident Recovery</h3><p>Insurance-friendly recovery to your bodyshop or insurer's compound. Goods-in-transit insured.</p></article>
      <article class="card"><div class="icon">🚗</div><h3>Vehicle Transport</h3><p>Auction collections, classic moves, sales delivery. Single-vehicle flatbed, careful loading.</p></article>
      <article class="card"><div class="icon">💷</div><h3>Scrap My Car (${area.name})</h3><p>Cash for unwanted vehicles. Indicative offers from our <a href="../scrap.html">scrap calculator</a>, paid same day.</p></article>
    </div>
  </div>
</section>

<section class="alt">
  <div class="container">
    <div class="section-head">
      <h2>Sample Prices from <span class="accent">${area.name}</span></h2>
      <p>All-in pricing at £1.75 per mile, including the run from our base in Great Lumley.</p>
    </div>
    <div class="form-card" style="max-width:720px; margin:0 auto;">
      <table style="width:100%; border-collapse:collapse; color:var(--white);">
        <thead><tr style="border-bottom:1px solid #444; text-align:left;"><th style="padding:8px 0;">Job</th><th>Total miles</th><th>Price</th></tr></thead>
        <tbody>${samples}</tbody>
      </table>
      <p class="form-help" style="margin-top:14px;">Indicative only — confirmed by phone. <a href="../quote.html">Get a custom quote</a>.</p>
    </div>
  </div>
</section>

<section>
  <div class="container">
    <div class="section-head">
      <h2>Nearby <span class="accent">Areas</span></h2>
      <p>We cover ${area.name}'s neighbouring towns and villages too.</p>
    </div>
    <p style="text-align:center; line-height:2.4;">${neighbourLinks}</p>
    <p style="text-align:center;"><a class="btn ghost" href="../areas.html">See all areas &rarr;</a></p>
  </div>
</section>

<section class="cta-banner">
  <div class="container">
    <h2>Need recovery in ${area.name} <span class="accent">right now?</span></h2>
    <a class="btn danger btn-call" href="tel:+447754984147">Call 07754 984 147</a>
  </div>
</section>

<footer class="site-footer">
  <div class="container footer-grid">
    <div><p>Family-run recovery in the North East. ${area.miles} miles from ${area.name}.</p></div>
    <div><h4>Services</h4><p><a href="../services.html">All services</a><br/><a href="../quote.html">Quote</a><br/><a href="../scrap.html">Scrap</a></p></div>
    <div><h4>Legal</h4><p><a href="../terms.html">Terms</a><br/><a href="../privacy.html">Privacy</a></p></div>
    <div><h4>Get In Touch</h4><p>📞 <a href="tel:+447754984147">07754 984 147</a></p></div>
  </div>
  <div class="container footer-bottom">
    <div>&copy; <span id="yr"></span> Big Ben's Towing &amp; Recovery.</div>
    <div>Site by Big Ben's</div>
  </div>
</footer>

<a class="float-call" href="tel:+447754984147" aria-label="Call now">📞</a>
<div class="cookie-banner" id="cookieBanner"><p>We use only essential cookies.</p><button class="btn" onclick="acceptCookies()">OK</button></div>
<script src="../js/main.js"></script>
</body>
</html>
`;
}

// Pick the 6 closest other areas as "neighbours"
function neighboursFor(area, all) {
  return all
    .filter(a => a.slug !== area.slug)
    .map(a => ({ ...a, dist: Math.abs(a.miles - area.miles) +
        Math.hypot((a.lat - area.lat) * 69, (a.lng - area.lng) * 43) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 8);
}

// Build a sitemap as we go
const sitemap = ['index.html', 'services.html', 'quote.html', 'scrap.html', 'areas.html', 'contact.html', 'terms.html', 'privacy.html'];

let count = 0;
data.areas.forEach(area => {
  const neighbours = neighboursFor(area, data.areas);
  const html = template(area, neighbours);
  fs.writeFileSync(path.join(outDir, area.slug + '.html'), html);
  sitemap.push('areas/' + area.slug + '.html');
  count++;
});

// Write a sitemap.xml
const baseUrl = 'https://bigbenstowingandrecovery.co.uk/';
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sitemap.map(p => `  <url><loc>${baseUrl}${p}</loc></url>`).join('\n') +
  '\n</urlset>\n';
fs.writeFileSync(path.join(ROOT, 'site', 'sitemap.xml'), xml);

// And a robots.txt
fs.writeFileSync(path.join(ROOT, 'site', 'robots.txt'),
  'User-agent: *\nAllow: /\nSitemap: ' + baseUrl + 'sitemap.xml\n');

console.log(`Generated ${count} area pages in ${outDir}`);
console.log(`Sitemap: ${sitemap.length} URLs.`);
