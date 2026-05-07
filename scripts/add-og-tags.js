/* Inject Open Graph + Twitter card meta tags into every HTML file in /site/.
   - og:title and og:description derive from the page's <title> and <meta name=description>.
   - og:url derives from the canonical link added earlier.
   - All pages share the same og:image (the truck-branded social card).
   Idempotent — re-running with the same data is a no-op. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'site');
const ORIGIN = 'https://bigbenstowingandrecovery.co.uk';
const OG_IMAGE = ORIGIN + '/img/og-image.jpg';
const SITE_NAME = "Big Ben's Towing & Recovery";
const TWITTER_SITE = '';   // Add @handle once a Twitter account exists

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full, out);
    else if (d.isFile() && d.name.endsWith('.html')) out.push(full);
  });
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const files = [];
walk(ROOT, files);

let updated = 0;
let already = 0;

files.forEach(file => {
  let html = fs.readFileSync(file, 'utf8');

  // Skip if already wired up (look for our marker comment)
  if (html.includes('<!-- og:tags -->')) {
    already++;
    return;
  }

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const descMatch  = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const canonMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i);

  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : SITE_NAME;
  const desc  = descMatch  ? decodeEntities(descMatch[1])         : '24/7 vehicle recovery and transport across the North East. Call 07754 984 147.';
  const url   = canonMatch ? canonMatch[1]                        : ORIGIN + '/';

  const tags =
    '<!-- og:tags -->\n' +
    '<meta property="og:type" content="website" />\n' +
    '<meta property="og:site_name" content="' + escapeAttr(SITE_NAME) + '" />\n' +
    '<meta property="og:title" content="' + escapeAttr(title) + '" />\n' +
    '<meta property="og:description" content="' + escapeAttr(desc) + '" />\n' +
    '<meta property="og:url" content="' + url + '" />\n' +
    '<meta property="og:image" content="' + OG_IMAGE + '" />\n' +
    '<meta property="og:image:width" content="1200" />\n' +
    '<meta property="og:image:height" content="630" />\n' +
    '<meta property="og:image:alt" content="Big Ben’s Towing &amp; Recovery branded flatbed truck" />\n' +
    '<meta property="og:locale" content="en_GB" />\n' +
    '<meta name="twitter:card" content="summary_large_image" />\n' +
    (TWITTER_SITE ? '<meta name="twitter:site" content="' + TWITTER_SITE + '" />\n' : '') +
    '<meta name="twitter:title" content="' + escapeAttr(title) + '" />\n' +
    '<meta name="twitter:description" content="' + escapeAttr(desc) + '" />\n' +
    '<meta name="twitter:image" content="' + OG_IMAGE + '" />';

  // Insert before </head>
  if (html.includes('</head>')) {
    html = html.replace('</head>', tags + '\n</head>');
    fs.writeFileSync(file, html);
    updated++;
  }
});

console.log('OG tags — updated: ' + updated + ' · already present: ' + already);
