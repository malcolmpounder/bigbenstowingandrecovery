/* Internal link checker — walk every HTML file in /site/, extract every
   <a href> and <img src> / <source srcset>, and flag any that point at a
   missing local file. External links (http/https/tel/mailto/data) skipped.

   Usage: node scripts/check-links.js
   Exit code: 0 if all good, 1 if anything broken. */
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

function isExternal(url) {
  return /^(https?:|tel:|mailto:|data:|javascript:|#|\?)/.test(url) || url === '';
}

function resolveLocal(htmlFile, target) {
  // Strip query string and fragment
  const cleaned = target.replace(/[?#].*$/, '');
  if (!cleaned) return null;

  // Site-rooted (/foo) vs relative
  let abs;
  if (cleaned.startsWith('/')) {
    abs = path.join(SITE, cleaned);
  } else {
    abs = path.resolve(path.dirname(htmlFile), cleaned);
  }

  // Trailing slash → index.html
  if (cleaned.endsWith('/') || cleaned === '/') {
    abs = path.join(abs, 'index.html');
  }

  return abs;
}

const files = [];
walk(SITE, files);

let totalLinks = 0;
let broken = [];

files.forEach(file => {
  const html = fs.readFileSync(file, 'utf8');

  // <a href="..."> and <link href="...">  (only same-origin)
  const aRe = /<(?:a|link)\s[^>]*?href="([^"]+)"/gi;
  // <img src="...">, <script src="...">, <source src="..."> / srcset="..."
  const srcRe = /<(?:img|script|source|video|audio)\s[^>]*?(?:src|srcset)="([^"]+)"/gi;

  const targets = new Set();
  let m;
  while ((m = aRe.exec(html)))   targets.add(m[1]);
  while ((m = srcRe.exec(html))) {
    // srcset can be a comma-separated list with size descriptors
    m[1].split(',').forEach(part => {
      const url = part.trim().split(/\s+/)[0];
      if (url) targets.add(url);
    });
  }

  targets.forEach(target => {
    if (isExternal(target)) return;
    totalLinks++;
    const abs = resolveLocal(file, target);
    if (!abs) return;
    if (!fs.existsSync(abs)) {
      broken.push({
        file: path.relative(SITE, file),
        href: target,
        resolved: path.relative(SITE, abs)
      });
    }
  });
});

console.log('\nInternal link check');
console.log('-------------------');
console.log('Files scanned: ' + files.length);
console.log('Internal links / refs: ' + totalLinks);

if (broken.length === 0) {
  console.log('Broken: 0 ✓\n');
  process.exit(0);
}

console.log('Broken: ' + broken.length + ' ✗\n');
broken.forEach(b => {
  console.log('  ' + b.file + '  →  ' + b.href + '   (resolved: ' + b.resolved + ')');
});
process.exit(1);
