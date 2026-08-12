/**
 * Philippines Timezone Utility (Asia/Manila, UTC+8)
 * Use these helpers everywhere instead of raw new Date() + setHours()
 */

const TZ = "Asia/Manila"

/** Current date/time in PH time */
export function nowPH(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }))
}

/** Start of today in PH time (00:00:00.000) as UTC Date */
export function todayStartPH(): Date {
  const ph = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }))
  ph.setHours(0, 0, 0, 0)
  // Convert back to UTC by offsetting +8h
  return new Date(ph.getTime() - 8 * 60 * 60 * 1000)
}

/** End of today in PH time (23:59:59.999) as UTC Date */
export function todayEndPH(): Date {
  const ph = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }))
  ph.setHours(23, 59, 59, 999)
  return new Date(ph.getTime() - 8 * 60 * 60 * 1000)
}

/**
 * Given a date string/Date from client, set it to start-of-day in PH time.
 * Use for "from" params coming from the date range picker.
 */
export function startOfDayPH(date: Date | string): Date {
  const d = new Date(date)
  // Format in PH time, then parse back
  const phStr = d.toLocaleDateString("en-CA", { timeZone: TZ }) // YYYY-MM-DD
  return new Date(`${phStr}T00:00:00+08:00`)
}

/**
 * Given a date string/Date from client, set it to end-of-day in PH time.
 * Use for "to" params coming from the date range picker.
 */
export function endOfDayPH(date: Date | string): Date {
  const d = new Date(date)
  const phStr = d.toLocaleDateString("en-CA", { timeZone: TZ }) // YYYY-MM-DD
  return new Date(`${phStr}T23:59:59.999+08:00`)
}

/**
 * Format a date for display in PH time.
 */
export function formatPH(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleString("en-PH", { timeZone: TZ, ...opts })
}
