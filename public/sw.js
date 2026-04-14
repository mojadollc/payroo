// ── Version: change this date string on EVERY deploy ──────────────────────────
const APP_VERSION = "20250615"
const SHELL_CACHE = "payroo-shell-" + APP_VERSION
const RUNTIME_CACHE = "payroo-runtime-" + APP_VERSION

// Only cache truly static assets on install — NOT HTML pages
// HTML will be cached on first visit via network-first
const PRECACHE = [
  "/icon-192.png",
  "/icon-512.png",
  "/logo.svg",
  "/manifest.json",
]

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(PRECACHE))
  )
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting()
})

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    )
    .then(() => self.clients.claim())
    .then(() => {
      // Tell all open tabs a new version is ready
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((c) => c.postMessage({ type: "SW_UPDATED", version: APP_VERSION }))
      })
    })
  )
})

// ── Listen for skip-waiting message from the page ─────────────────────────────
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)

  if (e.request.method !== "GET" || url.origin !== location.origin) return
  if (url.pathname.startsWith("/api/")) return

  // ── Next.js JS/CSS bundles: STALE-WHILE-REVALIDATE ─────────────────────
  // Serve from cache instantly (fast load), fetch fresh in background
  if (url.pathname.startsWith("/_next/")) {
    e.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(e.request).then((cached) => {
          const fetchPromise = fetch(e.request).then((res) => {
            if (res.ok) cache.put(e.request, res.clone())
            return res
          }).catch(() => cached)

          return cached || fetchPromise
        })
      )
    )
    return
  }

  // ── HTML pages: NETWORK-FIRST (fast on good connection, offline fallback)
  if (e.request.headers.get("accept")?.includes("text/html")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone()
          caches.open(SHELL_CACHE).then((c) => c.put(e.request, clone))
          return res
        })
        .catch(() =>
          caches.match(e.request).then((r) => r || caches.match("/pos") || caches.match("/"))
        )
    )
    return
  }

  // ── Static assets (images, fonts): CACHE-FIRST ─────────────────────────
  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((res) => {
          if (res.ok && url.pathname.match(/\.(png|svg|jpg|jpeg|webp|css|woff2?|ico|json)$/)) {
            const clone = res.clone()
            caches.open(RUNTIME_CACHE).then((c) => c.put(e.request, clone))
          }
          return res
        })
    )
  )
})
