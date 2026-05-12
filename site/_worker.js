/* =========================================================
   AUTO-GENERATED. Do not edit by hand.
   Run: node scripts/build-worker.js
   Source: functions/api/*.js
   ========================================================= */

// -------- /api/admin-bookings (verbs: get) --------
const route_admin_bookings = (() => {
/* =========================================================
   Cloudflare Pages Function — GET /api/admin-bookings
   Returns the most recent Stripe Checkout sessions in a
   compact shape for the /admin dashboard. Gated by a single
   ADMIN_PASSWORD env var (basic auth via Authorization header).

   This is a pragmatic admin gate — the dashboard is for one
   user (Ben). For multi-user RBAC we'd swap to Cloudflare Access.

   Env vars:
     ADMIN_PASSWORD       — chosen by Ben; we compare in constant time
     STRIPE_SECRET_KEY    — to query the sessions list
   ========================================================= */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function timingSafeEq(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function onRequestGet({ request, env }) {
  if (!env.ADMIN_PASSWORD) return json({ error: 'admin_not_configured' }, 503);
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'stripe_not_configured' }, 503);

  // Header form: "Authorization: Bearer <password>" (simpler than Basic for
  // a JS fetch from a same-origin admin page).
  const auth = request.headers.get('authorization') || '';
  const provided = auth.replace(/^Bearer\s+/i, '');
  if (!provided || !timingSafeEq(provided, env.ADMIN_PASSWORD)) {
    return json({ error: 'unauthorized' }, 401);
  }

  // Optional ?limit=20 and ?since= for pagination
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '25', 10)));

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions?limit=' + limit, {
    headers: { authorization: 'Bearer ' + env.STRIPE_SECRET_KEY }
  });
  const j = await r.json();
  if (!r.ok) return json({ error: (j.error && j.error.message) || 'stripe_error' }, 502);

  // Strip down to just the fields the dashboard needs.
  const sessions = (j.data || []).map(s => {
    const meta = s.metadata || {};
    return {
      id: s.id,
      ref: 'BB-' + s.id.slice(-8).toUpperCase(),
      created: s.created,
      paid: s.payment_status === 'paid',
      amount: s.amount_total ? s.amount_total / 100 : null,
      kind: meta.kind === 'balance' ? 'balance' : 'deposit',
      pickup: meta.pickup || '',
      dropoff: meta.dropoff || '',
      total_quote: meta.total_quote || meta.original_total || '',
      balance_due: meta.balance_due || '',
      customer_name:  s.customer_details && s.customer_details.name,
      customer_phone: s.customer_details && s.customer_details.phone,
      customer_email: s.customer_details && s.customer_details.email,
      original_session: meta.original_session || ''
    };
  });

  // Aggregate totals — useful for the dashboard header
  const today    = new Date(); today.setHours(0,0,0,0);
  const thisWeek = new Date(); thisWeek.setDate(thisWeek.getDate() - 7);
  let todaySum = 0, weekSum = 0, paidCount = 0;
  for (const s of sessions) {
    if (!s.paid || !s.amount) continue;
    paidCount++;
    const created = new Date(s.created * 1000);
    if (created >= today)    todaySum += s.amount;
    if (created >= thisWeek) weekSum  += s.amount;
  }

  return json({
    sessions,
    summary: {
      paid_count: paidCount,
      today_total: Math.round(todaySum * 100) / 100,
      week_total:  Math.round(weekSum  * 100) / 100
    }
  });
}

return { get: onRequestGet };
})();

