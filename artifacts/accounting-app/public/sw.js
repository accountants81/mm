const CACHE_NAME = "abd-accounting-shell-v8";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg"];

async function cacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
}

self.addEventListener("install", event => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(async () => {
        if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
        await self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).pathname === "/sw.js") return;
  const request = event.request;
  const isLocal = new URL(request.url).origin === self.location.origin;
  const acceptsHtml = request.destination === "document" || request.headers.get("accept")?.includes("text/html");
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && isLocal) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(async () => acceptsHtml ? (await caches.match("/index.html", { ignoreSearch: true })) ?? (await caches.match("/", { ignoreSearch: true })) ?? Response.error() : Response.error());
    }),
  );
});
