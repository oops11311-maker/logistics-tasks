const STATIC = "logistics-static-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname !== "/icons/icon-192.png" && url.pathname !== "/icons/icon-512.png" && url.pathname !== "/manifest.webmanifest") {
    return;
  }
  event.respondWith(
    caches.open(STATIC).then(async (cache) => {
      try {
        const fresh = await fetch(event.request);
        if (fresh.ok) await cache.put(event.request, fresh.clone());
        return fresh;
      } catch {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        throw new Error("offline");
      }
    }),
  );
});
