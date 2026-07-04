/* PillowFlow site — modular Astro build — offline service worker.
 * Adapted from the legacy repo-root sw.js: CORE is trimmed to routes/assets
 * that actually exist in this build (no referral.html, no
 * language-switcher.css/referral-form.js — the referral system stays out
 * of this app, strangler-fig). Astro's hashed CSS/JS/font chunks under
 * /_astro/ are NOT precached here (their filenames change per build) — the
 * generic fetch handler below caches them lazily on first request instead,
 * same as it always has for anything not in CORE. */
/* v2 (2026-07-03 iOS/PWA pass): cache-name bump purges every lazily-cached
 * hashed asset from the pre-revision-arc deploys on the next activate —
 * navigations are network-first so pages were already fresh, but old
 * /_astro/ chunks from replaced builds were accumulating forever. */
const CACHE = "pillowflow-site-v2";
const CORE = [
  "/", "/es/",
  "/manifest.webmanifest",
  "/assets/pillowflow-installation-guide.jpg",
  "/assets/icon-192.png", "/assets/icon-512.png",
  "/assets/icon-maskable-512.png", "/assets/apple-touch-icon.png"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; })
        .catch(() => caches.match(req).then((m) => m || caches.match("/")))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((m) => m || fetch(req).then((r) => {
      if (r && (r.ok || r.type === "opaque")) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
      return r;
    }).catch(() => m))
  );
});

