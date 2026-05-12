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

export async function onRequestPost({ request, env }) {
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

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: { 'access-control-allow-methods': 'POST, OPTIONS' }
  });
}
