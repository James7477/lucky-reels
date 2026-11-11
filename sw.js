/* Lucky Reels service worker — makes the installed app playable with no connection.

   Strategy: every request goes to the network first and falls back to the cache.
   That keeps deploys instant (this project has been bitten by stale cached
   scripts before) while still letting an installed copy open offline. Bump
   CACHE_VERSION to force every client onto a fresh copy.
*/
const CACHE_VERSION = "lucky-reels-v2";
const OFFLINE_FALLBACK = "/index.html";

const PRECACHE = [
  "/",
  "/index.html",
  "/skill-arcade.html",
  "/space-arcade.html",
  "/skill-arcade.css",
  "/skill-arcade.js",
  "/space-arcade.css",
  "/space-arcade.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function remember(request, response) {
  if (!response || !response.ok || response.type !== "basic") return;
  const copy = response.clone();
  caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        remember(request, response);
        return response;
      })
      .catch(() =>
        // ignoreSearch so "space-arcade.js?v=2.4" is satisfied by the cached file
        caches
          .match(request, { ignoreSearch: true })
          .then((hit) => hit || caches.match(OFFLINE_FALLBACK))
          .then((hit) => hit || Response.error())
      )
  );
});
