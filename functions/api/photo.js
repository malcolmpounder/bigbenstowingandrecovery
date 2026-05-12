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

export async function onRequestGet({ request, env }) {
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
