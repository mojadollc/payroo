"use client"
import { FeatureGate } from "@/components/feature-gate"

import { useState, useEffect, useCallback, useRef } from "react"
import { Brain, RefreshCw, PackagePlus, MapPin, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, CloudSun, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { getSales, getProducts, updateProduct } from "@/lib/firebase/services"
import { generateRestockReport, type RestockReport, type RestockSuggestion } from "@/lib/ai-restock-engine"
import { MobileAppShell, MobileCard, MobileSectionHeader } from "@/components/mobile-app-shell"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// â”€â”€ Urgency helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const URGENCY_CONFIG = {
  critical: { label: "Critical", color: "bg-red-100 text-red-700 border-red-300", bar: "bg-red-500", dot: "bg-red-500" },
  high:     { label: "High",     color: "bg-orange-100 text-orange-700 border-orange-300", bar: "bg-orange-500", dot: "bg-orange-500" },
  medium:   { label: "Medium",   color: "bg-yellow-100 text-yellow-700 border-yellow-300", bar: "bg-yellow-500", dot: "bg-yellow-500" },
  low:      { label: "Low",      color: "bg-blue-100 text-blue-700 border-blue-300", bar: "bg-blue-400", dot: "bg-blue-400" },
}

// â”€â”€ Quick Restock Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RestockDialog({ suggestion, onClose, onDone }: {
  suggestion: RestockSuggestion; onClose: () => void; onDone: () => void
}) {
  const [qty, setQty] = useState(String(suggestion.suggestedRestock || suggestion.predictedDemand * 3))
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleRestock = async () => {
    const add = parseInt(qty)
    if (isNaN(add) || add <= 0) return
    setSaving(true)
    try {
      await updateProduct(suggestion.productId, { stock: suggestion.currentStock + add })
      toast({ title: `âœ… Restocked ${suggestion.productName}`, description: `+${add} units added` })
      onDone()
      onClose()
    } catch {
      toast({ title: "Error restocking", variant: "destructive" })
    } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Restock â€” {suggestion.productName}</DialogTitle><DialogDescription>Confirm restock quantity</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Current stock</span><span className="font-bold">{suggestion.currentStock} units</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Predicted demand</span><span className="font-bold text-orange-600">~{suggestion.predictedDemand} units</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Days until stockout</span><span className={`font-bold ${suggestion.daysUntilStockout <= 1 ? "text-red-600" : "text-green-600"}`}>{suggestion.daysUntilStockout === 999 ? "âˆž" : `${suggestion.daysUntilStockout}d`}</span></div>
          </div>
          <div>
            <label className="text-sm font-medium">Units to add</label>
            <Input type="number" value={qty} onChange={e => setQty(e.target.value)} min="1" className="mt-1" autoFocus />
          </div>
          {qty && !isNaN(parseInt(qty)) && (
            <p className="text-sm text-muted-foreground">New stock: <span className="font-bold">{suggestion.currentStock + parseInt(qty)}</span></p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleRestock} disabled={saving || !qty || isNaN(parseInt(qty)) || parseInt(qty) <= 0}>
            {saving ? "Saving..." : "Confirm Restock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// â”€â”€ Suggestion Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SuggestionCard({ s, onRestock }: { s: RestockSuggestion; onRestock: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = URGENCY_CONFIG[s.urgency]
  const stockPct = s.predictedDemand > 0 ? Math.min(100, (s.currentStock / (s.predictedDemand * 3)) * 100) : 100

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${s.urgency === "critical" ? "border-red-300 bg-red-50/30" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{s.productName}</span>
            <Badge className={`text-xs border ${cfg.color}`}>{cfg.label}</Badge>
            {s.boostFactors.map(f => (
              <span key={f} className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full border border-yellow-200">{f}</span>
            ))}
          </div>
          {/* Stock bar */}
          <div className="mt-1.5 h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${cfg.bar}`} style={{ width: `${stockPct}%` }} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>Stock: <strong>{s.currentStock}</strong></span>
            <span>Demand: <strong className="text-orange-600">~{s.predictedDemand}</strong>/day</span>
            <span>Stockout: <strong className={s.daysUntilStockout <= 1 ? "text-red-600" : ""}>{s.daysUntilStockout === 999 ? "âˆž" : `${s.daysUntilStockout}d`}</strong></span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" className="h-8 text-xs gap-1" onClick={onRestock}>
            <PackagePlus className="h-3 w-3" /> +{s.suggestedRestock > 0 ? s.suggestedRestock : "Restock"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="pt-1 border-t space-y-1">
          {s.reasons.map((r, i) => (
            <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
              <span className="mt-0.5">â€¢</span><span>{r}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RestockPageContent() {
  const [report, setReport] = useState<RestockReport | null>(null)
  const [loading, setLoading] = useState(false)
  const hasLoaded = useRef(false)
  const [restockTarget, setRestockTarget] = useState<RestockSuggestion | null>(null)
  const [locationStatus, setLocationStatus] = useState<"idle" | "fetching" | "done" | "denied">("idle")
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [filter, setFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all")
  const { toast } = useToast()

  const runAnalysis = useCallback(async (lat?: number, lon?: number) => {
    if (!hasLoaded.current) setLoading(true)
    try {
      const today = new Date()
      const ninetyDaysAgo = new Date(today); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      const [sales, products] = await Promise.all([
        getSales(ninetyDaysAgo, today),
        getProducts(),
      ])
      const r = await generateRestockReport(sales, products, lat, lon)
      setReport(r)
    } catch (e) {
      toast({ title: "Analysis failed", description: "Could not generate restock report", variant: "destructive" })
    } finally { hasLoaded.current = true; setLoading(false) }
  }, [toast])

  useEffect(() => { runAnalysis() }, [runAnalysis])

  const handleUseLocation = () => {
    if (!navigator.geolocation) { toast({ title: "Geolocation not supported", variant: "destructive" }); return }
    setLocationStatus("fetching")
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        setCoords({ lat: c.latitude, lon: c.longitude })
        setLocationStatus("done")
        runAnalysis(c.latitude, c.longitude)
      },
      () => { setLocationStatus("denied"); toast({ title: "Location denied â€” using Metro Manila weather", variant: "destructive" }) }
    )
  }

  const filtered = report?.suggestions.filter(s => filter === "all" || s.urgency === filter) ?? []
  const counts = {
    critical: report?.suggestions.filter(s => s.urgency === "critical").length ?? 0,
    high: report?.suggestions.filter(s => s.urgency === "high").length ?? 0,
    medium: report?.suggestions.filter(s => s.urgency === "medium").length ?? 0,
    low: report?.suggestions.filter(s => s.urgency === "low").length ?? 0,
  }

  return (
    <MobileAppShell
      title="AI Restocking"
      subtitle="Smart restock predictions"
      headerAction={
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleUseLocation} 
            disabled={locationStatus === "fetching"} 
            className="h-9 gap-1.5"
          >
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">
              {locationStatus === "done" ? "Location On" : locationStatus === "fetching" ? "Getting..." : "Use Location"}
            </span>
          </Button>
          <Button size="sm" onClick={() => runAnalysis(coords?.lat, coords?.lon)} disabled={loading} className="h-9 gap-1.5 bg-purple-600 hover:bg-purple-700">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{loading ? "Analyzing..." : "Refresh"}</span>
          </Button>
        </div>
      }
    >
      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!loading && report && (
          <>
            {/* Weather & Events Banner */}
            <MobileCard className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h2 className="text-base font-bold leading-tight">{report.headline}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{report.summary}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{report.date}</p>
                </div>
                <div className="text-3xl shrink-0">{report.weather.emoji}</div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs bg-background/50 rounded-lg p-2">
                <CloudSun className="h-3.5 w-3.5" />
                <span>{report.weather.description}</span>
                <span className="text-muted-foreground">â€¢</span>
                <span>{report.weather.temp}Â°C tomorrow</span>
              </div>
              {report.events.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {report.events.map((e, i) => (
                    <div key={i} className="flex items-center gap-1 bg-yellow-100 text-yellow-800 rounded-full px-2 py-0.5 text-[10px] border border-yellow-200">
                      <span>{e.emoji}</span>
                      <span className="font-medium">{e.label}</span>
                      <span className="text-yellow-600">+{Math.round((e.boostMultiplier - 1) * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </MobileCard>

            {/* Urgency Filter Cards */}
            <div className="grid grid-cols-4 gap-2">
              {(["critical", "high", "medium", "low"] as const).map(u => {
                const cfg = URGENCY_CONFIG[u]
                const count = report.suggestions.filter(s => s.urgency === u).length
                return (
                  <button
                    key={u}
                    onClick={() => setFilter(filter === u ? "all" : u)}
                    className={`rounded-xl border p-2.5 text-center transition-all ${filter === u ? "ring-2 ring-primary bg-primary/5" : "bg-card"}`}
                  >
                    <div className="flex justify-center mb-1">
                      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                    </div>
                    <div className="text-[15px] font-bold truncate">{count}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">{u}</div>
                  </button>
                )
              })}
            </div>

            {/* Suggestions List */}
            {filtered.length === 0 ? (
              <MobileCard className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="font-medium">
                  {filter === "all" ? "Stock looks good! ðŸ‘" : `No ${filter} items`}
                </p>
              </MobileCard>
            ) : (
              <div className="space-y-2">
                <MobileSectionHeader
                  title={filter === "all" ? `All Suggestions (${filtered.length})` : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Priority (${filtered.length})`}
                  action={filter !== "all" ? (
                    <button onClick={() => setFilter("all")} className="text-xs text-primary">Show all</button>
                  ) : undefined}
                />
                {filtered.map(s => {
                  const sCfg = URGENCY_CONFIG[s.urgency]
                  const stockPct = s.predictedDemand > 0 ? Math.min(100, (s.currentStock / (s.predictedDemand * 3)) * 100) : 100
                  return (
                    <MobileCard key={s.productId} className={`p-3 ${s.urgency === "critical" ? "border-red-300" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="font-semibold text-sm truncate">{s.productName}</span>
                            <Badge className={`text-[10px] border ${sCfg.color}`}>{sCfg.label}</Badge>
                          </div>
                          {/* Boost factors */}
                          {s.boostFactors.length > 0 && (
                            <div className="flex gap-1 flex-wrap mb-1.5">
                              {s.boostFactors.map(f => (
                                <span key={f} className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full border border-yellow-200">{f}</span>
                              ))}
                            </div>
                          )}
                          {/* Stock bar */}
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-1.5">
                            <div className={`h-full rounded-full transition-all ${sCfg.bar}`} style={{ width: `${stockPct}%` }} />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>Stock: <strong>{s.currentStock}</strong></span>
                            <span>Demand: <strong className="text-orange-600">~{s.predictedDemand}</strong>/day</span>
                            <span>Stockout: <strong className={s.daysUntilStockout <= 1 ? "text-red-600" : ""}>{s.daysUntilStockout === 999 ? "âˆž" : `${s.daysUntilStockout}d`}</strong></span>
                          </div>
                          {/* Reasons (collapsed) */}
                          {s.reasons.length > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t space-y-0.5">
                              {s.reasons.map((r, i) => (
                                <p key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                                  <span className="mt-0.5">â€¢</span><span>{r}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0">
                          <Button size="sm" className="h-9 text-xs bg-purple-600 hover:bg-purple-700 gap-1" onClick={() => setRestockTarget(s)}>
                            <PackagePlus className="h-3.5 w-3.5" />
                            +{s.suggestedRestock || "Add"}
                          </Button>
                        </div>
                      </div>
                    </MobileCard>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!loading && report && (
          <>
            {/* Headline Banner */}
            <div className="rounded-xl border bg-gradient-to-r from-purple-50 to-blue-50 p-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{report.headline}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{report.summary}</p>
                  <p className="text-xs text-muted-foreground mt-1">{report.date}</p>
                </div>
                <div className="flex items-center gap-2 text-sm shrink-0">
                  <span className="text-2xl">{report.weather.emoji}</span>
                  <div>
                    <p className="font-semibold">{report.weather.description}</p>
                    <p className="text-xs text-muted-foreground">{report.weather.temp}Â°C tomorrow</p>
                  </div>
                </div>
              </div>
            </div>

            {/* PH Events */}
            {report.events.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-4">
                {report.events.map((e, i) => (
                  <div key={i} className="flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs bg-card">
                    <span>{e.emoji}</span>
                    <span className="font-medium">{e.label}</span>
                    <span className="text-muted-foreground">+{Math.round((e.boostMultiplier - 1) * 100)}% demand</span>
                  </div>
                ))}
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
              {(["critical", "high", "medium", "low"] as const).map(u => {
                const cfg = URGENCY_CONFIG[u]
                return (
                  <button
                    key={u}
                    onClick={() => setFilter(filter === u ? "all" : u)}
                    className={`rounded-lg border p-3 text-left transition-all hover:border-primary ${filter === u ? "ring-1 ring-primary border-primary" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                      <span className="text-xs font-medium capitalize">{u}</span>
                    </div>
                    <div className="text-[15px] font-bold mt-1 truncate">{counts[u]}</div>
                    <div className="text-xs text-muted-foreground">items</div>
                  </button>
                )
              })}
            </div>

            {/* Suggestions */}
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-60" />
                <p className="font-medium">
                  {filter === "all" ? "No restock needed â€” stock looks good for tomorrow! ðŸ‘" : `No ${filter} urgency items`}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {filter === "all" ? "All Suggestions" : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Priority`} ({filtered.length})
                  </p>
                  {filter !== "all" && (
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setFilter("all")}>Show all</Button>
                  )}
                </div>
                {filtered.map(s => (
                  <SuggestionCard key={s.productId} s={s} onRestock={() => setRestockTarget(s)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Restock Dialog */}
      {restockTarget && (
        <RestockDialog
          suggestion={restockTarget}
          onClose={() => setRestockTarget(null)}
          onDone={() => runAnalysis(coords?.lat, coords?.lon)}
        />
      )}
    </MobileAppShell>
  )
}

export default function RestockPage() {
  return (
    <FeatureGate feature="aiRestock">
      <RestockPageContent />
    </FeatureGate>
  )
}