// -------- /api/checkout-balance (verbs: post) --------
const route_checkout_balance = (() => {
/* =========================================================
   Cloudflare Pages Function — POST /api/checkout-balance
   Looks up the original booking session and creates a NEW
   Stripe Checkout Session for the balance amount.

   Body: { session_id }    the original deposit checkout session id
   Env:  STRIPE_SECRET_KEY
   ========================================================= */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function stripeForm(obj, prefix = '', out = []) {
  for (const k in obj) {
    if (obj[k] == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      stripeForm(obj[k], key, out);
    } else {
      out.push(`${key}=${encodeURIComponent(String(obj[k]))}`);
    }
  }
  return out.join('&');
}

async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'stripe_not_configured' }, 503);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'invalid_json' }, 400); }

  const sid = body.session_id;
  if (!sid || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sid)) {
    return json({ error: 'bad_session_id' }, 400);
  }

  // 1. Fetch the original session to read its metadata
  const lookup = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sid), {
    headers: { authorization: 'Bearer ' + env.STRIPE_SECRET_KEY }
  });
  const orig = await lookup.json();
  if (!lookup.ok) return json({ error: 'booking_not_found' }, 404);

  const meta = orig.metadata || {};
  const balance = parseInt(meta.balance_due || '0', 10);
  if (balance <= 0) return json({ error: 'no_balance_due' }, 400);

  // Sanity-check it hasn't already been balance-paid by looking at metadata flag
  if (meta.balance_paid === '1') return json({ error: 'already_paid' }, 400);

  const baseUrl = env.STRIPE_PUBLIC_URL || 'https://bigbenstowingandrecovery.co.uk';

  // 2. Create a new Checkout Session for the balance
  const sessionData = {
    mode: 'payment',
    payment_method_types: ['card'],
    'line_items[0]': {
      price_data: {
        currency: 'gbp',
        product_data: {
          name: "Big Ben's Towing & Recovery — booking balance",
          description: 'Balance for booking ' + sid.slice(-8).toUpperCase() +
                       ' · Pickup: ' + (meta.pickup || '?') +
                       ' · Drop-off: ' + (meta.dropoff || '?')
        },
        unit_amount: balance * 100
      },
      quantity: 1
    },
    success_url: baseUrl + '/balance-paid?session_id={CHECKOUT_SESSION_ID}',
    cancel_url:  baseUrl + '/pay-balance?ref=' + encodeURIComponent(sid),
    metadata: {
      kind: 'balance',
      original_session: sid,
      pickup: meta.pickup || '',
      dropoff: meta.dropoff || '',
      original_total: meta.total_quote || ''
    }
  };

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: stripeForm(sessionData)
  });
  const j = await r.json();
  if (!r.ok) return json({ error: (j && j.error && j.error.message) || 'stripe_error' }, 502);

  return json({ url: j.url, sessionId: j.id });
}

return { post: onRequestPost };
})();

