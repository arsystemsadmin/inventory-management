// Binventory service worker: network-first, no data caching.
// Only an offline notice is cached, shown when a page can't load.
const OFFLINE = "/offline.html";
const CACHE = "binventory-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return; // everything else: browser default
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});
