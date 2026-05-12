/* One-off: bump big 4x4 entries in weights.json from `suv` (1.85t)
   to the new `heavy-suv` class (2.40t). Triggered because a real-world
   test against DC15 BCX (Land Rover Discovery 4, ~2.4t kerb) showed
   the calculator was 0.55t light, producing a £30+ low offer. */
const fs = require('fs');
const path = 'site/data/weights.json';
let s = fs.readFileSync(path, 'utf8');

const heavy = [
  'LAND ROVER DEFENDER',
  'LAND ROVER DISCOVERY',
  'LAND ROVER RANGE ROVER',
  'RANGE ROVER',
  'BMW X5', 'BMW X6', 'BMW X7',
  'AUDI Q7', 'AUDI Q8',
  'PORSCHE CAYENNE',
  'MERCEDES-BENZ GLE', 'MERCEDES-BENZ GLS', 'MERCEDES-BENZ G',
  'MERCEDES GLS', 'MERCEDES ML',
  'VOLKSWAGEN TOUAREG',
  'TOYOTA LAND CRUISER'
];

let bumped = 0;
for (const m of heavy) {
  const esc = m.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp('("match":\\s*"' + esc + '"\\s*,\\s*"class":\\s*)"(suv|large|medium)"');
  const out = s.replace(re, '$1"heavy-suv"');
  if (out !== s) { s = out; bumped++; console.log('bumped:', m); }
  else console.log('NOT FOUND:', m);
}
fs.writeFileSync(path, s);
console.log('total bumped:', bumped);
