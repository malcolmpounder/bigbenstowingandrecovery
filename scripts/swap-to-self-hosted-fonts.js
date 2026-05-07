// Replace the Google Fonts <link> stylesheet + preconnect tags with a single
// <link> to the locally generated /css/fonts.css. Idempotent.
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..', 'site');

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full, out);
    else if (d.isFile() && d.name.endsWith('.html')) out.push(full);
  });
}

const files = [];
walk(SITE, files);

let touched = 0;

files.forEach(file => {
  let html = fs.readFileSync(file, 'utf8');
  const original = html;

  // Drop Google Fonts preconnects
  html = html.replace(/\s*<link\s+rel="preconnect"\s+href="https:\/\/fonts\.googleapis\.com"\s*\/?>/g, '');
  html = html.replace(/\s*<link\s+rel="preconnect"\s+href="https:\/\/fonts\.gstatic\.com"\s+crossorigin\s*\/?>/g, '');

  // Replace the Google Fonts stylesheet link with our self-hosted one.
  // Match either single or double family list.
  const linkRe = /<link\s+rel="stylesheet"\s+href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"\s*\/?>/g;
  if (linkRe.test(html)) {
    html = html.replace(linkRe, '<link rel="stylesheet" href="/css/fonts.css" />');
  }

  if (html !== original) {
    fs.writeFileSync(file, html);
    touched++;
  }
});

console.log('Self-hosted fonts swap — files touched: ' + touched);
