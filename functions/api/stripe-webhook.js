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

export async function onRequestPost({ request, env }) {
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
