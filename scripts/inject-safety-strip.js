// Inject the site-wide safety strip directly after the hero / first stripe
// on every page that should drive traffic to the motorway breakdown guide.
// Skips the breakdown guide itself plus low-traffic / system pages.
//
// Idempotent — wraps the injection in a marker so re-runs replace cleanly.
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..', 'site');
const SKIP_FILES = new Set([
  'motorway-breakdown.html',
  '404.html',
  'offline.html',
  'terms.html',
  'privacy.html',
  'reviews.html',
  'pay.html'
]);

const MARKER_START = '<!-- bb:safety-strip:start -->';
const MARKER_END   = '<!-- bb:safety-strip:end -->';

function safetyStripHtml(linkPrefix) {
  return (
    MARKER_START + '\n' +
    '<aside class="safety-strip" role="complementary" aria-label="Motorway breakdown safety guide">\n' +
    '  <div class="container">\n' +
    '    <span class="ss-icon" aria-hidden="true">🚨</span>\n' +
    '    <span class="ss-text">Broken down on the motorway? <a href="' + linkPrefix + 'motorway-breakdown.html">Read our 60-second safety guide first<span class="ss-arrow" aria-hidden="true">&rarr;</span></a></span>\n' +
    '  </div>\n' +
    '</aside>\n' +
    MARKER_END
  );
}

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full, out);
    else if (d.isFile() && d.name.endsWith('.html')) out.push(full);
  });
}

const files = [];
walk(SITE, files);

let injected = 0;
let alreadyHad = 0;
let skipped = 0;

files.forEach(file => {
  const rel = path.relative(SITE, file).replace(/\\/g, '/');
  const baseName = path.basename(file);

  if (SKIP_FILES.has(baseName)) {
    skipped++;
    return;
  }

  let html = fs.readFileSync(file, 'utf8');

  // Strip any existing injection so we re-add cleanly
  const marker = new RegExp(MARKER_START + '[\\s\\S]*?' + MARKER_END + '\\s*', 'g');
  html = html.replace(marker, '');

  // Path prefix — area pages need '../' to reach motorway-breakdown.html at root
  const linkPrefix = rel.startsWith('areas/') ? '../' : '';

  // Insert after the FIRST stripe div following a hero / opening section.
  // Common pattern in our pages:
  //   <section class="hero">…</section>
  //   <div class="stripe"></div>           ← insert AFTER this
  //   <section …>…</section>
  // For pages without a .hero section, we'll insert after the first stripe
  // following the closing </header> instead.
  const firstStripeAfterHero = html.match(/<section class="hero"[\s\S]*?<\/section>\s*<div class="stripe"><\/div>/);
  let modified = false;

  if (firstStripeAfterHero) {
    html = html.replace(firstStripeAfterHero[0], firstStripeAfterHero[0] + '\n\n' + safetyStripHtml(linkPrefix));
    modified = true;
  } else {
    // Pages without .hero (like areas page index, FAQ etc) — inject after the
    // first stripe div that follows the </header>.
    const m = html.match(/<\/header>\s*<div class="stripe"><\/div>/);
    if (m) {
      html = html.replace(m[0], m[0] + '\n\n' + safetyStripHtml(linkPrefix));
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(file, html);
    injected++;
  } else {
    alreadyHad++;
  }
});

console.log('Safety strip — injected: ' + injected + ' · skipped: ' + skipped + ' · no insertion point: ' + alreadyHad);
