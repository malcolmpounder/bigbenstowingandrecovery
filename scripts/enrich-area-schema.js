/* Walk all 54 area pages and replace the existing Service JSON-LD with a
   richer one — provider geo, serviceArea geo, openingHoursSpecification.
   Re-runnable: idempotent because we match on the schema script tag's body. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_DIR = path.join(ROOT, 'site');
const AREAS_DIR = path.join(SITE_DIR, 'areas');
const areas = JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'data', 'areas.json'), 'utf8'));
const BASE = areas.base;

function buildSchema(area) {
  const obj = {
    "@context": "https://schema.org",
    "@type": "Service",
    "serviceType": "Vehicle Recovery",
    "provider": {
      "@type": "AutomotiveBusiness",
      "name": "Big Ben's Towing & Recovery",
      "telephone": "+447754984147",
      "url": "https://bigbenstowingandrecovery.co.uk/",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": BASE.name,
        "postalCode": BASE.postcode,
        "addressCountry": "GB"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": BASE.lat,
        "longitude": BASE.lng
      },
      "openingHoursSpecification": {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
        "opens": "00:00",
        "closes": "23:59"
      }
    },
    "areaServed": {
      "@type": "Place",
      "name": area.name + ", " + area.county,
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": area.lat,
        "longitude": area.lng
      }
    }
  };
  return JSON.stringify(obj, null, 2);
}

let updated = 0;
let skipped = 0;
let missing = 0;

areas.areas.forEach(area => {
  const file = path.join(AREAS_DIR, area.slug + '.html');
  if (!fs.existsSync(file)) {
    console.warn('  missing: ' + area.slug + '.html');
    missing++;
    return;
  }
  let html = fs.readFileSync(file, 'utf8');
  const schemaBlock = '<script type="application/ld+json">\n' + buildSchema(area) + '\n</script>';

  // Replace any existing JSON-LD block (greedy until </script>)
  const re = /<script type="application\/ld\+json">[\s\S]*?<\/script>/;
  if (re.test(html)) {
    const next = html.replace(re, schemaBlock);
    if (next === html) {
      skipped++;
    } else {
      fs.writeFileSync(file, next);
      updated++;
    }
  } else {
    // No existing block — inject before </head>
    if (html.indexOf('</head>') !== -1) {
      const next = html.replace('</head>', schemaBlock + '\n</head>');
      fs.writeFileSync(file, next);
      updated++;
    } else {
      console.warn('  no </head> in ' + area.slug);
      missing++;
    }
  }
});

console.log('Area pages enriched: ' + updated + ' · unchanged: ' + skipped + ' · missing: ' + missing);