// -------- /api/checkout-deposit (verbs: post, options) --------
const route_checkout_deposit = (() => {
/* =========================================================
   Cloudflare Pages Function — POST /api/checkout/deposit
   Creates a Stripe Checkout Session for the £50 booking deposit.

   Env vars (set in Cloudflare Pages → Settings → Environment vars):
     STRIPE_SECRET_KEY    — sk_live_… (or sk_test_… while testing)
     STRIPE_PUBLIC_URL    — optional override for success/cancel URLs;
                           defaults to https://bigbenstowingandrecovery.co.uk

   Until STRIPE_SECRET_KEY is set we return 503 with
   { error: "stripe_not_configured" } so the front-end can show a
   "call us instead" fallback.

   Body shape (JSON):
     {
       pickup, dropoff,        // human-readable location labels
       totalMiles, total,      // total quote in £ (integer)
       deposit,                // £ deposit amount (50)
       balance,                // total - deposit
       vehicleType, when       // metadata stored on the session
     }

   Response:
     200  { url, sessionId }   redirect customer to `url`
     400  { error }            bad input
     503  { error: "stripe_not_configured" }
     502  { error }            upstream Stripe error
   ========================================================= */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function clampInt(n, min, max) {
  n = Math.round(Number(n) || 0);
  return Math.max(min, Math.min(max, n));
}

// Stripe Checkout Sessions API uses application/x-www-form-urlencoded.
// We hand-roll the request rather than pull in the Stripe SDK so the
// Worker bundle stays tiny and dependency-free.
function stripeForm(obj, prefix = '', out = []) {
  for (const k in obj) {
    if (obj[k] == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      stripeForm(obj[k], key, out);
    } else if (Array.isArray(obj[k])) {
      obj[k].forEach((v, i) => {
        if (typeof v === 'object') stripeForm(v, `${key}[${i}]`, out);
        else out.push(`${key}[${i}]=${encodeURIComponent(String(v))}`);
      });
    } else {
      out.push(`${key}=${encodeURIComponent(String(obj[k]))}`);
    }
  }
  return out.join('&');
}

async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'stripe_not_configured' }, 503);
  }

  let body;
  try { body = await request.json(); }
  catch (_) { return json({ error: 'invalid_json' }, 400); }

  const deposit = clampInt(body.deposit, 1, 1000);          // £
  const total   = clampInt(body.total,   deposit, 100000);
  const balance = Math.max(0, total - deposit);

  const baseUrl = env.STRIPE_PUBLIC_URL || 'https://bigbenstowingandrecovery.co.uk';

  // Build the Checkout Session. mode=payment for a one-off charge.
  // metadata travels with the session and shows in the Stripe dashboard
  // and in webhooks — handy for matching up bookings later.
  const sessionData = {
    mode: 'payment',
    payment_method_types: ['card'],
    'line_items[0]': {
      price_data: {
        currency: 'gbp',
        product_data: {
          name: "Big Ben's Towing & Recovery — booking deposit",
          description: 'Pickup: ' + (body.pickup || '?') +
                       ' · Drop-off: ' + (body.dropoff || '?') +
                       ' · Total quote: £' + total +
                       ' · Balance on drop-off: £' + balance
        },
        unit_amount: deposit * 100
      },
      quantity: 1
    },
    success_url: baseUrl + '/booking-confirmed?session_id={CHECKOUT_SESSION_ID}',
    cancel_url:  baseUrl + '/quote?cancelled=1',
    metadata: {
      pickup: String(body.pickup || '').slice(0, 100),
      dropoff: String(body.dropoff || '').slice(0, 100),
      total_quote: String(total),
      deposit: String(deposit),
      balance_due: String(balance),
      total_miles: String(clampInt(body.totalMiles, 0, 5000)),
      vehicle_type: String(body.vehicleType || '').slice(0, 30),
      when: String(body.when || '').slice(0, 30),
      // Photo URL is optional; only present when /api/upload-photo succeeded.
      // Stripe metadata caps each value at 500 chars — our /photo/<id> URLs
      // are ~30 chars, comfortably inside the limit.
      photo_url: String(body.photoUrl || '').slice(0, 200)
    },
    payment_intent_data: {
      description: 'Recovery deposit — ' + (body.pickup || '?') + ' → ' + (body.dropoff || '?')
    },
    // Phone number is genuinely useful for an emergency recovery quote so we
    // ask Stripe to collect it; email is collected by default.
    phone_number_collection: { enabled: true }
  };

  // Stripe expects a flat form-encoded body with bracket notation for nested
  // fields. We wrote stripeForm() above to do that conversion.
  const flat = {};
  Object.assign(flat, sessionData);
  // Re-flatten line_items + price_data + product_data using stripeForm.
  // Easier to just flatten the whole object:
  const formBody = stripeForm(sessionData);

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: formBody
  });
  const j = await r.json();

  if (!r.ok) {
    return json({
      error: (j && j.error && j.error.message) || 'stripe_error',
      detail: j && j.error
    }, 502);
  }

  return json({ url: j.url, sessionId: j.id });
}

function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: { 'access-control-allow-methods': 'POST, OPTIONS' }
  });
}

return { post: onRequestPost, options: onRequestOptions };
})();

// -------- /api/checkout-summary (verbs: get) --------
const route_checkout_summary = (() => {
/* =========================================================
   Cloudflare Pages Function — GET /api/checkout-summary?session_id=…
   Reads a Stripe Checkout Session by ID and returns the booking
   metadata in a tidy shape for the booking-confirmed page to render.

   We never expose the raw Stripe response — only the safe fields the
   customer needs to see (their own pickup/dropoff/totals).

   Env: STRIPE_SECRET_KEY
   ========================================================= */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function onRequestGet({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'stripe_not_configured' }, 503);

  const url = new URL(request.url);
  const sid = url.searchParams.get('session_id');
  if (!sid || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sid)) {
    return json({ error: 'bad_session_id' }, 400);
  }

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sid), {
    headers: { authorization: 'Bearer ' + env.STRIPE_SECRET_KEY }
  });
  const j = await r.json();

  if (!r.ok) {
    return json({ error: (j && j.error && j.error.message) || 'stripe_error' }, r.status);
  }

  // Only return what we need — never echo back the whole Stripe object.
  const meta = (j.metadata || {});
  return json({
    id: j.id,
    paid: j.payment_status === 'paid',
    pickup: meta.pickup || '',
    dropoff: meta.dropoff || '',
    total: meta.total_quote || '',
    deposit: meta.deposit || '',
    balance: meta.balance_due || '',
    when: meta.when || '',
    vehicleType: meta.vehicle_type || ''
  });
}

