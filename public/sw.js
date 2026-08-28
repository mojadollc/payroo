// ── Payroo POS Service Worker ──────────────────────────────────────────────────
// Strategy: never cache HTML, stale-while-revalidate for JS/CSS, cache-first for images.

const APP_VERSION = "20260828T070257"
const CACHE_NAME = "payroo-v" + APP_VERSION

const PRECACHE = [
  "/icon-192.png",
  "/icon-512.png",
  "/logo.svg",
]

// ── Install: precache icons only — do NOT skipWaiting automatically ───────────
// Calling skipWaiting() here causes an immediate controllerchange on every deploy
// which triggers a reload loop in PWA/TWA. We only skip waiting when the user
// explicitly taps "Update Now" (SKIP_WAITING message from PWAUpdateManager).
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE))
  )
})

// ── Activate: delete old caches only — do NOT claim clients ──────────────────
// clients.claim() causes controllerchange which triggers reload loops in TWA/PWA.
// The new SW will naturally control pages on next navigation.
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
  )
})

// ── Messages ──────────────────────────────────────────────────────────────────
self.addEventListener("message", (e) => {
  // Only skip waiting when user explicitly requests it
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

  // NEVER cache HTML — always network, offline fallback with app shell
  if (e.request.mode === "navigate" || e.request.headers.get("accept")?.includes("text/html")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match(e.request).then(cached => {
          if (cached) return cached
          return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payroo POS - Offline</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;text-align:center;padding:1rem}.c{max-width:320px}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#6b7280;font-size:0.875rem}button{margin-top:1rem;padding:0.75rem 1.5rem;background:#eab308;color:#fff;border:none;border-radius:0.5rem;font-weight:600;cursor:pointer}</style></head><body><div class="c"><h1>📴 You're Offline</h1><p>Don't worry — your data is saved locally. Everything will sync when you reconnect.</p><button onclick="location.reload()">Try Again</button></div></body></html>`, {
            status: 200,
            headers: { "Content-Type": "text/html" },
          })
        })
      )
    )
    return
  }

  // JS/CSS bundles (_next): these filenames are content-hashed and immutable,
  // so once we have a copy there's no need to hit the network again — serve
  // straight from cache (near-instant) and refresh the cache in the
  // background for next time. This is what was making every menu tap wait
  // on a network round-trip even for chunks already downloaded.
  if (url.pathname.startsWith("/_next/")) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const network = fetch(e.request)
          .then(res => {
            if (res.ok) {
              const clone = res.clone()
              caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {})
            }
            return res
          })
          .catch(() => cached || new Response("", { status: 503, headers: { "Content-Type": "application/javascript" } }))
        return cached || network
      })
    )
    return
  }

  // Static assets: cache-first
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

  // Everything else: network only
})
