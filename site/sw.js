/* Big Ben's Towing — service worker — KILL SWITCH MODE.
   The previous SW (bb-v1..bb-v5) cached HTML responses that came back
   through Cloudflare Pages' *.html → clean-URL 308 redirect. Cached
   "redirected" responses break navigation when re-served from cache,
   and that left users stuck on the home page (every other link errored).

   This file replaces the SW with a self-disabling stub that:
     1. Skips waiting + claims existing tabs immediately,
     2. Clears every cache it created,
     3. Unregisters itself so the next page load is plain network.

   Once we've confirmed all clients have rolled through this kill switch
   (a couple of days), we can ship a new lean SW that only caches static
   assets (CSS / JS / images / fonts) and stays clear of HTML caching. */

self.addEventListener('install', (event) => {
  // Don't pre-cache anything — install fast, activate fast.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Nuke every cache we ever created.
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      // Take control of any open tabs so they stop using the old SW immediately.
      await self.clients.claim();
      // Self-destruct so future page loads bypass the SW entirely.
      await self.registration.unregister();
      // Note: do NOT force-reload here. main.js no longer re-registers the SW,
      // so the unregister sticks. Force-reloading from here used to create an
      // infinite loop (register → activate → unregister → reload → register…)
      // because main.js was re-registering on every page load.
    })()
  );
});

// Pass-through: don't intercept anything. Just forward to the network.
self.addEventListener('fetch', (event) => {
  // No-op — let the browser handle the request normally.
});
