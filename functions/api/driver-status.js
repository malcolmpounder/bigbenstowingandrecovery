/* =========================================================
   Cloudflare Pages Function — GET /api/driver-status?ref=BB-XXXXXXXX
   Customer's tracking page polls this every 20s. Returns Ben's
   last known location for the booking, plus a freshness flag.

   Public endpoint (no auth) — leaks only that there IS a job
   in progress with that ref, plus Ben's coords. We deliberately
   don't expose anything more than what the customer themselves
   can see.

   Storage: same KV namespace as driver-ping.
   ========================================================= */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export async function onRequestGet({ request, env }) {
  if (!env.TRACKING) return json({ error: 'kv_not_configured' }, 503);

  const url = new URL(request.url);
  const ref = (url.searchParams.get('ref') || '').trim();
  if (!/^[A-Za-z0-9_\-]{4,64}$/.test(ref)) return json({ error: 'bad_ref' }, 400);

  const raw = await env.TRACKING.get('track:' + ref);
  if (!raw) return json({ active: false });
  let rec;
  try { rec = JSON.parse(raw); } catch (_) { return json({ active: false }); }

  // Stale if no ping in the last 5 min — Ben might've stopped, parked etc.
  const ageMs = Date.now() - (rec.updated || 0);
  return json({
    active: true,
    lat: rec.lat,
    lng: rec.lng,
    accuracy: rec.accuracy,
    status: rec.status,
    updated: rec.updated,
    age_seconds: Math.round(ageMs / 1000),
    fresh: ageMs < 5 * 60 * 1000
  });
}
