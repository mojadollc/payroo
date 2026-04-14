import type { Sale, Product } from "./firebase/types"
import type { Timestamp } from "firebase/firestore"

// ── Philippine Calendar Context ───────────────────────────────────────────────

export type PHEvent = {
  label: string
  emoji: string
  type: "payday" | "holiday" | "weekend" | "weekday" | "season" | "special"
  boostCategories: string[]   // product name keywords that sell more
  boostMultiplier: number     // e.g. 1.5 = 50% more expected
  message: string
}

const PH_HOLIDAYS: Record<string, Omit<PHEvent, "type">> = {
  "01-01": { label: "New Year's Day", emoji: "🎆", boostCategories: ["beer", "softdrink", "juice", "chips", "noodle", "rice", "pork", "chicken"], boostMultiplier: 2.0, message: "New Year's Day — expect high demand for food & drinks" },
  "02-14": { label: "Valentine's Day", emoji: "❤️", boostCategories: ["chocolate", "candy", "juice", "wine", "beer", "snack"], boostMultiplier: 1.6, message: "Valentine's Day — sweets and drinks sell fast" },
  "04-09": { label: "Araw ng Kagitingan", emoji: "🇵🇭", boostCategories: ["rice", "noodle", "canned", "sardine", "beer"], boostMultiplier: 1.4, message: "Public holiday — stock up on pantry staples" },
  "05-01": { label: "Labor Day", emoji: "👷", boostCategories: ["beer", "softdrink", "snack", "noodle", "cigarette"], boostMultiplier: 1.5, message: "Labor Day — workers celebrate, expect higher foot traffic" },
  "06-12": { label: "Independence Day", emoji: "🇵🇭", boostCategories: ["beer", "softdrink", "chips", "noodle", "rice"], boostMultiplier: 1.6, message: "Independence Day — family gatherings boost food & drinks" },
  "08-21": { label: "Ninoy Aquino Day", emoji: "🕊️", boostCategories: ["rice", "noodle", "canned", "sardine"], boostMultiplier: 1.3, message: "Public holiday — steady demand for basics" },
  "11-01": { label: "All Saints' Day", emoji: "🕯️", boostCategories: ["candle", "flower", "water", "juice", "snack", "noodle"], boostMultiplier: 1.8, message: "Undas — candles, water, and snacks sell heavily" },
  "11-02": { label: "All Souls' Day", emoji: "🕯️", boostCategories: ["candle", "water", "juice", "snack", "noodle"], boostMultiplier: 1.6, message: "All Souls' Day — continued Undas demand" },
  "12-24": { label: "Christmas Eve", emoji: "🎄", boostCategories: ["beer", "softdrink", "juice", "rice", "pork", "chicken", "noodle", "chips", "candy", "chocolate"], boostMultiplier: 2.5, message: "Noche Buena — biggest shopping day of the year!" },
  "12-25": { label: "Christmas Day", emoji: "🎅", boostCategories: ["beer", "softdrink", "juice", "snack", "noodle"], boostMultiplier: 2.0, message: "Christmas Day — family gatherings, high demand all day" },
  "12-30": { label: "Rizal Day", emoji: "🇵🇭", boostCategories: ["beer", "softdrink", "noodle", "rice"], boostMultiplier: 1.4, message: "Rizal Day — public holiday, stock basics" },
  "12-31": { label: "New Year's Eve", emoji: "🎇", boostCategories: ["beer", "softdrink", "juice", "chips", "noodle", "rice", "pork", "chicken", "fireworks"], boostMultiplier: 2.3, message: "Media Noche — second biggest demand spike of the year!" },
}

// Payday: 15th and last day of month
function isPayday(date: Date): boolean {
  const day = date.getDate()
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return day === 15 || day === lastDay
}

function isPaydayEve(date: Date): boolean {
  const day = date.getDate()
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return day === 14 || day === (lastDay - 1)
}

