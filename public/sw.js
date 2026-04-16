// ── Version: bump on EVERY deploy ─────────────────────────────────────────────
const APP_VERSION = "20250616"
const SHELL_CACHE = "payroo-shell-" + APP_VERSION
const RUNTIME_CACHE = "payroo-runtime-" + APP_VERSION

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

  // ── Next.js JS/CSS bundles: NETWORK-FIRST ──────────────────────────────
  // After a deploy, chunk hashes change. Old cached chunks break the app.
  // Always try network first; only fall back to cache when offline.
  if (url.pathname.startsWith("/_next/")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(RUNTIME_CACHE).then((c) => c.put(e.request, clone))
          }
          return res
        })
        .catch(() => caches.match(e.request).then((r) => r || Promise.reject("offline")))
    )
    return
  }

  // ── HTML pages: NETWORK-FIRST ──────────────────────────────────────────
  if (e.request.headers.get("accept")?.includes("text/html")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone()
          caches.open(SHELL_CACHE).then((c) => c.put(e.request, clone))
          return res
        })
        .catch(() =>
          caches.match(e.request).then((r) => r || caches.match("/") || new Response("Offline", { status: 503 }))
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
