/* Wrap <img src="…jpg|png"> in a <picture> element with a WebP <source>
   when a .webp variant exists alongside the original. Idempotent — skips
   tags that are already inside a <picture>. */
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

function webpExistsFor(htmlFile, src) {
  if (/^(https?:|data:)/.test(src)) return false;
  const dir = path.dirname(htmlFile);
  const abs = src.startsWith('/')
    ? path.join(SITE, src.slice(1))
    : path.resolve(dir, src);
  const webp = abs.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  return fs.existsSync(webp);
}

function webpUrl(src) {
  return src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
}

const files = [];
walk(SITE, files);

let touched = 0;
let imgsWrapped = 0;

files.forEach(file => {
  let html = fs.readFileSync(file, 'utf8');
  let changed = false;

  // For every <img …> not already inside a <picture>, look for src + webp variant
  // Naive approach: split by <picture> blocks, only process outside them.
  const segments = html.split(/(<picture[\s\S]*?<\/picture>)/i);

  for (let i = 0; i < segments.length; i++) {
    if (segments[i].startsWith('<picture')) continue; // skip existing pictures

    segments[i] = segments[i].replace(
      /<img(\s[^>]*?)?\s+src="([^"]+\.(?:jpg|jpeg|png))"((?:\s[^>]*?)?)\s*\/?>/g,
      function (full, before, src, after) {
        if (!webpExistsFor(file, src)) return full;
        // Preserve the original tag, just wrap it
        const wrapped =
          '<picture>' +
            '<source type="image/webp" srcset="' + webpUrl(src) + '" />' +
            full +
          '</picture>';
        imgsWrapped++;
        changed = true;
        return wrapped;
      }
    );
  }

  if (changed) {
    fs.writeFileSync(file, segments.join(''));
    touched++;
  }
});

console.log('WebP wrapping — files touched: ' + touched + ', img tags wrapped: ' + imgsWrapped);
