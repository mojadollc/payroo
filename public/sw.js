// ── Version: bump on EVERY deploy ─────────────────────────────────────────────
const APP_VERSION = "20260429T212959"
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
  console.log("[SW] Installing version:", APP_VERSION)
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  console.log("[SW] Activating version:", APP_VERSION)
  e.waitUntil(
    caches.keys().then(keys => {
      // Only delete OLD caches, keep current ones
      return Promise.all(
        keys
          .filter(key => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map(key => { console.log("[SW] Deleting old cache:", key); return caches.delete(key) })
      )
    }).then(() => self.clients.claim())
  )
})

// ── Listen for messages from the page ─────────────────────────────────────────
self.addEventListener("message", (e) => {
  console.log("[SW] Received message:", e.data)
  
  if (e.data && e.data.type === "SKIP_WAITING") {
    console.log("[SW] Skipping waiting...")
    self.skipWaiting()
  }
  
  if (e.data && e.data.type === "GET_VERSION") {
    e.ports[0].postMessage({ version: APP_VERSION })
  }
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)

  // Skip non-GET requests and external URLs
  if (e.request.method !== "GET" || url.origin !== location.origin) return
  
  // Skip API calls
  if (url.pathname.startsWith("/api/")) return

  // ── Next.js JS/CSS bundles: NETWORK-FIRST, no HTML fallback ───────────
  if (url.pathname.startsWith("/_next/")) {
    e.respondWith(
      fetch(e.request, { cache: "no-cache" })
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(RUNTIME_CACHE)
              .then((c) => c.put(e.request, clone))
              .catch(() => {})
          }
          return res
        })
        .catch(() =>
          caches.match(e.request).then((cached) =>
            cached || new Response("// offline", {
              status: 503,
              headers: { "Content-Type": "application/javascript" },
            })
          )
        )
    )
    return
  }

  // ── HTML pages: NETWORK-FIRST with cache fallback ──────────────────────────
  if (e.request.headers.get("accept")?.includes("text/html")) {
    e.respondWith(
      fetch(e.request, { cache: "no-cache" })
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(SHELL_CACHE)
              .then((c) => c.put(e.request, clone))
              .catch(() => {}) // Silent fail
          }
          return res
        })
        .catch(() => {
          // Try cache fallback
          return caches.match(e.request)
            .then((cached) => {
              if (cached) return cached
              // Try root page as ultimate fallback
              return caches.match("/")
                .then((root) => root || new Response("Offline", { 
                  status: 503,
                  headers: { "Content-Type": "text/html" }
                }))
            })
        })
    )
    return
  }

  // ── Static assets: CACHE-FIRST with network fallback ───────────────────────
  e.respondWith(
    caches.match(e.request)
      .then((cached) => {
        if (cached) return cached
        
        return fetch(e.request)
          .then((res) => {
            if (res.ok && url.pathname.match(/\.(png|svg|jpg|jpeg|webp|css|woff2?|ico|json)$/)) {
              const clone = res.clone()
              caches.open(RUNTIME_CACHE)
                .then((c) => c.put(e.request, clone))
                .catch(() => {}) // Silent fail
            }
            return res
          })
      })
  )
})
