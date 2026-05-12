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

export async function onRequestPost({ request, env }) {
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
