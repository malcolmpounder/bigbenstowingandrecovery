/* =========================================================
   Cloudflare Pages Function — /api/contact
   Receives the contact-form POST and forwards it on as email.

   Default delivery: Web3Forms (free, no account needed beyond a one-time
   key from web3forms.com). Override by configuring an alternate provider.
   Set the relevant env var in the Pages dashboard:

     - WEB3FORMS_KEY        (recommended — free, simple)
     - or RESEND_API_KEY    (paid, more control)
     - or MAILGUN_API_KEY   (paid, transactional)

   Body shape (JSON):
     { name, phone, email, message, website?, pickup?, dropoff?, estimate? }
     "website" is the honeypot — if filled, treat as spam.

   Response shape:
     200 { ok: true }
     400 { error }   bad input
     429 { error }   rate-limited
     503 { error }   no provider configured
   ========================================================= */

const RECIPIENT_DEFAULT = 'info@bigbenstowingandrecovery.co.uk';
const SITE_NAME = "Big Ben's Towing & Recovery";

// In-memory rate limit by IP — Pages Functions are short-lived but Cloudflare
// reuses isolates, so this catches obvious flooding within one POP for the
// duration the isolate stays alive. For production use, swap to KV/Durable
// Objects if abuse becomes a problem.
const recentByIp = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': 'same-origin',
      'x-content-type-options': 'nosniff'
    }
  });
}

function clamp(s, n) {
  return String(s == null ? '' : s).slice(0, n);
}

function isValidPhone(s) {
  // UK-tolerant: 7 or more digits, with optional +, -, spaces, parens.
  return /^[0-9 +()\-]{7,}$/.test(String(s || '').trim());
}

function isValidEmail(s) {
  if (!s) return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function rateLimit(ip) {
  const now = Date.now();
  const list = (recentByIp.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  list.push(now);
  recentByIp.set(ip, list);
  return list.length <= RATE_MAX;
}

async function deliverViaWeb3Forms(env, payload) {
  const r = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      access_key: env.WEB3FORMS_KEY,
      subject: '[' + SITE_NAME + '] New enquiry from ' + payload.name,
      from_name: SITE_NAME + ' website',
      replyto: payload.email || RECIPIENT_DEFAULT,
      // Web3Forms turns these into a tidy email body
      Name:    payload.name,
      Phone:   payload.phone,
      Email:   payload.email || '(not provided)',
      Pickup:  payload.pickup || '',
      Dropoff: payload.dropoff || '',
      Estimate: payload.estimate ? '£' + payload.estimate : '',
      Message: payload.message
    })
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error('Web3Forms ' + r.status + ': ' + t.slice(0, 200));
  }
}

async function deliverViaResend(env, payload) {
  const html = renderEmailHTML(payload);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + env.RESEND_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Big Ben\'s Site <noreply@bigbenstowingandrecovery.co.uk>',
      to: [env.CONTACT_RECIPIENT || RECIPIENT_DEFAULT],
      reply_to: payload.email || undefined,
      subject: '[' + SITE_NAME + '] New enquiry from ' + payload.name,
      html
    })
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error('Resend ' + r.status + ': ' + t.slice(0, 200));
  }
}

function renderEmailHTML(p) {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return (
    '<!doctype html><html><body style="font-family:system-ui,Arial,sans-serif">' +
    '<h2 style="color:#0d0d0d">New enquiry — ' + esc(SITE_NAME) + '</h2>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
      '<tr><td><b>Name</b></td><td>' + esc(p.name) + '</td></tr>' +
      '<tr><td><b>Phone</b></td><td>' + esc(p.phone) + '</td></tr>' +
      '<tr><td><b>Email</b></td><td>' + esc(p.email || '(not provided)') + '</td></tr>' +
      (p.pickup   ? '<tr><td><b>Pickup</b></td><td>' + esc(p.pickup) + '</td></tr>'   : '') +
      (p.dropoff  ? '<tr><td><b>Drop-off</b></td><td>' + esc(p.dropoff) + '</td></tr>' : '') +
      (p.estimate ? '<tr><td><b>Quote</b></td><td>£' + esc(p.estimate) + '</td></tr>' : '') +
    '</table>' +
    '<h3 style="margin-top:24px">Message</h3>' +
    '<p style="white-space:pre-wrap">' + esc(p.message) + '</p>' +
    '</body></html>'
  );
}

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')
    || 'unknown';

  if (!rateLimit(ip)) {
    return json({ error: 'Too many submissions — please try again in a minute.' }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON.' }, 400);
  }

  // Honeypot — if a bot filled the hidden field, return success so they
  // don't retry, but don't actually deliver anything.
  if (body.website && String(body.website).trim()) {
    return json({ ok: true, dropped: 'honeypot' });
  }

  const payload = {
    name:     clamp(body.name,     200),
    phone:    clamp(body.phone,     50),
    email:    clamp(body.email,    200),
    message:  clamp(body.message, 4000),
    pickup:   clamp(body.pickup,   200),
    dropoff:  clamp(body.dropoff,  200),
    estimate: clamp(body.estimate,  20)
  };

  if (!payload.name || !payload.phone || !payload.message) {
    return json({ error: 'Name, phone and message are required.' }, 400);
  }
  if (!isValidPhone(payload.phone)) {
    return json({ error: 'Phone number looks wrong.' }, 400);
  }
  if (!isValidEmail(payload.email)) {
    return json({ error: 'Email address looks wrong.' }, 400);
  }

  try {
    if (env.WEB3FORMS_KEY) {
      await deliverViaWeb3Forms(env, payload);
    } else if (env.RESEND_API_KEY) {
      await deliverViaResend(env, payload);
    } else {
      return json({ error: 'Form delivery not configured. Set WEB3FORMS_KEY or RESEND_API_KEY in the Cloudflare Pages dashboard.' }, 503);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: 'Could not deliver the message right now. Please call us on 07754 984 147 instead.', detail: String((e && e.message) || e).slice(0, 300) }, 502);
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}
