const CACHE_NAME = "tanmay-ai-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = req.url;
  // Don't cache API, auth, firebase, external
  if (
    url.includes("/api/") ||
    url.includes("firebase") ||
    url.includes("googleapis") ||
    url.includes("gstatic") ||
    url.includes("icons8") ||
    url.includes("cdnjs") ||
    url.includes("wikipedia") ||
    url.includes("onrender.com")
  ) {
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req)
        .then(res => {
          if (res.ok && res.type === "basic") {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});