/* Idempotently insert PWA meta tags (manifest, apple-touch-icon, multi-size
   favicon links) into every HTML file in /site/. Replaces the bare
   <link rel="icon" href="img/logo.jpg"> with a proper icon set. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'site');

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full, out);
    else if (d.isFile() && d.name.endsWith('.html')) out.push(full);
  });
}

const files = [];
walk(ROOT, files);

let updated = 0;
let alreadyHasManifest = 0;

files.forEach(file => {
  let html = fs.readFileSync(file, 'utf8');

  // Skip if manifest is already wired up
  if (/<link\s+rel="manifest"/i.test(html)) {
    alreadyHasManifest++;
    return;
  }

  // Build PWA tag block — paths root-relative so it works at any depth
  const block =
    '<link rel="icon" type="image/png" sizes="32x32" href="/img/icon-32.png" />\n' +
    '<link rel="icon" type="image/png" sizes="16x16" href="/img/icon-16.png" />\n' +
    '<link rel="apple-touch-icon" sizes="180x180" href="/img/icon-180.png" />\n' +
    '<link rel="manifest" href="/manifest.webmanifest" />';

  // Replace the existing single <link rel="icon" ...> with our block
  if (/<link\s+rel="icon"[^>]*\/?>/i.test(html)) {
    html = html.replace(/<link\s+rel="icon"[^>]*\/?>/i, block);
  } else if (html.includes('</head>')) {
    html = html.replace('</head>', block + '\n</head>');
  } else {
    return;
  }

  fs.writeFileSync(file, html);
  updated++;
});

console.log('PWA tags — updated: ' + updated + ' · already present: ' + alreadyHasManifest);