return { get: onRequestGet };
})();

// -------- /api/contact (verbs: post, options) --------
const route_contact = (() => {
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

async function onRequestPost({ request, env }) {
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

function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}

return { post: onRequestPost, options: onRequestOptions };
})();

// -------- /api/driver-ping (verbs: post) --------
const route_driver_ping = (() => {
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

async function onRequestPost({ request, env }) {
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

return { post: onRequestPost };
})();

// -------- /api/driver-status (verbs: get) --------
const route_driver_status = (() => {
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

async function onRequestGet({ request, env }) {
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

return { get: onRequestGet };
})();

// -------- /api/photo (verbs: get) --------
const route_photo = (() => {
/* =========================================================
   Cloudflare Pages Function — GET /api/photo?key=<id>
   Streams a previously-uploaded photo back from R2.
   The /photo/<id> path is mapped here via _redirects (or
   fronted by a single regex handler — the simpler path is
   to keep this on /api/photo and pass ?key=).

   We also accept the key in the path via /photo/<key> by
   the routing in _worker.js fallthrough — see _redirects.
   ========================================================= */

function notFound() { return new Response('Not found', { status: 404 }); }

async function onRequestGet({ request, env }) {
  if (!env.PHOTOS) return new Response('Photo storage not configured', { status: 503 });
  const url = new URL(request.url);
  const key = (url.searchParams.get('key') || url.pathname.split('/').pop() || '').trim();
  if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/i.test(key)) return notFound();

  const obj = await env.PHOTOS.get(key);
  if (!obj) return notFound();

  const headers = new Headers();
  if (obj.httpMetadata) {
    if (obj.httpMetadata.contentType) headers.set('content-type', obj.httpMetadata.contentType);
    if (obj.httpMetadata.cacheControl) headers.set('cache-control', obj.httpMetadata.cacheControl);
  }
  return new Response(obj.body, { headers });
}

return { get: onRequestGet };
})();

// -------- /api/reg-lookup (verbs: get, options) --------
const route_reg_lookup = (() => {
/* =========================================================
   Cloudflare Pages Function — /api/reg-lookup
   Two-tier vehicle lookup:
     1. DVLA Vehicle Enquiry Service (free, fast, returns
        make/year/fuel/colour but rarely model)
     2. DVSA MOT History API fallback (free with OAuth, fills
        in model when DVLA didn't)

   Env vars (Pages → Settings → Environment vars):
     DVLA_VES_KEY             — DVLA VES API key
     DVSA_MOT_CLIENT_ID       — DVSA app registration client ID
     DVSA_MOT_CLIENT_SECRET   — DVSA app registration client secret
     DVSA_MOT_API_KEY         — DVSA API key (separate from OAuth)
     DVSA_MOT_TOKEN_URL       — Microsoft Entra ID token endpoint

   The DVSA OAuth access_token is cached in module scope until 1 min
   before its expiry. Cloudflare reuses isolates across requests, so
   one token typically covers a few hundred lookups before refresh.

   Response shape (matches site/js/scrap.js expectations):
     200  { make, model, year, fuel, colour, source }
     400  { error }   reg too short
     404  { error }   reg not found
     500  { error }   upstream / parse error
     503  { error }   no DVLA_VES_KEY configured
   ========================================================= */

// ---- DVSA OAuth token cache (module scope = per isolate) ----
let cachedDvsaToken = null;   // { token, expiresAt }

async function getDvsaToken(env) {
  const now = Date.now();
  if (cachedDvsaToken && cachedDvsaToken.expiresAt > now + 60_000) {
    return cachedDvsaToken.token;
  }
  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.DVSA_MOT_CLIENT_ID,
    client_secret: env.DVSA_MOT_CLIENT_SECRET,
    scope: 'https://tapi.dvsa.gov.uk/.default'
  });
  const r = await fetch(env.DVSA_MOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error('DVSA token fetch failed: ' + r.status + ' ' + t.slice(0, 200));
  }
  const j = await r.json();
  cachedDvsaToken = {
    token: j.access_token,
    expiresAt: now + ((j.expires_in || 3600) * 1000)
  };
  return cachedDvsaToken.token;
}

// Fetch model + extra detail from DVSA MOT History API.
// Returns null if not configured / not found / errors — never throws.
async function dvsaLookup(env, reg) {
  if (!env.DVSA_MOT_CLIENT_ID || !env.DVSA_MOT_CLIENT_SECRET ||
      !env.DVSA_MOT_API_KEY || !env.DVSA_MOT_TOKEN_URL) {
    return null;
  }
  try {
    const token = await getDvsaToken(env);
    const r = await fetch(
      'https://history.mot.api.gov.uk/v1/trade/vehicles/registration/' + encodeURIComponent(reg),
      {
        headers: {
          'Authorization': 'Bearer ' + token,
          'x-api-key': env.DVSA_MOT_API_KEY,
          'accept': 'application/json'
        }
      }
    );
    if (!r.ok) return null;          // 404 = unknown, anything else = silently degrade
    const j = await r.json();
    // The API has returned a single object or an array depending on whether
    // there are multiple vehicles for that reg. Normalise to the first hit.
    const v = Array.isArray(j) ? j[0] : j;
    if (!v || (!v.make && !v.model)) return null;
    return {
      make:   (v.make   || '').toUpperCase(),
      model:  (v.model  || '').toUpperCase(),
      fuel:   (v.fuelType || v.fuel_type || '').toUpperCase(),
      colour: (v.primaryColour || v.primary_colour || '').toUpperCase()
    };
  } catch (_) {
    return null;
  }
}

// Embedded fixtures — mirrors data/fixture-regs.json. Useful for demos
// (e.g. a journalist or potential customer trying the test reg) and as a
// safety net if DVLA is briefly unavailable. Kept tiny on purpose.
const FIXTURES = {
  'AB12CDE': { make: 'FORD',       model: 'FIESTA',   year: 2014, fuel: 'PETROL',   colour: 'BLUE'   },
  'BD18FGH': { make: 'VAUXHALL',   model: 'CORSA',    year: 2018, fuel: 'PETROL',   colour: 'WHITE'  },
  'CD15JKL': { make: 'FORD',       model: 'FOCUS',    year: 2015, fuel: 'DIESEL',   colour: 'SILVER' },
  'DE16MNO': { make: 'VOLKSWAGEN', model: 'GOLF',     year: 2016, fuel: 'DIESEL',   colour: 'GREY'   },
  'EF19PQR': { make: 'NISSAN',     model: 'QASHQAI',  year: 2019, fuel: 'PETROL',   colour: 'RED'    },
  'FG13STU': { make: 'FORD',       model: 'TRANSIT',  year: 2013, fuel: 'DIESEL',   colour: 'WHITE'  },
  'GH17VWX': { make: 'BMW',        model: '3 SERIES', year: 2017, fuel: 'DIESEL',   colour: 'BLACK'  },
  'HJ20YZA': { make: 'TESLA',      model: 'MODEL 3',  year: 2020, fuel: 'ELECTRIC', colour: 'WHITE'  },
  'SR16KPX': { make: 'IVECO',      model: 'DAILY',    year: 2016, fuel: 'DIESEL',   colour: 'WHITE'  }
};

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  // Lock down to same-origin — this endpoint isn't for third parties.
  'access-control-allow-origin': 'same-origin',
  'x-content-type-options': 'nosniff'
};

