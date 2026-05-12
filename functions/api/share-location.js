/* =========================================================
   Cloudflare Pages Function — POST /api/share-location
   Customer is at the roadside and taps "Share my location"
   on the breakdown page. Their browser sends GPS coords +
   optional name/phone. We fire an email to Ben so he can
   start moving before the call even connects.

   Body shape (JSON):
     { lat, lng, accuracy, name?, phone?, note? }

   Env:
     RESEND_API_KEY     — re_… (preferred)
     CONTACT_RECIPIENT  — defaults to info@bigbenstowingandrecovery.co.uk

   Falls back to a 503 with a helpful message if no email
   provider is configured — front-end then prompts a phone call.
   ========================================================= */

const RECIPIENT_DEFAULT = 'info@bigbenstowingandrecovery.co.uk';
const SITE_NAME = "Big Ben's Towing & Recovery";

// In-memory rate limit: a customer pinging more than 4 times in 60s is
// almost certainly fat-fingering. We let it through but stop spamming Ben.
const recent = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 4;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function clamp(s, n) { return String(s == null ? '' : s).slice(0, n); }

function rateLimit(ip) {
  const now = Date.now();
  const list = (recent.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  list.push(now);
  recent.set(ip, list);
  return list.length <= RATE_MAX;
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendEmail(env, payload) {
  if (!env.RESEND_API_KEY) return false;
  const recipient = env.CONTACT_RECIPIENT || RECIPIENT_DEFAULT;
  const mapsUrl = 'https://www.google.com/maps/?q=' + payload.lat + ',' + payload.lng;
  const w3wUrl  = 'https://what3words.com/' + payload.lat + ',' + payload.lng;
  const accuracy = payload.accuracy ? '±' + Math.round(payload.accuracy) + ' m' : '';

  const html = [
    '<!doctype html><html><body style="font-family:system-ui,Arial,sans-serif; max-width:560px;">',
    '<div style="background:#0d0d0d; color:#fff; padding:18px; text-align:center;">',
      '<div style="font-size:.78rem; letter-spacing:.1em; text-transform:uppercase; color:#999;">Roadside ping — ' + escHtml(SITE_NAME) + '</div>',
      '<h2 style="margin:8px 0 0; color:#ff8c42;">📍 Customer needs help</h2>',
    '</div>',
    '<div style="padding:18px;">',
      '<p style="font-size:1.05rem; margin:0 0 12px;">Tap the link below — it opens Google Maps and starts navigation.</p>',
      '<p style="text-align:center; margin:14px 0;"><a href="' + escHtml(mapsUrl) + '" style="display:inline-block; background:#e85b14; color:#fff; text-decoration:none; padding:14px 22px; border-radius:6px; font-size:1.05rem; font-weight:700;">Open in Google Maps →</a></p>',
      '<table cellpadding="6" style="border-collapse:collapse; width:100%; font-size:.95rem;">',
        '<tr><td><b>Coords</b></td><td>' + escHtml(payload.lat) + ', ' + escHtml(payload.lng) + ' ' + escHtml(accuracy) + '</td></tr>',
        (payload.name  ? '<tr><td><b>Name</b></td><td>'  + escHtml(payload.name)  + '</td></tr>' : ''),
        (payload.phone ? '<tr><td><b>Phone</b></td><td><a href="tel:' + escHtml(payload.phone) + '">' + escHtml(payload.phone) + '</a></td></tr>' : ''),
        (payload.note  ? '<tr><td><b>Note</b></td><td>'  + escHtml(payload.note)  + '</td></tr>' : ''),
        '<tr><td><b>what3words</b></td><td><a href="' + escHtml(w3wUrl) + '">view on what3words</a></td></tr>',
      '</table>',
    '</div>',
    '</body></html>'
  ].join('');

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: SITE_NAME + " Roadside <roadside@bigbenstowingandrecovery.co.uk>",
      to: [recipient],
      subject: '📍 Roadside ping — ' + (payload.name || 'unknown') + ' needs recovery',
      html: html
    })
  });
  return r.ok;
}

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!rateLimit(ip)) return json({ error: 'rate_limited' }, 429);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'invalid_json' }, 400); }

  const lat = parseFloat(body.lat);
  const lng = parseFloat(body.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return json({ error: 'invalid_coords' }, 400);
  // UK rough bounding box — customers on the moon don't need our help.
  if (lat < 49 || lat > 61 || lng < -8 || lng > 2) return json({ error: 'out_of_range' }, 400);

  const payload = {
    lat: lat.toFixed(5),
    lng: lng.toFixed(5),
    accuracy: parseFloat(body.accuracy) || null,
    name:  clamp(body.name,  100),
    phone: clamp(body.phone, 30),
    note:  clamp(body.note,  500)
  };

  if (env.RESEND_API_KEY) {
    const ok = await sendEmail(env, payload);
    if (!ok) return json({ error: 'email_failed' }, 502);
    return json({ ok: true });
  }

  // No email provider — tell front-end to prompt a phone call.
  return json({ error: 'email_not_configured' }, 503);
}
