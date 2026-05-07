/* Idempotently insert <link rel="canonical"> into every HTML file in /site/.
   Canonical URL derived from the file's path relative to /site/. */
const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://bigbenstowingandrecovery.co.uk';
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

let added = 0;
let already = 0;

files.forEach(file => {
  let html = fs.readFileSync(file, 'utf8');

  // Skip if a canonical already exists
  if (/<link\s+rel="canonical"/i.test(html)) {
    already++;
    return;
  }

  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  // The homepage uses bare origin; everything else uses origin + path
  const canonical = rel === 'index.html' ? ORIGIN + '/' : ORIGIN + '/' + rel;

  const tag = '<link rel="canonical" href="' + canonical + '" />';

  // Insert just after the <link rel="icon"> if it exists, else before </head>
  if (/<link\s+rel="icon"[^>]*\/?>/i.test(html)) {
    html = html.replace(/(<link\s+rel="icon"[^>]*\/?>)/i, '$1\n' + tag);
  } else if (html.includes('</head>')) {
    html = html.replace('</head>', tag + '\n</head>');
  } else {
    return; // no <head>, skip
  }

  fs.writeFileSync(file, html);
  added++;
});

console.log('Canonical URLs — added: ' + added + ' · already present: ' + already);
