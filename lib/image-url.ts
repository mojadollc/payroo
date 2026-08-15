/**
 * Normalise a stored imageUrl so it always works regardless of host.
 * Old records may have "http://localhost:3000/api/image/..." stored —
 * strip the origin so it becomes a relative path that works on any host.
 */
export function normaliseImageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.pathname.startsWith("/api/image/")) return parsed.pathname
  } catch {
    // already relative
  }
  return url
}
