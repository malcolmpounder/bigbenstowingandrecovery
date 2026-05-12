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

export async function onRequestGet({ request, env }) {
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
