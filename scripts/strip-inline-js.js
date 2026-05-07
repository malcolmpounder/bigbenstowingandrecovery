// Strip executable inline JS from HTML files so the site can ship under
// a stricter CSP. Preserves <script type="application/ld+json"> blocks and
// <script src="…"> external loads.
//
// Specifically:
//   - Removes inline <script>…</script> blocks (where there's no src= and no type, or type="text/javascript")
//   - Removes inline onclick="..." attributes
//   - On contact.html, swaps the inline form-handler script for <script src="js/contact.js">
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
let inlineScriptsRemoved = 0;
let onclickStripped = 0;
let contactWired = false;

files.forEach(file => {
  let html = fs.readFileSync(file, 'utf8');
  const original = html;
  const rel = path.relative(SITE, file).replace(/\\/g, '/');

  // 1) Remove inline onclick handlers
  html = html.replace(/\s+onclick="[^"]*"/g, function () {
    onclickStripped++;
    return '';
  });

  // 2) Remove executable inline <script> blocks (keeps JSON-LD and src= ones)
  html = html.replace(/<script(?:\s+type="text\/javascript")?\s*>([\s\S]*?)<\/script>/g, function (m, body) {
    // Don't strip if it's just whitespace
    if (!body.trim()) return m;
    inlineScriptsRemoved++;
    return '';
  });

  // 3) Special-case contact.html: ensure js/contact.js is loaded after main.js
  if (rel === 'contact.html' && !html.includes('js/contact.js')) {
    html = html.replace(
      /<script\s+src="js\/main\.js"\s*><\/script>/,
      '<script src="js/main.js"></script>\n<script src="js/contact.js"></script>'
    );
    contactWired = true;
  }

  if (html !== original) {
    fs.writeFileSync(file, html);
    touched++;
  }
});

console.log('Strip inline JS:');
console.log('  Files touched:           ' + touched);
console.log('  Inline <script> blocks:  ' + inlineScriptsRemoved + ' removed');
console.log('  onclick="…" attrs:       ' + onclickStripped + ' removed');
console.log('  contact.js wired:        ' + (contactWired ? 'yes' : 'already present'));
