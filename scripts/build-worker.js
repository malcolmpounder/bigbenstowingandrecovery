/* =========================================================
   Bundle functions/api/*.js into site/_worker.js so Cloudflare
   Pages picks them up via Direct Upload. (Wrangler is broken on
   win32-arm64, so we can't use the auto-build path.)

   Each functions/api/<name>.js exports onRequestGet / onRequestPost /
   onRequestOptions. We wrap each module in its own IIFE block so
   helpers (json, normaliseReg, …) don't collide between files, and
   route on URL pathname inside a single _worker.js fetch handler.
   Static assets fall through via env.ASSETS.fetch(request).
   ========================================================= */
const fs = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const FUNCS_DIR = path.join(ROOT, 'functions', 'api');
const SITE_DIR  = path.join(ROOT, 'site');
const OUT_FILE  = path.join(SITE_DIR, '_worker.js');

if (!fs.existsSync(FUNCS_DIR)) {
  console.log('No functions/ directory — skipping _worker.js build.');
  process.exit(0);
}

const handlerFiles = fs.readdirSync(FUNCS_DIR)
  .filter(f => f.endsWith('.js'))
  .map(f => ({ name: f.replace(/\.js$/, ''), file: path.join(FUNCS_DIR, f) }));

if (handlerFiles.length === 0) {
  console.log('No handlers found.');
  process.exit(0);
}

// For each module, capture which onRequestX handlers it exports, drop the
// `export` keywords, and wrap the body in an IIFE so helpers stay private.
// The IIFE returns a {get, post, options, …} object that we register in
// the routes table.
const modules = handlerFiles.map(({ name, file }) => {
  let src = fs.readFileSync(file, 'utf8');

  const captured = []; // [{verb, fnName}]
  src = src.replace(
    /export\s+(async\s+)?function\s+onRequest(Get|Post|Options|Put|Patch|Delete)\b/g,
    (_, asyncWord, verb) => {
      captured.push(verb.toLowerCase());
      return (asyncWord || '') + 'function onRequest' + verb;
    }
  );
  src = src.replace(/^\s*export\s+(?=(const|let|var|function|class)\s)/gm, '');

  // The IIFE return statement maps verb → its onRequest function.
  const returnObj = '{ ' + captured.map(v => v + ': onRequest' + v[0].toUpperCase() + v.slice(1)).join(', ') + ' }';

  return { name, captured, src, returnObj };
});

const routeMapEntries = modules.map(m =>
  `  '/api/${m.name}': route_${m.name.replace(/[^a-zA-Z0-9_]/g, '_')}`
).join(',\n');

const moduleBlocks = modules.map(m => `
// -------- /api/${m.name} (verbs: ${m.captured.join(', ') || 'none'}) --------
const route_${m.name.replace(/[^a-zA-Z0-9_]/g, '_')} = (() => {
${m.src}
return ${m.returnObj};
})();`).join('\n');

const out = `/* =========================================================
   AUTO-GENERATED. Do not edit by hand.
   Run: node scripts/build-worker.js
   Source: functions/api/*.js
   ========================================================= */
${moduleBlocks}

const ROUTES = {
${routeMapEntries}
};

const VERB_BY_METHOD = {
  GET: 'get', POST: 'post', PUT: 'put', PATCH: 'patch',
  DELETE: 'delete', OPTIONS: 'options', HEAD: 'get'
};

function notAllowed(allow) {
  return new Response('Method not allowed', {
    status: 405,
    headers: { 'allow': allow.join(', ').toUpperCase() }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = ROUTES[url.pathname];
    if (route) {
      const verb = VERB_BY_METHOD[request.method];
      const fn = route[verb];
      if (fn) {
        try {
          return await fn({ request, env, ctx });
        } catch (e) {
          return new Response(JSON.stringify({ error: String(e && e.message || e) }), {
            status: 500,
            headers: { 'content-type': 'application/json' }
          });
        }
      } else {
        return notAllowed(Object.keys(route));
      }
    }
    // Not an API path — fall through to the static assets binding.
    return env.ASSETS.fetch(request);
  }
};
`;

fs.writeFileSync(OUT_FILE, out);
console.log('Built ' + path.relative(ROOT, OUT_FILE) + ' — ' +
  modules.length + ' handler(s): ' +
  modules.map(m => '/api/' + m.name + ' [' + m.captured.join(',') + ']').join(', '));