function getMonthKey(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function getPHContext(date: Date): PHEvent[] {
  const events: PHEvent[] = []
  const dow = date.getDay() // 0=Sun, 6=Sat
  const monthKey = getMonthKey(date)
  const month = date.getMonth() + 1

  // Holiday check
  if (PH_HOLIDAYS[monthKey]) {
    events.push({ ...PH_HOLIDAYS[monthKey], type: "holiday" })
  }

  // Payday
  if (isPayday(date)) {
    events.push({
      label: "Payday", emoji: "💰", type: "payday",
      boostCategories: ["beer", "softdrink", "cigarette", "noodle", "chips", "snack", "rice", "pork", "chicken", "juice"],
      boostMultiplier: 1.7,
      message: "Payday — customers have cash, expect 50–70% more sales on snacks, drinks & cigarettes",
    })
  } else if (isPaydayEve(date)) {
    events.push({
      label: "Payday Eve", emoji: "💸", type: "payday",
      boostCategories: ["noodle", "canned", "sardine", "rice", "softdrink"],
      boostMultiplier: 1.2,
      message: "Day before payday — budget shoppers buy cheap staples",
    })
  }

  // Weekend
  if (dow === 0 || dow === 6) {
    events.push({
      label: dow === 0 ? "Sunday" : "Saturday", emoji: "🏖️", type: "weekend",
      boostCategories: ["beer", "softdrink", "chips", "snack", "noodle", "rice"],
      boostMultiplier: 1.3,
      message: "Weekend — families stay home, higher demand for food & drinks",
    })
  }

  // Rainy season (June–October)
  if (month >= 6 && month <= 10) {
    events.push({
      label: "Rainy Season", emoji: "🌧️", type: "season",
      boostCategories: ["noodle", "canned", "sardine", "coffee", "tea", "umbrella", "medicine", "vitamin"],
      boostMultiplier: 1.25,
      message: "Rainy season — noodles, canned goods, and medicine sell more",
    })
  }

  // Summer (March–May)
  if (month >= 3 && month <= 5) {
    events.push({
      label: "Summer", emoji: "☀️", type: "season",
      boostCategories: ["water", "juice", "softdrink", "ice cream", "sunscreen", "beer"],
      boostMultiplier: 1.3,
      message: "Summer — cold drinks and water sell fast",
    })
  }

  // Ber months (Sep–Dec) — Christmas shopping season
  if (month >= 9) {
    events.push({
      label: "Ber Month", emoji: "🎄", type: "season",
      boostCategories: ["candy", "chocolate", "chips", "juice", "softdrink", "beer"],
      boostMultiplier: 1.15,
      message: "Ber months — early Christmas shopping, gift items move faster",
    })
  }

  return events
}

// ── Weather Integration (Open-Meteo, free, no API key) ────────────────────────

export type WeatherData = {
  temp: number
  condition: "sunny" | "cloudy" | "rainy" | "stormy" | "unknown"
  description: string
  emoji: string
  boostKeywords: string[]
}

export async function fetchWeather(lat = 14.5995, lon = 120.9842): Promise<WeatherData> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max&timezone=Asia%2FManila&forecast_days=2`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    const data = await res.json()
    // Tomorrow's data (index 1)
    const code: number = data.daily?.weathercode?.[1] ?? 0
    const temp: number = data.daily?.temperature_2m_max?.[1] ?? 30

    let condition: WeatherData["condition"] = "unknown"
    let description = "Fair weather"
    let emoji = "🌤️"
    let boostKeywords: string[] = []

    if (code === 0) { condition = "sunny"; description = "Clear sky"; emoji = "☀️"; boostKeywords = ["water", "juice", "softdrink", "ice cream", "beer"] }
    else if (code <= 3) { condition = "cloudy"; description = "Partly cloudy"; emoji = "⛅"; boostKeywords = ["softdrink", "juice", "snack"] }
    else if (code <= 67) { condition = "rainy"; description = "Rain expected"; emoji = "🌧️"; boostKeywords = ["noodle", "canned", "sardine", "coffee", "umbrella", "medicine"] }
    else if (code <= 77) { condition = "rainy"; description = "Snow/sleet (unusual)"; emoji = "🌨️"; boostKeywords = ["noodle", "coffee"] }
    else if (code <= 82) { condition = "rainy"; description = "Rain showers"; emoji = "🌦️"; boostKeywords = ["noodle", "canned", "sardine", "coffee"] }
    else { condition = "stormy"; description = "Thunderstorm"; emoji = "⛈️"; boostKeywords = ["noodle", "canned", "sardine", "water", "candle", "flashlight", "battery"] }

    return { temp, condition, description, emoji, boostKeywords }
  } catch {
    return { temp: 30, condition: "unknown", description: "Weather unavailable", emoji: "🌤️", boostKeywords: [] }
  }
}

// ── Sales Analysis ────────────────────────────────────────────────────────────

export type ProductSalesStats = {
  productId: string
  productName: string
  currentStock: number
  avgDailySales: number           // average units sold per day overall
  avgSameDOW: number              // average units sold on same day-of-week
  totalSold: number
  lastSoldDaysAgo: number
  velocityTrend: "rising" | "stable" | "falling"  // last 7d vs prior 7d
}

function toDate(ts: Timestamp | Date | null | undefined): Date {
  if (!ts) return new Date(0)
  if (ts instanceof Date) return ts
  if (typeof (ts as any).toDate === "function") return (ts as any).toDate()
  return new Date(0)
}

export function analyzeSales(sales: Sale[], products: Product[]): ProductSalesStats[] {
  const now = new Date()
  const productMap = new Map(products.map(p => [p.id!, p]))

  // Aggregate qty sold per product per day
  const dailyMap = new Map<string, Map<string, number>>() // productId -> dateStr -> qty

  for (const sale of sales) {
    const saleDate = toDate(sale.createdAt as any)
    const dateStr = saleDate.toISOString().split("T")[0]
    for (const item of sale.items) {
      if (!dailyMap.has(item.productId)) dailyMap.set(item.productId, new Map())
      const d = dailyMap.get(item.productId)!
      d.set(dateStr, (d.get(dateStr) ?? 0) + item.quantity)
    }
  }

  const results: ProductSalesStats[] = []

  for (const product of products) {
    const pid = product.id!
    const dayMap = dailyMap.get(pid) ?? new Map<string, number>()
    const entries = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))

    const totalSold = entries.reduce((s, [, q]) => s + q, 0)
    const daysWithSales = entries.length
    const avgDailySales = daysWithSales > 0 ? totalSold / Math.max(daysWithSales, 1) : 0

    // Same day-of-week average (tomorrow's DOW)
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)
    const targetDOW = tomorrow.getDay()
    const sameDOWEntries = entries.filter(([d]) => new Date(d).getDay() === targetDOW)
    const avgSameDOW = sameDOWEntries.length > 0
      ? sameDOWEntries.reduce((s, [, q]) => s + q, 0) / sameDOWEntries.length
      : avgDailySales

    // Last sold
    const lastEntry = entries[entries.length - 1]
    const lastSoldDaysAgo = lastEntry
      ? Math.floor((now.getTime() - new Date(lastEntry[0]).getTime()) / 86400000)
      : 999

    // Velocity trend: last 7 days vs prior 7 days
    const last7 = entries.filter(([d]) => {
      const diff = (now.getTime() - new Date(d).getTime()) / 86400000
      return diff <= 7
    }).reduce((s, [, q]) => s + q, 0)
    const prior7 = entries.filter(([d]) => {
      const diff = (now.getTime() - new Date(d).getTime()) / 86400000
      return diff > 7 && diff <= 14
    }).reduce((s, [, q]) => s + q, 0)

    const velocityTrend: ProductSalesStats["velocityTrend"] =
      last7 > prior7 * 1.2 ? "rising" : last7 < prior7 * 0.8 ? "falling" : "stable"

    results.push({
      productId: pid,
      productName: product.name,
      currentStock: product.stock,
      avgDailySales,
      avgSameDOW,
      totalSold,
      lastSoldDaysAgo,
      velocityTrend,
    })
  }

  return results
}

// ── Prediction Engine ─────────────────────────────────────────────────────────

export type RestockSuggestion = {
  productId: string
  productName: string
  currentStock: number
  predictedDemand: number        // units expected to sell tomorrow
  suggestedRestock: number       // how many to add
  urgency: "critical" | "high" | "medium" | "low"
  reasons: string[]              // human-readable reasons
  boostFactors: string[]         // which events/weather triggered boost
  daysUntilStockout: number
}

export type RestockReport = {
  date: string
  events: PHEvent[]
  weather: WeatherData
  suggestions: RestockSuggestion[]
  headline: string               // e.g. "Tomorrow is Payday 💰"
  summary: string
}

function matchesKeyword(productName: string, keywords: string[]): boolean {
  const lower = productName.toLowerCase()
  return keywords.some(k => lower.includes(k.toLowerCase()))
}

export async function generateRestockReport(
  sales: Sale[],
  products: Product[],
  lat?: number,
  lon?: number,
): Promise<RestockReport> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [events, weather, stats] = await Promise.all([
    Promise.resolve(getPHContext(tomorrow)),
    fetchWeather(lat, lon),
    Promise.resolve(analyzeSales(sales, products)),
  ])

  // Combine all boost keywords from events + weather
  const allBoostKeywords = [
    ...events.flatMap(e => e.boostCategories),
    ...weather.boostKeywords,
  ]

  const suggestions: RestockSuggestion[] = []

  for (const stat of stats) {
    if (stat.avgDailySales === 0 && stat.lastSoldDaysAgo > 30) continue // never sold, skip

    // Base demand = same-DOW average, fallback to overall average
    let predictedDemand = stat.avgSameDOW > 0 ? stat.avgSameDOW : stat.avgDailySales

    const reasons: string[] = []
    const boostFactors: string[] = []

    // Apply event boosts
    for (const event of events) {
      if (matchesKeyword(stat.productName, event.boostCategories)) {
        predictedDemand *= event.boostMultiplier
        boostFactors.push(`${event.emoji} ${event.label}`)
        reasons.push(event.message)
      }
    }

    // Apply weather boost
    if (matchesKeyword(stat.productName, weather.boostKeywords)) {
      predictedDemand *= 1.2
      boostFactors.push(`${weather.emoji} ${weather.description}`)
      reasons.push(`${weather.description} — ${weather.boostKeywords.slice(0, 3).join(", ")} sell more`)
    }

    // Velocity trend
    if (stat.velocityTrend === "rising") {
      predictedDemand *= 1.15
      reasons.push("📈 Sales trending up this week")
    } else if (stat.velocityTrend === "falling") {
      predictedDemand *= 0.9
    }

    predictedDemand = Math.max(Math.ceil(predictedDemand), 1)

    const daysUntilStockout = predictedDemand > 0
      ? Math.floor(stat.currentStock / predictedDemand)
      : 999

    // Only suggest if stock is low relative to predicted demand
    const buffer = 2 // keep 2 days buffer
    const suggestedRestock = Math.max(0, Math.ceil(predictedDemand * (buffer + 1)) - stat.currentStock)

    if (suggestedRestock === 0 && daysUntilStockout > 5) continue

    let urgency: RestockSuggestion["urgency"] = "low"
    if (stat.currentStock === 0) urgency = "critical"
    else if (daysUntilStockout <= 1) urgency = "critical"
    else if (daysUntilStockout <= 2) urgency = "high"
    else if (daysUntilStockout <= 4) urgency = "medium"

    if (reasons.length === 0) reasons.push(`Sells ~${stat.avgDailySales.toFixed(1)} units/day on average`)

    suggestions.push({
      productId: stat.productId,
      productName: stat.productName,
      currentStock: stat.currentStock,
      predictedDemand,
      suggestedRestock,
      urgency,
      reasons: [...new Set(reasons)],
      boostFactors: [...new Set(boostFactors)],
      daysUntilStockout,
    })
  }

  // Sort: critical first, then by predicted demand desc
  suggestions.sort((a, b) => {
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency])
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    return b.predictedDemand - a.predictedDemand
  })

  // Build headline
  const topEvent = events.find(e => e.type === "payday" || e.type === "holiday") ?? events[0]
  const headline = topEvent
    ? `${topEvent.emoji} Tomorrow is ${topEvent.label}`
    : `${weather.emoji} Tomorrow: ${weather.description}`

  const criticalCount = suggestions.filter(s => s.urgency === "critical").length
  const highCount = suggestions.filter(s => s.urgency === "high").length
  const summary = criticalCount > 0
    ? `⚠️ ${criticalCount} item${criticalCount > 1 ? "s" : ""} will run out tomorrow — restock now!`
    : highCount > 0
    ? `${highCount} item${highCount > 1 ? "s" : ""} running low based on tomorrow's forecast`
    : suggestions.length > 0
    ? `${suggestions.length} restock suggestion${suggestions.length > 1 ? "s" : ""} for tomorrow`
    : "Stock levels look good for tomorrow 👍"

  return {
    date: tomorrow.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    events,
    weather,
    suggestions: suggestions.slice(0, 20), // top 20
    headline,
    summary,
  }
}
