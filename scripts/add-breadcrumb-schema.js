/* Add BreadcrumbList JSON-LD to area pages and the new sub-pages.
   Idempotent — re-running the script with the same data is a no-op. */
const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://bigbenstowingandrecovery.co.uk';
const ROOT = path.resolve(__dirname, '..', 'site');
const areas = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'areas.json'), 'utf8'));

function buildCrumb(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url
    }))
  };
}

function tag(json) {
  return '<script type="application/ld+json" data-bb-crumb="1">\n' + JSON.stringify(json, null, 2) + '\n</script>';
}

// Idempotent: drop any previous breadcrumb tag we wrote, then insert the new one.
function injectCrumb(html, crumb) {
  html = html.replace(/<script type="application\/ld\+json" data-bb-crumb="1">[\s\S]*?<\/script>\n?/g, '');
  if (html.includes('</head>')) {
    return html.replace('</head>', tag(crumb) + '\n</head>');
  }
  return html;
}

let updated = 0;

// 1) Area pages — Home › Areas › <Town>
areas.areas.forEach(area => {
  const file = path.join(ROOT, 'areas', area.slug + '.html');
  if (!fs.existsSync(file)) return;
  const crumb = buildCrumb([
    { name: 'Home',  url: ORIGIN + '/' },
    { name: 'Areas', url: ORIGIN + '/areas.html' },
    { name: area.name, url: ORIGIN + '/areas/' + area.slug + '.html' }
  ]);
  const html = injectCrumb(fs.readFileSync(file, 'utf8'), crumb);
  fs.writeFileSync(file, html);
  updated++;
});

// 2) Sub-pages — Home › <Section> › <Page>
const SUB_PAGES = [
  { file: 'about.html',                section: { name: 'Company', url: ORIGIN + '/about.html' },         page: 'About' },
  { file: 'trade.html',                section: { name: 'Trade', url: ORIGIN + '/trade.html' },           page: 'Trade Recovery' },
  { file: 'auction-collection.html',   section: { name: 'Trade', url: ORIGIN + '/trade.html' },           page: 'Auction Collection' },
  { file: 'motorbike-recovery.html',   section: { name: 'Services', url: ORIGIN + '/services.html' },     page: 'Motorbike Recovery' },
  { file: 'classic-car-transport.html',section: { name: 'Services', url: ORIGIN + '/services.html' },     page: 'Classic Car Transport' },
  { file: 'ev-recovery.html',          section: { name: 'Services', url: ORIGIN + '/services.html' },     page: 'EV Recovery' },
  { file: 'motorway-breakdown.html',   section: { name: 'Help',     url: ORIGIN + '/faq.html' },          page: 'Motorway Breakdown' },
  { file: 'faq.html',                  section: { name: 'Help',     url: ORIGIN + '/faq.html' },          page: 'FAQ' }
];

SUB_PAGES.forEach(sp => {
  const file = path.join(ROOT, sp.file);
  if (!fs.existsSync(file)) return;
  const crumb = buildCrumb([
    { name: 'Home', url: ORIGIN + '/' },
    sp.section,
    { name: sp.page, url: ORIGIN + '/' + sp.file }
  ]);
  const html = injectCrumb(fs.readFileSync(file, 'utf8'), crumb);
  fs.writeFileSync(file, html);
  updated++;
});

console.log('BreadcrumbList schema added to ' + updated + ' pages.');