function normaliseReg(s) {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const reg = normaliseReg(url.searchParams.get('reg') || '');

  if (reg.length < 5) {
    return json({ error: "That doesn't look like a UK reg" }, 400);
  }

  // Fixture wins — covers our demo plates even in production
  if (FIXTURES[reg]) {
    return json({ ...FIXTURES[reg], source: 'fixture' });
  }

  const key = env && env.DVLA_VES_KEY;
  if (!key) {
    return json({ error: 'Reg lookup not configured' }, 503);
  }

  try {
    const upstream = await fetch(
      'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles',
      {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'content-type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({ registrationNumber: reg })
      }
    );

    const j = await upstream.json().catch(() => ({}));

    if (!upstream.ok || (j && j.errors)) {
      const msg = (j.errors && j.errors[0] && j.errors[0].title)
        || `Lookup failed (${upstream.status})`;
      return json({ error: msg }, upstream.status === 404 ? 404 : 502);
    }

    const result = {
      make:   j.make || '',
      model:  j.model || '',                 // VES rarely returns model
      year:   parseInt(j.yearOfManufacture, 10) || null,
      fuel:   j.fuelType || '',
      colour: j.colour || '',
      source: 'dvla-ves'
    };

    // If DVLA didn't give us a model, fall back to DVSA MOT history. We only
    // bother when the model is missing because DVSA's a slower path (OAuth
    // + separate fetch) and the make-only is enough for ~half our scrap
    // quotes anyway.
    if (!result.model) {
      const extra = await dvsaLookup(env, reg);
      if (extra) {
        if (extra.model)  result.model  = extra.model;
        if (!result.fuel   && extra.fuel)   result.fuel   = extra.fuel;
        if (!result.colour && extra.colour) result.colour = extra.colour;
        result.source = 'dvla-ves+dvsa-mot';
      }
    }

    return json(result);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}

// Allow CORS preflight to noop cleanly (browsers shouldn't preflight a
// same-origin GET, but some proxies do).
function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}

