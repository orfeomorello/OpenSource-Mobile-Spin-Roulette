const CACHE = "mobilespinroulette-__BUILD_ID__";
const PRECACHE = /* __MSR_PRECACHE__ */ [];
const OFFLINE_DOCUMENT = new URL("./index.html", self.location.href).href;

self.addEventListener("install", (event) => {
  // The production build injects every required local shell asset here. Audio
  // stays on-demand so an install never duplicates the multi-megabyte playlist.
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("mobilespinroulette-") && key !== CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Let the browser stream media directly. Audio commonly uses Range requests;
  // putting multi-megabyte responses in CacheStorage duplicates the HTTP media
  // cache, consumes mobile storage and can break partial-content playback.
  if (event.request.destination === "audio" || /\/audio\/[^/]+\.(?:mp3|wav|ogg|m4a)$/i.test(url.pathname)) return;

  // HTML must be network-first so a deployment can point at the newly hashed
  // CSS/JS files. Hashed assets remain cache-first and work offline.
  const isNavigation = event.request.mode === "navigate"
    || event.request.destination === "document";

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true })
          .then((cached) => cached || caches.match(OFFLINE_DOCUMENT))),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
      }
      return response;
    })),
  );
});
