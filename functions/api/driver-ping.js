/* =========================================================
   Cloudflare Pages Function — POST /api/driver-ping
   Ben's phone POSTs here every ~30s while a job is "out for
   recovery". Stores his last known location keyed by booking
   ref so the customer's /track/<ref> page can show "Big Ben
   is X minutes away".

   Storage: Cloudflare Workers KV binding called TRACKING.
   Without that binding we fall back to gracefully reporting
   "tracking not configured" — the customer page handles it.

   Auth: Ben hits this from /driver-track.html which posts a
   shared DRIVER_TOKEN — same constant-time check pattern as
   the admin endpoint.

   Body: { ref, lat, lng, accuracy, status? }
     status: 'enroute' (default) | 'arrived' | 'completed'

   Coords are stored with a 4-hour TTL so a forgotten "active"
   tracker auto-expires.
   ========================================================= */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
function eq(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0;
}
const TTL_SECONDS = 4 * 60 * 60;

export async function onRequestPost({ request, env }) {
  if (!env.DRIVER_TOKEN)  return json({ error: 'driver_not_configured' }, 503);
  if (!env.TRACKING)      return json({ error: 'kv_not_configured' }, 503);

  const auth = request.headers.get('authorization') || '';
  const provided = auth.replace(/^Bearer\s+/i, '');
  if (!eq(provided, env.DRIVER_TOKEN)) return json({ error: 'unauthorized' }, 401);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'invalid_json' }, 400); }

  const ref = String(body.ref || '').trim();
  if (!/^[A-Za-z0-9_\-]{4,64}$/.test(ref)) return json({ error: 'bad_ref' }, 400);

  const lat = parseFloat(body.lat), lng = parseFloat(body.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return json({ error: 'invalid_coords' }, 400);

  const record = {
    lat: lat, lng: lng,
    accuracy: parseFloat(body.accuracy) || null,
    status: ['enroute', 'arrived', 'completed'].includes(body.status) ? body.status : 'enroute',
    updated: Date.now()
  };
  await env.TRACKING.put('track:' + ref, JSON.stringify(record), { expirationTtl: TTL_SECONDS });
  return json({ ok: true });
}