return { get: onRequestGet, options: onRequestOptions };
})();

// -------- /api/share-location (verbs: post) --------
const route_share_location = (() => {
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

async function onRequestPost({ request, env }) {
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

return { post: onRequestPost };
})();

// -------- /api/stripe-webhook (verbs: post) --------
const route_stripe_webhook = (() => {
/* =========================================================
   Cloudflare Pages Function — POST /api/stripe-webhook
   Stripe → us. Verifies the signature, then on a successful
   `checkout.session.completed` event:
     1) Sends Big Ben an email with the booking details
     2) (TODO) Logs the booking to D1/KV if we add storage later

   Stripe also emails BOTH parties automatically:
     - The customer gets a card receipt from Stripe
     - The Stripe-account holder (Big Ben) gets a "Payment received"
       notification in the Stripe dashboard + on his account email

   This webhook adds a SECOND, richer email to Ben with the actual
   booking details (pickup, drop-off, balance) so he doesn't have to
   click into Stripe to see what was booked.

   Env vars:
     STRIPE_SECRET_KEY        — sk_live_…
     STRIPE_WEBHOOK_SECRET    — whsec_… (from Stripe → Webhooks → Signing secret)
     RESEND_API_KEY           — re_… (free tier from resend.com)
     CONTACT_RECIPIENT        — defaults to info@bigbenstowingandrecovery.co.uk

   How to register the webhook in Stripe:
     Stripe Dashboard → Developers → Webhooks → Add endpoint
     URL: https://bigbenstowingandrecovery.co.uk/api/stripe-webhook
     Events to send:
       - checkout.session.completed
       - payment_intent.succeeded   (optional — gives more detail)
     Copy the "Signing secret" → set as STRIPE_WEBHOOK_SECRET in Pages env
   ========================================================= */

const RECIPIENT_DEFAULT = 'info@bigbenstowingandrecovery.co.uk';
const SITE_NAME = "Big Ben's Towing & Recovery";

// Verify a Stripe webhook signature. Stripe's signing scheme is HMAC-SHA256
// over `${timestamp}.${rawPayload}` with the webhook secret as the key.
async function verifyStripeSig(rawBody, sigHeader, secret, toleranceSec = 300) {
  if (!sigHeader) return false;
  const parts = sigHeader.split(',').reduce((acc, p) => {
    const [k, v] = p.split('=');
    if (k && v) (acc[k] = acc[k] || []).push(v);
    return acc;
  }, {});
  const t = parts.t && parts.t[0];
  const v1 = parts.v1 || [];
  if (!t || v1.length === 0) return false;

  // Check timestamp freshness to block replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(t, 10)) > toleranceSec) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(t + '.' + rawBody));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  // Constant-time compare against any v1 signature
  return v1.some(candidate => timingSafeEq(hex, candidate));
}

function timingSafeEq(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bookingEmailHtml(session, kind) {
  const meta = session.metadata || {};
  const customerName  = (session.customer_details && session.customer_details.name)  || '';
  const customerEmail = (session.customer_details && session.customer_details.email) || '';
  const customerPhone = (session.customer_details && session.customer_details.phone) || '';
  const ref = (session.id || '').slice(-8).toUpperCase();
  const isBalance = kind === 'balance';

  return [
    '<!doctype html><html><body style="font-family:system-ui,Arial,sans-serif; max-width:560px; margin:0 auto;">',
    '<div style="background:#0d0d0d; color:#fff; padding:20px; text-align:center;">',
      '<div style="font-size:.78rem; letter-spacing:.1em; text-transform:uppercase; color:#999;">' + escHtml(SITE_NAME) + '</div>',
      '<h2 style="margin:8px 0 0; color:#ff8c42;">' +
        (isBalance ? 'Balance paid in full' : 'New booking — deposit received') +
      '</h2>',
    '</div>',
    '<div style="padding:24px;">',
      '<p style="font-size:1.1rem; margin:0 0 16px;"><strong>Booking ref: BB-' + escHtml(ref) + '</strong></p>',
      '<table cellpadding="6" style="border-collapse:collapse; width:100%; font-size:.95rem;">',
        '<tr><td><b>Customer</b></td><td>' + escHtml(customerName) + '</td></tr>',
        '<tr><td><b>Phone</b></td><td>' + escHtml(customerPhone || '— (none provided)') + '</td></tr>',
        '<tr><td><b>Email</b></td><td>' + escHtml(customerEmail) + '</td></tr>',
        '<tr><td><b>Pickup</b></td><td>' + escHtml(meta.pickup || '—') + '</td></tr>',
        '<tr><td><b>Drop-off</b></td><td>' + escHtml(meta.dropoff || '—') + '</td></tr>',
        '<tr><td><b>Vehicle</b></td><td>' + escHtml(meta.vehicle_type || '—') + '</td></tr>',
        '<tr><td><b>Timing</b></td><td>' + escHtml(meta.when || 'Standard') + '</td></tr>',
        '<tr style="background:#fff7e0;"><td><b>Total quote</b></td><td>£' + escHtml(meta.total_quote || meta.original_total || '?') + '</td></tr>',
        '<tr style="background:#e8f5e9;"><td><b>' + (isBalance ? 'Balance just paid' : 'Deposit paid') + '</b></td><td>✅ £' + escHtml((session.amount_total / 100).toFixed(2)) + '</td></tr>',
        (!isBalance && meta.balance_due
          ? '<tr><td><b>Balance owed on drop-off</b></td><td>£' + escHtml(meta.balance_due) + '</td></tr>'
          : ''),
      '</table>',
      '<p style="margin-top:20px; padding:12px; background:#fff7e0; border-left:3px solid #fdd91a; border-radius:4px; font-size:.92rem;">',
        isBalance
          ? 'This was a balance payment — booking is now paid in full.'
          : 'Customer has paid the deposit. Ring them on the number above to confirm pickup time.',
      '</p>',
    '</div>',
    '<div style="background:#f0f0f0; padding:14px; text-align:center; font-size:.8rem; color:#666;">',
      'Stripe session: ' + escHtml(session.id) + '<br/>',
      'Open in Stripe dashboard for full details.',
    '</div>',
    '</body></html>'
  ].join('');
}

async function sendNotification(env, session, kind) {
  // Prefer Resend if configured. Web3Forms / mailto is more limited.
  const recipient = env.CONTACT_RECIPIENT || RECIPIENT_DEFAULT;

  if (env.RESEND_API_KEY) {
    const subject = kind === 'balance'
      ? '💰 Balance paid — booking BB-' + session.id.slice(-8).toUpperCase()
      : '🚚 New booking + £' + (session.amount_total / 100) + ' deposit — BB-' + session.id.slice(-8).toUpperCase();

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + env.RESEND_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        from: "Big Ben's Bookings <bookings@bigbenstowingandrecovery.co.uk>",
        to: [recipient],
        reply_to: session.customer_details && session.customer_details.email,
        subject: subject,
        html: bookingEmailHtml(session, kind)
      })
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.warn('Resend failed: ' + r.status + ' ' + t.slice(0, 200));
    }
    return r.ok;
  }

  // No email provider configured — Stripe still emails Ben directly via the
  // dashboard, so this isn't catastrophic. Log it for diagnostics.
  console.warn('No RESEND_API_KEY — falling back to Stripe-only notifications.');
  return false;
}

async function onRequestPost({ request, env }) {
  const sig = request.headers.get('stripe-signature');
  const rawBody = await request.text();

  // Webhook signature must verify. If the secret isn't configured we
  // refuse — better to fail closed than to forge bookings.
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new Response('webhook_not_configured', { status: 503 });
  }
  const ok = await verifyStripeSig(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response('signature_mismatch', { status: 400 });

  let event;
  try { event = JSON.parse(rawBody); }
  catch (_) { return new Response('invalid_json', { status: 400 }); }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};
    const kind = meta.kind === 'balance' ? 'balance' : 'deposit';
    await sendNotification(env, session, kind);
  }

  // Stripe expects 200 to mark the webhook delivered. Other 2xx works too.
  return new Response('ok', { status: 200 });
}

