/* Read every <img src="...">, look up the file's actual width/height
   via sharp, and add explicit width/height attributes so the browser
   reserves space (no layout shift, Lighthouse "unsized-images" passes). */
const fs = require('fs');
const path = require('path');
const sharp = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'sharp-cli', 'node_modules', 'sharp'));

const SITE = path.resolve(__dirname, '..', 'site');

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full, out);
    else if (d.isFile() && d.name.endsWith('.html')) out.push(full);
  });
}

const dimsCache = new Map();
async function dimsFor(htmlFile, src) {
  if (/^(https?:|data:|tel:|mailto:)/.test(src)) return null;
  // Resolve relative to the HTML file's directory
  const resolvedDir = path.dirname(htmlFile);
  let imagePath;
  if (src.startsWith('/')) {
    imagePath = path.join(SITE, src.slice(1));
  } else {
    imagePath = path.resolve(resolvedDir, src);
  }
  if (dimsCache.has(imagePath)) return dimsCache.get(imagePath);
  if (!fs.existsSync(imagePath)) {
    dimsCache.set(imagePath, null);
    return null;
  }
  try {
    const meta = await sharp(imagePath).metadata();
    const dims = { w: meta.width, h: meta.height };
    dimsCache.set(imagePath, dims);
    return dims;
  } catch (e) {
    dimsCache.set(imagePath, null);
    return null;
  }
}

(async () => {
  const files = [];
  walk(SITE, files);
  let touched = 0;
  let imgsUpdated = 0;

  for (const file of files) {
    let html = fs.readFileSync(file, 'utf8');
    let modified = false;

    // Match <img src="..." …> tags missing both width and height
    const re = /<img(\s[^>]*?)?\s+src="([^"]+)"((?:\s[^>]*?)?)\s*\/?>/g;
    const tasks = [];
    let m;
    while ((m = re.exec(html)) !== null) {
      const fullTag = m[0];
      if (/\swidth=/.test(fullTag) && /\sheight=/.test(fullTag)) continue;
      tasks.push({ index: m.index, length: fullTag.length, fullTag, src: m[2] });
    }

    // Resolve dimensions for each
    const replacements = [];
    for (const t of tasks) {
      const dims = await dimsFor(file, t.src);
      if (!dims) continue;
      // Inject width/height just before the closing > or />
      let newTag;
      if (t.fullTag.endsWith('/>')) {
        newTag = t.fullTag.slice(0, -2).trimEnd() + ' width="' + dims.w + '" height="' + dims.h + '" />';
      } else {
        newTag = t.fullTag.slice(0, -1).trimEnd() + ' width="' + dims.w + '" height="' + dims.h + '">';
      }
      replacements.push({ ...t, newTag });
    }

    // Apply replacements in reverse order so indices remain valid
    if (replacements.length) {
      replacements.sort((a, b) => b.index - a.index);
      for (const r of replacements) {
        html = html.slice(0, r.index) + r.newTag + html.slice(r.index + r.length);
        imgsUpdated++;
      }
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(file, html);
      touched++;
    }
  }

  console.log('Image dimensions — files touched: ' + touched + ', img tags updated: ' + imgsUpdated);
})();
