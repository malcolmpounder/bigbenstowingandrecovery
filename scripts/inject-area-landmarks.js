// Inject a "Local routes & landmarks" block into each area page, just
// before the "Nearby Areas" section. Idempotent — wraps the block in a
// marker comment so re-runs replace cleanly.
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..', 'site');
const AREAS_DIR = path.join(SITE, 'areas');
const areas = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'areas.json'), 'utf8'));
const landmarks = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'area-landmarks.json'), 'utf8')).areas;

const MARKER_START = '<!-- bb:landmarks:start -->';
const MARKER_END   = '<!-- bb:landmarks:end -->';

function block(area, l) {
  return (
    MARKER_START + '\n' +
    '<section>\n' +
    '  <div class="container" style="max-width: 720px;">\n' +
    '    <div class="section-head" style="text-align: left;">\n' +
    '      <h2>Local <span class="accent">routes &amp; landmarks</span></h2>\n' +
    '      <p style="margin: 0;">A bit of local detail for ' + area.name + ' — handy if you\'re giving us your location over the phone.</p>\n' +
    '    </div>\n' +
    '    <div class="form-card" style="display: grid; gap: 14px; grid-template-columns: 1fr 1fr;">\n' +
    '      <div>\n' +
    '        <h3 style="color: var(--yellow); font-size: 1rem;">Main routes near ' + area.name + '</h3>\n' +
    '        <p style="margin: 0; color: #d8d8d8;">' + l.roads + '</p>\n' +
    '      </div>\n' +
    '      <div>\n' +
    '        <h3 style="color: var(--yellow); font-size: 1rem;">Landmarks</h3>\n' +
    '        <p style="margin: 0; color: #d8d8d8;">' + l.landmarks + '</p>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</section>\n' +
    MARKER_END
  );
}

let touched = 0;
let missing = 0;

areas.areas.forEach(area => {
  const file = path.join(AREAS_DIR, area.slug + '.html');
  if (!fs.existsSync(file)) return;
  const data = landmarks[area.slug];
  if (!data) {
    console.log('  no landmarks data for ' + area.slug);
    missing++;
    return;
  }

  let html = fs.readFileSync(file, 'utf8');
  const newBlock = block(area, data);

  // Strip any prior injection
  html = html.replace(new RegExp(MARKER_START + '[\\s\\S]*?' + MARKER_END + '\\s*', 'g'), '');

  // Insert before the "Nearby Areas" section (matched by its h2 text)
  const insertRe = /(<section>\s*<div class="container">\s*<div class="section-head">\s*<h2>Nearby)/;
  if (insertRe.test(html)) {
    html = html.replace(insertRe, newBlock + '\n\n$1');
    fs.writeFileSync(file, html);
    touched++;
  }
});

console.log('Local landmarks — area pages updated: ' + touched + ' · missing data: ' + missing);
