/* Regenerate sitemap.xml with lastmod (file mtime), priority and changefreq.
   Re-run any time after content edits. */
const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://bigbenstowingandrecovery.co.uk';
const ROOT = path.resolve(__dirname, '..', 'site');

// Per-path priority + changefreq. Higher = more important. Anything not
// listed gets a sensible default (areas pages = 0.6, the rest = 0.5).
const RANK = {
  'index.html':              { priority: '1.0', changefreq: 'weekly'  },
  'services.html':           { priority: '0.9', changefreq: 'monthly' },
  'quote.html':              { priority: '0.9', changefreq: 'monthly' },
  'scrap.html':              { priority: '0.9', changefreq: 'monthly' },
  'contact.html':            { priority: '0.8', changefreq: 'monthly' },
  'areas.html':              { priority: '0.8', changefreq: 'monthly' },
  'faq.html':                { priority: '0.7', changefreq: 'monthly' },
  'about.html':              { priority: '0.7', changefreq: 'monthly' },
  'motorway-breakdown.html': { priority: '0.8', changefreq: 'yearly'  },
  'trade.html':              { priority: '0.8', changefreq: 'monthly' },
  'auction-collection.html': { priority: '0.7', changefreq: 'monthly' },
  'motorbike-recovery.html': { priority: '0.7', changefreq: 'monthly' },
  'classic-car-transport.html': { priority: '0.7', changefreq: 'monthly' },
  'ev-recovery.html':        { priority: '0.7', changefreq: 'monthly' },
  'terms.html':              { priority: '0.3', changefreq: 'yearly'  },
  'privacy.html':            { priority: '0.3', changefreq: 'yearly'  }
};

function fmtDate(d) {
  return d.toISOString().split('T')[0]; // YYYY-MM-DD (W3C date)
}

function entryFor(rel) {
  const file = path.join(ROOT, rel);
  const stat = fs.statSync(file);
  const lastmod = fmtDate(stat.mtime);
  const meta = RANK[rel] || (rel.startsWith('areas/')
    ? { priority: '0.6', changefreq: 'monthly' }
    : { priority: '0.5', changefreq: 'monthly' });
  const url = rel === 'index.html' ? ORIGIN + '/' : ORIGIN + '/' + rel;
  return (
    '  <url>\n' +
    '    <loc>' + url + '</loc>\n' +
    '    <lastmod>' + lastmod + '</lastmod>\n' +
    '    <changefreq>' + meta.changefreq + '</changefreq>\n' +
    '    <priority>' + meta.priority + '</priority>\n' +
    '  </url>'
  );
}

// Excluded: 404, offline, anything noindexed, the manifest
const EXCLUDE = new Set(['404.html', 'offline.html']);

function walk(dir, base, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    if (d.isDirectory()) {
      walk(path.join(dir, d.name), base, out);
    } else if (d.isFile() && d.name.endsWith('.html')) {
      const rel = path.relative(base, path.join(dir, d.name)).replace(/\\/g, '/');
      if (!EXCLUDE.has(rel)) out.push(rel);
    }
  });
}

const all = [];
walk(ROOT, ROOT, all);

// Order: homepage first, then top-level pages alphabetically, then areas alphabetically
all.sort((a, b) => {
  if (a === 'index.html') return -1;
  if (b === 'index.html') return 1;
  const aIsArea = a.startsWith('areas/');
  const bIsArea = b.startsWith('areas/');
  if (aIsArea !== bIsArea) return aIsArea ? 1 : -1;
  return a.localeCompare(b);
});

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  all.map(entryFor).join('\n') + '\n' +
  '</urlset>\n';

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
console.log('Sitemap rebuilt — ' + all.length + ' URLs · highest priority: ' + ORIGIN + '/');
