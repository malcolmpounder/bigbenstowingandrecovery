/* =========================================================
   Strip .html from internal href/srcset/action attributes so
   pages link to clean URLs (e.g. "quote" not "quote.html").
   This avoids Cloudflare Pages' automatic *.html → clean-URL
   308 redirect on every internal navigation, which was making
   click-throughs feel broken on some browsers.
   Idempotent — re-running is a no-op.
   ========================================================= */
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..', 'site');

// Anchor index.html → "./" (root), other internal X.html → "X"
function clean(html) {
  // href="something.html"  /  href='something.html'
  // Allow optional ./ or ../ prefix and subdirs. NOT touched: http(s):// URLs.
  return html.replace(
    /(\s(?:href|action))="((?:\.{1,2}\/)*[A-Za-z0-9_\-\/]+?)\.html((?:#[^"]*)?)"/g,
    (m, attr, file, hash) => {
      // index.html → root of its directory
      if (/(^|\/)index$/.test(file)) {
        const dir = file.replace(/(^|\/)index$/, '$1');   // drop "index"
        return `${attr}="${dir || './'}${hash}"`;
      }
      return `${attr}="${file}${hash}"`;
    }
  );
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && e.name.endsWith('.html')) out.push(full);
  }
}

const files = [];
walk(SITE, files);

let touched = 0;
let unchanged = 0;
for (const f of files) {
  const before = fs.readFileSync(f, 'utf8');
  const after = clean(before);
  if (after !== before) {
    fs.writeFileSync(f, after);
    touched++;
  } else {
    unchanged++;
  }
}
console.log('Clean internal links — rewrote: ' + touched + ' · unchanged: ' + unchanged);
