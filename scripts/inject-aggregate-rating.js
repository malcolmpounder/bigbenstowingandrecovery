// Inject AggregateRating into the homepage JSON-LD when ratings.json is enabled.
// Idempotent — re-runnable; removes any previous injection before re-adding.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'site');
const HOMEPAGE = path.join(ROOT, 'index.html');
const RATINGS_PATH = path.join(ROOT, 'data', 'ratings.json');

const ratings = JSON.parse(fs.readFileSync(RATINGS_PATH, 'utf8'));
let html = fs.readFileSync(HOMEPAGE, 'utf8');

const TAG_RE = /<script type="application\/ld\+json" data-bb-rating="1">[\s\S]*?<\/script>\n?/;

// Always strip any prior injection so we re-add cleanly
html = html.replace(TAG_RE, '');

if (ratings.enabled && ratings.ratingValue && ratings.reviewCount > 0) {
  const block = {
    '@context': 'https://schema.org',
    '@type': 'AutomotiveBusiness',
    'name': "Big Ben's Towing & Recovery",
    'aggregateRating': {
      '@type': 'AggregateRating',
      'ratingValue': String(ratings.ratingValue),
      'reviewCount': String(ratings.reviewCount),
      'bestRating': String(ratings.bestRating || 5),
      'worstRating': String(ratings.worstRating || 1)
    }
  };
  const tag = '<script type="application/ld+json" data-bb-rating="1">\n' + JSON.stringify(block, null, 2) + '\n</script>';

  // Insert just before </head>
  if (html.includes('</head>')) {
    html = html.replace('</head>', tag + '\n</head>');
    fs.writeFileSync(HOMEPAGE, html);
    console.log('AggregateRating injected — ' + ratings.ratingValue + '/5 from ' + ratings.reviewCount + ' review(s)');
  }
} else {
  fs.writeFileSync(HOMEPAGE, html);
  console.log('AggregateRating disabled — set ratings.enabled=true in data/ratings.json to inject.');
}
