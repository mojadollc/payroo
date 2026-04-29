// ── Version: bump on EVERY deploy ─────────────────────────────────────────────
const APP_VERSION = "20260429T172426"
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
      .then((c) => c.addAll(PRECACHE))
      .then(() => {
        console.log("[SW] Precache complete")
        // Don't wait for existing tabs, take control immediately
        return self.skipWaiting()
      })
  )
})

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  console.log("[SW] Activating version:", APP_VERSION)
  e.waitUntil(
    caches.keys()
      .then((keys) => {
        console.log("[SW] Cleaning old caches:", keys.filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE))
        return Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      })
      .then(() => {
        console.log("[SW] Taking control of all clients")
        return self.clients.claim()
      })
      .then(() => {
        // Notify all clients about the update
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: "SW_UPDATED", version: APP_VERSION })
          })
        })
      })
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

  // ── Next.js JS/CSS bundles: NETWORK-FIRST with better error handling ──────
  if (url.pathname.startsWith("/_next/")) {
    e.respondWith(
      fetch(e.request, { cache: "no-cache" })
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(RUNTIME_CACHE)
              .then((c) => c.put(e.request, clone))
              .catch(() => {}) // Silent fail for cache errors
          }
          return res
        })
        .catch(() => {
          // Try cache as fallback
          return caches.match(e.request)
            .then((cached) => {
              if (cached) return cached
              // If no cache, return a basic error response
              return new Response("Network error", { 
                status: 503, 
                statusText: "Service Unavailable" 
              })
            })
        })
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
