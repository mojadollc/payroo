// ── Payroo POS Service Worker ──────────────────────────────────────────────────
// SIMPLE strategy: never cache HTML, network-first for JS/CSS, cache-first for images.
// This prevents stale page loads and reload loops on PWA/TWA.

const APP_VERSION = "20260508T101630"
const CACHE_NAME = "payroo-v" + APP_VERSION

const PRECACHE = [
  "/icon-192.png",
  "/icon-512.png",
  "/logo.svg",
]

// ── Install: precache icons, skip waiting immediately ─────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: delete old caches, claim clients ────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Messages ──────────────────────────────────────────────────────────────────
self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting()
  if (e.data?.type === "GET_VERSION" && e.ports[0]) {
    e.ports[0].postMessage({ version: APP_VERSION })
  }
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)

  // Only handle same-origin GET requests
  if (e.request.method !== "GET" || url.origin !== location.origin) return

  // NEVER intercept API calls
  if (url.pathname.startsWith("/api/")) return

  // NEVER cache HTML — always go to network, no fallback to stale pages
  if (e.request.mode === "navigate" || e.request.headers.get("accept")?.includes("text/html")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response("<html><body><h1>You are offline</h1><p>Please check your connection and try again.</p></body></html>", {
          status: 503,
          headers: { "Content-Type": "text/html" },
        })
      )
    )
    return
  }

  // JS/CSS bundles (_next): network-first, cache fallback, correct content-type on error
  if (url.pathname.startsWith("/_next/")) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {})
          }
          return res
        })
        .catch(() =>
          caches.match(e.request).then(cached =>
            cached || new Response("", { status: 503, headers: { "Content-Type": "application/javascript" } })
          )
        )
    )
    return
  }

  // Static assets (images, fonts, etc): cache-first
  if (url.pathname.match(/\.(png|svg|jpg|jpeg|webp|gif|ico|woff2?|ttf|css)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {})
          }
          return res
        })
      })
    )
    return
  }

  // Everything else: network only, no caching
})
