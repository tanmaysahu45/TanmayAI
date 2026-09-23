const CACHE_NAME = "tanmay-ai-v4";
const PRECACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icon.svg"
];

// Install: skipWaiting for immediate activation
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => {
      return Promise.all(
        PRECACHE.map(url =>
          c.add(url).catch(() => {
            // ignore missing files
          })
        )
      );
    })
  );
});

// Activate: delete old caches + claim clients
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME)
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: NETWORK FIRST (always fresh, cache is fallback)
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Skip external + API calls — never cache these
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(cached => cached || caches.match("./index.html"))
      )
  );
});

// Message from app: activate new SW immediately
self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});