return { post: onRequestPost };
})();

// -------- /api/upload-photo (verbs: post) --------
const route_upload_photo = (() => {
/* =========================================================
   Cloudflare Pages Function — POST /api/upload-photo
   Customer takes a photo of their stricken vehicle on the
   quote form. Upload goes to a Cloudflare R2 bucket named
   PHOTOS (binding configured in the Pages project settings).
   We hand back a short URL the customer's booking metadata
   stores so Ben can view the photo in his email / dashboard.

   Without an R2 binding we return 503 with a clear error so
   the front-end can degrade gracefully (skip the photo, still
   take the booking).

   Body: multipart/form-data with a 'photo' file (max 8MB).
   Response: { url, key }   where url = /photo/<key>
   ========================================================= */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

const MAX_BYTES = 8 * 1024 * 1024;        // 8 MB
const ALLOWED   = new Set(['image/jpeg', 'image/png', 'image/webp']);

function randomKey() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function onRequestPost({ request, env }) {
  if (!env.PHOTOS) return json({ error: 'r2_not_configured' }, 503);

  let form;
  try { form = await request.formData(); } catch (_) { return json({ error: 'invalid_form' }, 400); }
  const file = form.get('photo');
  if (!(file instanceof File)) return json({ error: 'no_photo' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'too_large', max_mb: 8 }, 400);
  if (!ALLOWED.has(file.type)) return json({ error: 'unsupported_type', allowed: Array.from(ALLOWED) }, 400);

  const ext = file.type === 'image/png' ? 'png'
            : file.type === 'image/webp' ? 'webp' : 'jpg';
  const key = randomKey() + '.' + ext;

  await env.PHOTOS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000' }
  });

  return json({ url: '/photo/' + key, key: key });
}

return { post: onRequestPost };
})();

const ROUTES = {
  '/api/admin-bookings': route_admin_bookings,
  '/api/checkout-balance': route_checkout_balance,
  '/api/checkout-deposit': route_checkout_deposit,
  '/api/checkout-summary': route_checkout_summary,
  '/api/contact': route_contact,
  '/api/driver-ping': route_driver_ping,
  '/api/driver-status': route_driver_status,
  '/api/photo': route_photo,
  '/api/reg-lookup': route_reg_lookup,
  '/api/share-location': route_share_location,
  '/api/stripe-webhook': route_stripe_webhook,
  '/api/upload-photo': route_upload_photo
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
