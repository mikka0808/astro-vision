const CACHE_NAME = "astro-vision-cache-v1";
const PRECACHE_URLS = [
  "/astro-vision/",
  "/astro-vision/index.html",
  "/astro-vision/manifest.webmanifest",
];

const TEXTUAL_EXTENSIONS = [".js", ".css", ".html", ".json", ".svg", ".webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  const shouldCache =
    PRECACHE_URLS.includes(url.pathname) ||
    TEXTUAL_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));

  if (!shouldCache) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }

      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
  );
});

// TODO: ajouter les icônes PNG dans PRECACHE_URLS après leur génération locale pour les servir hors ligne.
// Note: iOS Safari ignore l'événement install en mode standalone jusqu'au prochain rechargement.
