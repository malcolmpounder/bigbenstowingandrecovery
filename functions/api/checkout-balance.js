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

export async function onRequestPost({ request, env }) {
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
