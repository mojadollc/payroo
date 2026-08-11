"use client"

import { FeatureGate } from "@/components/feature-gate"
import { useState, useEffect, useCallback } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts"
import {
  Brain, TrendingUp, MapPin, Package, Clock, RefreshCw,
  Filter, Download, Globe, Store, Flame, BarChart2, Calendar,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { getStoreId } from "@/lib/store-id"
import { MobileAppShell, MobileCard, MobileSectionHeader } from "@/components/mobile-app-shell"

const HOUR_LABELS = ["12am","1am","2am","3am","4am","5am","6am","7am","8am","9am","10am","11am",
  "12pm","1pm","2pm","3pm","4pm","5pm","6pm","7pm","8pm","9pm","10pm","11pm"]

const COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6","#ec4899","#14b8a6"]

function formatPeso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function getCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function MarketIntelligencePage() {
  return (
    <FeatureGate feature="marketIntelligence">
      <MarketIntelligencePageContent />
    </FeatureGate>
  )
}

function MarketIntelligencePageContent() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  // Filter state
  const [selectedCity, setSelectedCity] = useState("all")
  const [selectedRegion, setSelectedRegion] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedBusinessType, setSelectedBusinessType] = useState("all")
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [selectedProduct, setSelectedProduct] = useState("all")

  // Data state
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [hourlySales, setHourlySales] = useState<any[]>([])
  const [cityBreakdown, setCityBreakdown] = useState<any[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [businessTypes, setBusinessTypes] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])

  // Summary stats
  const totalQty = topProducts.reduce((s, p) => s + p.totalQty, 0)
  const totalRevenue = topProducts.reduce((s, p) => s + p.totalRevenue, 0)
  const peakHour = hourlySales.reduce((max, h) => h.totalQty > (max?.totalQty ?? 0) ? h : max, hourlySales[0])
  const topCity = cityBreakdown[0]

  const loadFilters = useCallback(async () => {
    try {
      const res = await fetch("/api/market-intelligence/distinct")
      const { data } = await res.json()
      if (data) {
        setCities(data.cities ?? []); setRegions(data.regions ?? []); setCategories(data.categories ?? [])
        setBusinessTypes(data.businessTypes ?? []); setProducts(data.products ?? [])
      }
    } catch {}
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCity !== "all") params.set("city", selectedCity)
      if (selectedRegion !== "all") params.set("region", selectedRegion)
      if (selectedCategory !== "all") params.set("category", selectedCategory)
      if (selectedBusinessType !== "all") params.set("businessType", selectedBusinessType)
      if (selectedMonth) params.set("month", selectedMonth)
      if (selectedProduct !== "all") params.set("productName", selectedProduct)
      const res = await fetch(`/api/market-intelligence/data?${params}`)
      const { data } = await res.json()
      setTopProducts(data?.topProducts ?? [])
      setHourlySales((data?.hourlySales ?? []).map((h: any, i: number) => ({ ...h, label: HOUR_LABELS[i] })))
      setCityBreakdown((data?.cityBreakdown ?? []).slice(0, 10))
    } catch (err: any) {
      toast({ title: "Failed to load market data", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [selectedCity, selectedRegion, selectedCategory, selectedBusinessType, selectedMonth, selectedProduct])

  useEffect(() => { loadFilters() }, [loadFilters])
  useEffect(() => { loadData() }, [loadData])

  const exportCSV = () => {
    const rows = [
      ["Product", "Category", "City", "Total Qty Sold", "Total Revenue"],
      ...topProducts.map(p => [p.productName, p.category, p.city, p.totalQty, p.totalRevenue]),
    ]
    const csv = rows.map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url
    a.download = `market-intelligence-${selectedMonth}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })

  return (
    <MobileAppShell
      title="Market Intel"
      subtitle="Consumer behavior data"
      headerAction={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={topProducts.length === 0} className="h-9 gap-1.5">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="h-9 gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{loading ? "Loading..." : "Refresh"}</span>
          </Button>
        </div>
      }
    >
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {/* Month Filter */}
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-full h-12 rounded-xl border-2">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <MobileCard className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Package className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Units Sold</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{totalQty.toLocaleString()}</div>
          </MobileCard>

          <MobileCard className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-500 rounded-lg">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Revenue</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{formatPeso(totalRevenue)}</div>
          </MobileCard>

          <MobileCard className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-orange-500 rounded-lg">
                <Clock className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Peak Hour</span>
            </div>
            <div className="text-2xl font-bold text-orange-600">{peakHour ? HOUR_LABELS[peakHour.hour] : "—"}</div>
          </MobileCard>

          <MobileCard className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-500 rounded-lg">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Top City</span>
            </div>
            <div className="text-lg font-bold text-purple-600 truncate">{topCity?.city ?? "—"}</div>
          </MobileCard>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="products" className="w-full">
          <div className="px-1 pt-1">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="products" className="text-xs gap-1"><Flame className="h-3 w-3" /> Products</TabsTrigger>
              <TabsTrigger value="hourly" className="text-xs gap-1"><Clock className="h-3 w-3" /> Hourly</TabsTrigger>
              <TabsTrigger value="cities" className="text-xs gap-1"><Globe className="h-3 w-3" /> Cities</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="products" className="mt-0">
            <MobileCard className="p-4">
              {topProducts.length === 0 ? <EmptyState /> : (
                <div className="space-y-3">
                  {topProducts.slice(0, 8).map((p, i) => (
                    <div key={p.productName} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.productName}</p>
                        <p className="text-xs text-muted-foreground">{p.totalQty.toLocaleString()} units • {formatPeso(p.totalRevenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </MobileCard>
          </TabsContent>

          <TabsContent value="hourly" className="mt-0">
            <MobileCard className="p-4">
              {hourlySales.every(h => h.totalQty === 0) ? <EmptyState /> : (
                <div className="space-y-2">
                  {hourlySales.filter((_, i) => i % 2 === 0).map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground w-12">{HOUR_LABELS[h.hour]}</span>
                      <div className="flex-1 mx-3 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(100, (h.totalQty / (peakHour?.totalQty || 1)) * 100)}%` }} />
                      </div>
                      <span className="font-medium w-8 text-right">{h.totalQty}</span>
                    </div>
                  ))}
                </div>
              )}
            </MobileCard>
          </TabsContent>

          <TabsContent value="cities" className="mt-0">
            <MobileCard className="p-4">
              {cityBreakdown.length === 0 ? <EmptyState /> : (
                <div className="space-y-3">
                  {cityBreakdown.slice(0, 6).map((c, i) => (
                    <div key={c.city} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{c.city}</p>
                        <p className="text-xs text-muted-foreground">{c.totalQty.toLocaleString()} units</p>
                      </div>
                      <span className="font-bold text-green-600">{formatPeso(c.totalRevenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </MobileCard>
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>
                {monthOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="City" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedBusinessType} onValueChange={setSelectedBusinessType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Business Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {businessTypes.map(b => <SelectItem key={b} value={b} className="capitalize">{b}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Total Units Sold",
            value: totalQty.toLocaleString(),
            icon: <Package className="h-4 w-4 text-blue-500" />,
            color: "text-blue-600",
            sub: `across ${selectedCity !== "all" ? selectedCity : "all cities"}`,
          },
          {
            label: "Total Network Revenue",
            value: formatPeso(totalRevenue),
            icon: <TrendingUp className="h-4 w-4 text-green-500" />,
            color: "text-green-600",
            sub: selectedMonth,
          },
          {
            label: "Peak Sales Hour",
            value: peakHour ? HOUR_LABELS[peakHour.hour] : "—",
            icon: <Clock className="h-4 w-4 text-orange-500" />,
            color: "text-orange-600",
            sub: peakHour ? `${peakHour.totalQty} units` : "no data",
          },
          {
            label: "Top City",
            value: topCity?.city ?? "—",
            icon: <MapPin className="h-4 w-4 text-purple-500" />,
            color: "text-purple-600",
            sub: topCity ? `${topCity.totalQty.toLocaleString()} units` : "no data",
          },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                {s.icon}
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Charts */}
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products"><Flame className="h-4 w-4 mr-1" /> Top Products</TabsTrigger>
          <TabsTrigger value="hourly"><Clock className="h-4 w-4 mr-1" /> Sales by Hour</TabsTrigger>
          <TabsTrigger value="cities"><Globe className="h-4 w-4 mr-1" /> City Breakdown</TabsTrigger>
          <TabsTrigger value="insights"><Brain className="h-4 w-4 mr-1" /> AI Insights</TabsTrigger>
        </TabsList>

        {/* Top Products */}
        <TabsContent value="products">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top Selling Products</CardTitle>
                <CardDescription>By units sold across the network</CardDescription>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <EmptyState />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topProducts.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="productName" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip formatter={(v: any) => [`${v} units`, "Qty"]} />
                      <Bar dataKey="totalQty" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top Products by Revenue</CardTitle>
                <CardDescription>Network-wide revenue contribution</CardDescription>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {topProducts.map((p, i) => (
                      <div key={p.productName} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">{p.productName}</p>
                            <p className="text-sm font-bold text-green-600 shrink-0 ml-2">{formatPeso(p.totalRevenue)}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px] py-0 h-4">{p.category}</Badge>
                            <span className="text-xs text-muted-foreground">{p.totalQty.toLocaleString()} units</span>
                          </div>
                          <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round((p.totalRevenue / (topProducts[0]?.totalRevenue || 1)) * 100)}%`,
                                backgroundColor: COLORS[i % COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Hourly Sales */}
        <TabsContent value="hourly">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Sales Activity by Hour of Day
              </CardTitle>
              <CardDescription>
                When do customers buy the most?
                {peakHour && <span className="ml-2 text-orange-600 font-medium">Peak: {HOUR_LABELS[peakHour.hour]} ({peakHour.totalQty} units)</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hourlySales.every(h => h.totalQty === 0) ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={hourlySales}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [`${v} units`, "Units Sold"]} />
                    <Bar dataKey="totalQty" fill="#f59e0b" radius={[4, 4, 0, 0]}
                      label={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* City Breakdown */}
        <TabsContent value="cities">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sales by City</CardTitle>
                <CardDescription>Which cities buy the most?</CardDescription>
              </CardHeader>
              <CardContent>
                {cityBreakdown.length === 0 ? (
                  <EmptyState />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={cityBreakdown} layout="vertical" margin={{ left: 80 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="city" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip formatter={(v: any, name: string) => [name === "totalRevenue" ? formatPeso(v) : `${v} units`, name === "totalRevenue" ? "Revenue" : "Units"]} />
                      <Bar dataKey="totalQty" fill="#10b981" radius={[0, 4, 4, 0]} name="Units" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">City Revenue Ranking</CardTitle>
                <CardDescription>Network revenue by location</CardDescription>
              </CardHeader>
              <CardContent>
                {cityBreakdown.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {cityBreakdown.map((c, i) => (
                      <div key={c.city} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{c.city}</p>
                              <p className="text-xs text-muted-foreground">{c.region}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-600">{formatPeso(c.totalRevenue)}</p>
                              <p className="text-xs text-muted-foreground">{c.totalQty.toLocaleString()} units</p>
                            </div>
                          </div>
                          <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.round((c.totalRevenue / (cityBreakdown[0]?.totalRevenue || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Insights */}
        <TabsContent value="insights">
          <div className="grid gap-4 md:grid-cols-2">
            <InsightCard
              icon="🔥"
              title="Hottest Product Right Now"
              color="bg-orange-50 border-orange-200"
              insight={topProducts[0]
                ? `"${topProducts[0].productName}" is the #1 selling product with ${topProducts[0].totalQty.toLocaleString()} units sold this month${selectedCity !== "all" ? ` in ${selectedCity}` : " across all cities"}.`
                : "Not enough data yet. Sales data will appear here as stores process transactions."}
            />
            <InsightCard
              icon="🕐"
              title="Peak Sales Window"
              color="bg-yellow-50 border-yellow-200"
              insight={peakHour && peakHour.totalQty > 0
                ? `Sales peak at ${HOUR_LABELS[peakHour.hour]} with ${peakHour.totalQty} units sold. Brands should schedule promotions and restocks before this window.`
                : "No hourly data yet. Insights will appear after sales are recorded."}
            />
            <InsightCard
              icon="📍"
              title="Top Market Location"
              color="bg-blue-50 border-blue-200"
              insight={topCity
                ? `${topCity.city} (${topCity.region}) leads with ${topCity.totalQty.toLocaleString()} units and ${formatPeso(topCity.totalRevenue)} in revenue. High-density market for brand activations.`
                : "No location data yet. Make sure stores have set their city and region in settings."}
            />
            <InsightCard
              icon="📦"
              title="Category Demand Signal"
              color="bg-purple-50 border-purple-200"
              insight={topProducts.length > 0
                ? (() => {
                    const catMap = new Map<string, number>()
                    topProducts.forEach(p => catMap.set(p.category, (catMap.get(p.category) ?? 0) + p.totalQty))
                    const topCat = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1])[0]
                    return topCat
                      ? `"${topCat[0]}" is the highest-demand category with ${topCat[1].toLocaleString()} units sold. Brands in this category have the highest visibility.`
                      : "Analyzing category data..."
                  })()
                : "No category data yet."}
            />
            <InsightCard
              icon="💡"
              title="Brand Intelligence Value"
              color="bg-green-50 border-green-200"
              insight="This network collects real-time, anonymized point-of-sale data from thousands of Filipino stores. Brands like Nestlé, Unilever, and San Miguel can use this data to understand regional demand, optimize distribution, and time promotions — data that traditionally costs millions to collect."
            />
            <InsightCard
              icon="🗺️"
              title="Barangay-Level Insights"
              color="bg-indigo-50 border-indigo-200"
              insight="As more stores join the network and set their barangay location, this platform will provide hyper-local consumer behavior maps — showing which barangay drinks the most soda, where cigarette sales spike on weekends, and which areas are underserved by specific product categories."
            />
          </div>

          {/* Data monetization callout */}
          <Card className="mt-4 border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="text-3xl">🏢</div>
                <div>
                  <p className="font-bold text-base">Enterprise Data Licensing</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This platform's aggregated, anonymized sales data is a premium asset. FMCG companies, distributors,
                    and market research firms pay significant amounts for real-time retail intelligence at this scale.
                    Contact us to discuss data licensing partnerships.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {["Real-time SKU velocity", "Regional demand heatmaps", "Hourly purchase patterns",
                      "Category trend analysis", "Competitive shelf share", "Seasonal spike detection"].map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </MobileAppShell>
  )
}

function InsightCard({ icon, title, insight, color }: { icon: string; title: string; insight: string; color: string }) {
  return (
    <Card className={`border ${color}`}>
      <CardContent className="p-4 flex gap-3">
        <span className="text-2xl shrink-0">{icon}</span>
        <div>
          <p className="font-semibold text-sm mb-1">{title}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <BarChart2 className="h-10 w-10 mb-3 opacity-30" />
      <p className="font-medium text-sm">No data yet</p>
      <p className="text-xs mt-1">Data appears as stores process sales transactions</p>
    </div>
  )
}
