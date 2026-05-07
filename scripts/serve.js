#!/usr/bin/env node
/* Tiny static file server for local dev — no external deps.
   Also serves a mock /api/reg-lookup endpoint that mirrors what
   the production Cloudflare Pages Function will return.            */
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', 'site');
const PORT = process.env.PORT || 4180;

// Fixture regs for local dev (no DVLA key needed)
const FIXTURES = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'data', 'fixture-regs.json'), 'utf8')
).regs;

// === Reg lookup ===========================================
// In production set DVLA_VES_KEY (from https://developer-portal.driver-vehicle-licensing.api.gov.uk/)
// and optionally DVSA_MOT_KEY (from https://documentation.history.mot.api.gov.uk/) for richer model data.
function lookupReg(reg, cb) {
  const norm = reg.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // 1) Fixture data wins for local dev demos
  if (FIXTURES[norm]) {
    const f = FIXTURES[norm];
    return cb(null, { make: f.make, model: f.model, year: f.year, fuel: f.fuel, colour: f.colour, source: 'fixture' });
  }
  // 2) Real DVLA VES — only if API key is set
  const key = process.env.DVLA_VES_KEY;
  if (!key) {
    return cb(new Error('Reg not in local fixtures and no DVLA_VES_KEY set'));
  }
  const body = JSON.stringify({ registrationNumber: norm });
  const req = https.request({
    method: 'POST',
    hostname: 'driver-vehicle-licensing.api.gov.uk',
    path: '/vehicle-enquiry/v1/vehicles',
    headers: {
      'x-api-key': key,
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body)
    }
  }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try {
        const j = JSON.parse(data);
        if (j.errors) return cb(new Error(j.errors[0].title));
        cb(null, {
          make:   j.make,
          model:  j.model || '',                 // VES rarely returns model
          year:   parseInt(j.yearOfManufacture, 10) || null,
          fuel:   j.fuelType,
          colour: j.colour,
          source: 'dvla-ves'
        });
      } catch (e) { cb(e); }
    });
  });
  req.on('error', cb);
  req.write(body);
  req.end();
}

const TYPES_API = { '.json': 'application/json; charset=utf-8' };
// =========================================================

const TYPES = {
  '.html':'text/html; charset=utf-8',
  '.css' :'text/css; charset=utf-8',
  '.js'  :'application/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg' :'image/svg+xml',
  '.png' :'image/png',
  '.jpg' :'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.ico' :'image/x-icon',
  '.txt' :'text/plain; charset=utf-8',
  '.xml' :'application/xml; charset=utf-8'
};

http.createServer((req, res) => {
  // ---- API: /api/reg-lookup?reg=XXX ----
  if (req.url.startsWith('/api/reg-lookup')) {
    const u   = new URL(req.url, 'http://x');
    const reg = u.searchParams.get('reg') || '';
    return lookupReg(reg, (err, data) => {
      res.setHeader('content-type', 'application/json; charset=utf-8');
      if (err) {
        res.writeHead(404);
        return res.end(JSON.stringify({ error: err.message }));
      }
      res.writeHead(200);
      res.end(JSON.stringify(data));
    });
  }

  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url.endsWith('/')) url += 'index.html';

  // Serve everything from site/ (data/ is now in site/data/ for clean deploy)
  const candidate = path.join(ROOT, url);
  const resolved  = path.resolve(candidate);
  if (!resolved.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.stat(resolved, (err, stat) => {
    if (err || !stat.isFile()) {
      // Try .html appended (extension-less URLs)
      fs.stat(resolved + '.html', (e2, s2) => {
        if (!e2 && s2.isFile()) return send(resolved + '.html');
        // Serve the bespoke 404 page (Cloudflare Pages auto-picks this up too)
        const notFoundPath = path.join(ROOT, '404.html');
        fs.stat(notFoundPath, (e3, s3) => {
          if (!e3 && s3.isFile()) {
            res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
            return fs.createReadStream(notFoundPath).pipe(res);
          }
          res.writeHead(404, { 'content-type': 'text/html' });
          return res.end('<h1>404</h1><p><a href="/">Home</a></p>');
        });
      });
      return;
    }
    send(resolved);
  });

  function send(p) {
    const ext = path.extname(p).toLowerCase();
    res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  }
}).listen(PORT, () => {
  console.log(`\n  Big Ben's Towing — local preview\n  http://localhost:${PORT}/\n`);
});
