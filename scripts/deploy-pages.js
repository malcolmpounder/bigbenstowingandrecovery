/* =========================================================
   Cloudflare Pages direct-upload deployer.
   Wrangler is broken on win32-arm64 (workerd has no native binary),
   so we hit the Pages REST API directly.
   Required env:
     CF_API_TOKEN     - API token (Edit Cloudflare Workers template)
     CF_ACCOUNT_ID    - Cloudflare account ID
     CF_PROJECT_NAME  - Pages project name (default: bigbenstowingandrecovery)
     CF_BRANCH        - branch tag (default: main)
   Usage:
     node scripts/deploy-pages.js [path-to-site]
   ========================================================= */
const fs = require('fs');
const path = require('path');
const { blake3 } = require('@noble/hashes/blake3.js');

const API_TOKEN = process.env.CF_API_TOKEN;
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const PROJECT = process.env.CF_PROJECT_NAME || 'bigbenstowingandrecovery';
const BRANCH = process.env.CF_BRANCH || 'main';
const SITE_DIR = path.resolve(process.argv[2] || 'site');

if (!API_TOKEN || !ACCOUNT_ID) {
  console.error('Missing CF_API_TOKEN or CF_ACCOUNT_ID');
  process.exit(1);
}

const API = 'https://api.cloudflare.com/client/v4';
const authHeaders = { 'Authorization': 'Bearer ' + API_TOKEN };

// Files that are configuration, NOT static assets. Excluded from the manifest
// (they'd otherwise be served as raw files at /_redirects etc.) and uploaded
// separately as multipart fields in createDeployment().
const CONFIG_FILES = new Set(['_redirects', '_headers', '_routes.json', '_worker.js']);

// ------- File walking --------------------------------------------------------
function walk(dir, base) {
  base = base || dir;
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // skip hidden dirs and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      out.push(...walk(full, base));
    } else if (entry.isFile()) {
      // Skip Pages config files at the project root — they're handled separately
      if (dir === base && CONFIG_FILES.has(entry.name)) continue;
      const rel = '/' + path.relative(base, full).replace(/\\/g, '/');
      out.push({ rel, full });
    }
  }
  return out;
}

// ------- Cloudflare's hash format (from wrangler source) --------------------
// hash = blake3(content + extension)  => first 32 hex chars
function hashFile(buffer, ext) {
  const extBytes = Buffer.from(ext || '', 'utf8');
  const combined = Buffer.concat([buffer, extBytes]);
  const digest = blake3(combined);
  return Buffer.from(digest).toString('hex').slice(0, 32);
}

// ------- Pages API helpers ---------------------------------------------------
async function getUploadJwt() {
  const r = await fetch(`${API}/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/upload-token`, {
    headers: authHeaders
  });
  const j = await r.json();
  if (!j.success) throw new Error('upload-token failed: ' + JSON.stringify(j.errors));
  return j.result.jwt;
}

async function checkMissing(jwt, hashes) {
  // body: { hashes: ["abcd...", ...] }  → returns the missing subset
  const r = await fetch(`${API}/pages/assets/check-missing`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes })
  });
  const j = await r.json();
  if (!j.success) throw new Error('check-missing failed: ' + JSON.stringify(j.errors));
  return j.result;
}

async function uploadBatch(jwt, payloads) {
  // payloads: [{ key, value: base64, metadata: { contentType } }]
  const r = await fetch(`${API}/pages/assets/upload`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify(payloads)
  });
  const j = await r.json();
  if (!j.success) {
    throw new Error('upload failed: ' + JSON.stringify(j.errors));
  }
  return j;
}

async function createDeployment(manifest) {
  // multipart with manifest + branch + Pages config files (_redirects, _headers)
  const fd = new FormData();
  fd.append('manifest', JSON.stringify(manifest));
  fd.append('branch', BRANCH);

  // Cloudflare Pages treats these as configuration, NOT static assets.
  // They must be uploaded as multipart fields so the platform processes them
  // (otherwise they're served as octet-stream files at /_redirects etc.)
  const configFiles = ['_redirects', '_headers', '_routes.json'];
  for (const name of configFiles) {
    const p = path.join(SITE_DIR, name);
    if (fs.existsSync(p)) {
      fd.append(name, new Blob([fs.readFileSync(p)]), name);
    }
  }

  // _worker.js (single-file Worker) — overrides functions/ if present
  const workerJs = path.join(SITE_DIR, '_worker.js');
  if (fs.existsSync(workerJs)) {
    fd.append('_worker.js', new Blob([fs.readFileSync(workerJs)]), '_worker.js');
  }

  const r = await fetch(`${API}/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/deployments`, {
    method: 'POST',
    headers: authHeaders,
    body: fd
  });
  const j = await r.json();
  if (!j.success) throw new Error('deployment failed: ' + JSON.stringify(j.errors));
  return j.result;
}

// ------- Main ----------------------------------------------------------------
function contentTypeFor(rel) {
  const ext = path.extname(rel).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico':  'image/x-icon',
    '.gif':  'image/gif',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
    '.txt':  'text/plain; charset=utf-8',
    '.xml':  'application/xml',
    '.webmanifest': 'application/manifest+json',
    '.pdf':  'application/pdf',
    '.map':  'application/json'
  })[ext] || 'application/octet-stream';
}

(async () => {
  console.log('▸ Site dir:', SITE_DIR);
  const files = walk(SITE_DIR);
  console.log('▸ Files to consider:', files.length);

  // Build manifest: rel-path -> hash, plus a hash -> file map for upload
  const manifest = {};                  // { "/index.html": hash, ... }
  const byHash = new Map();             // hash -> { full, rel, ext }
  for (const f of files) {
    const buf = fs.readFileSync(f.full);
    const ext = path.extname(f.rel);
    const h = hashFile(buf, ext);
    manifest[f.rel] = h;
    if (!byHash.has(h)) byHash.set(h, { ...f, ext, buf });
  }
  console.log('▸ Unique hashes:', byHash.size);

  console.log('▸ Getting upload token…');
  const jwt = await getUploadJwt();

  console.log('▸ Checking which assets Cloudflare already has…');
  const missing = await checkMissing(jwt, [...byHash.keys()]);
  console.log('▸ Need to upload:', missing.length, '/', byHash.size);

  if (missing.length) {
    // Upload in batches of 100
    const BATCH = 50;
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH).map(h => {
        const f = byHash.get(h);
        return {
          key: h,
          value: f.buf.toString('base64'),
          metadata: { contentType: contentTypeFor(f.rel) },
          base64: true
        };
      });
      process.stdout.write(`  uploading ${i + 1}–${Math.min(i + BATCH, missing.length)} of ${missing.length}… `);
      await uploadBatch(jwt, batch);
      console.log('ok');
    }
  }

  console.log('▸ Creating deployment…');
  const dep = await createDeployment(manifest);
  console.log('\n✓ Deployed.');
  console.log('  ID:    ', dep.id);
  console.log('  URL:   ', dep.url || ('https://' + dep.id.slice(0, 8) + '.' + PROJECT + '.pages.dev'));
  console.log('  Live:  ', 'https://' + PROJECT + '.pages.dev');
})().catch(e => {
  console.error('\nDEPLOY FAILED:', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
