/* Lucky Reels service worker — makes the installed app playable with no connection.

   Strategy: every request goes to the network first and falls back to the cache.
   That keeps deploys instant (this project has been bitten by stale cached
   scripts before) while still letting an installed copy open offline. Bump
   CACHE_VERSION to force every client onto a fresh copy.

   Sites serves the pages at extensionless URLs ("/skill-arcade") and redirects
   the ".html" form to them, so the offline lookup tries both spellings.
*/
const CACHE_VERSION = "lucky-reels-v3";
const OFFLINE_FALLBACK = "/index.html";

const PRECACHE = [
  "/",
  "/index.html",
  "/skill-arcade",
  "/space-arcade",
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

/* Resolve any page the reader asks for while offline, trying each spelling
   ("/space-arcade", "/space-arcade.html") before falling back to the casino. */
async function offlineResponse(request) {
  const path = new URL(request.url).pathname;
  const candidates = [
    path,
    path.replace(/\/index\.html$/, "/"),
    path.replace(/\.html$/, ""),
    path.replace(/\.html$/, "") + ".html",
    OFFLINE_FALLBACK,
    "/",
  ];

  for (const candidate of candidates) {
    const hit = await caches.match(candidate, { ignoreSearch: true });
    if (hit) return hit;
  }
  return Response.error();
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
      .catch(() => offlineResponse(request))
  );
});
