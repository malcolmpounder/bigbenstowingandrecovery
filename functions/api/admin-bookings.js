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

export async function onRequestGet({ request, env }) {
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
