"use client"

import { useMemo, useEffect, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts"
import type { Sale, EWalletTransaction } from "@/lib/firebase/types"

interface ProfitChartProps {
  sales: Sale[]
  ewalletTransactions: EWalletTransaction[]
  isLoading: boolean
  tobaccoProductIds?: Set<string>
}

const COLORS = {
  sales:   { stroke: "#22c55e", fill: "#22c55e" },   // green
  ewallet: { stroke: "#3b82f6", fill: "#3b82f6" },   // blue
  tobacco: { stroke: "#f59e0b", fill: "#f59e0b" },   // amber
  total:   { stroke: "#8b5cf6", fill: "#8b5cf6" },   // purple
}

function isTobacco(cat: string) {
  const c = (cat || "").trim().toLowerCase()
  return c === "tobacco" || c === "cigarette" || c === "cigarettes" || c.includes("tobacco") || c.includes("cigarette")
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border bg-card shadow-lg p-3 text-[12px] min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full inline-block" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </div>
          <span className="font-semibold" style={{ color: p.color }}>
            ₱{Number(p.value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      ))}
    </div>
  )
}

function CustomLegend() {
  const items = [
    { key: "sales",   label: "Sales",    color: COLORS.sales.stroke },
    { key: "ewallet", label: "E-Wallet", color: COLORS.ewallet.stroke },
    { key: "tobacco", label: "Tobacco",  color: COLORS.tobacco.stroke },
    { key: "total",   label: "Total",    color: COLORS.total.stroke },
  ]
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
      {items.map(item => (
        <div key={item.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: item.color }} />
          <span className="text-[11px] text-muted-foreground font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export function ProfitChart({ sales, ewalletTransactions, isLoading, tobaccoProductIds = new Set() }: ProfitChartProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const chartData = useMemo(() => {
    const map = new Map<string, { date: string; ts: number; sales: number; ewallet: number; tobacco: number; total: number }>()

    for (const sale of sales) {
      if (sale.status === "voided") continue
      const d = new Date(sale.createdAt as any)
      const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      const ts = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const entry = map.get(date) || { date, ts, sales: 0, ewallet: 0, tobacco: 0, total: 0 }

      const saleProfit = sale.items.reduce((s, i) => s + (i.price - i.cost) * i.quantity, 0)
      const tobaccoProfit = sale.items
        .filter(i => tobaccoProductIds.has(i.productId))
        .reduce((s, i) => s + (i.price - i.cost) * i.quantity, 0)

      entry.sales   += saleProfit
      entry.tobacco += tobaccoProfit
      entry.total   += saleProfit
      map.set(date, entry)
    }

    for (const t of ewalletTransactions) {
      const d = new Date(t.createdAt as any)
      const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      const ts = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const entry = map.get(date) || { date, ts, sales: 0, ewallet: 0, tobacco: 0, total: 0 }
      entry.ewallet += Math.abs(t.profit)
      entry.total   += Math.abs(t.profit)
      map.set(date, entry)
    }

    return Array.from(map.values())
      .sort((a, b) => a.ts - b.ts)
      .map(d => ({
        ...d,
        sales:   Math.round(d.sales * 100) / 100,
        ewallet: Math.round(d.ewallet * 100) / 100,
        tobacco: Math.round(d.tobacco * 100) / 100,
        total:   Math.round(d.total * 100) / 100,
      }))
  }, [sales, ewalletTransactions])

  if (!mounted || isLoading) {
    return <div className="h-[240px] md:h-[320px] bg-muted/40 rounded-xl animate-pulse" />
  }

  if (chartData.length === 0) {
    return (
      <div className="h-[240px] md:h-[320px] flex items-center justify-center text-muted-foreground text-sm">
        No data available for selected date range
      </div>
    )
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={window.innerWidth < 768 ? 240 : 320}>
        <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {Object.entries(COLORS).map(([key, c]) => (
              <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={c.fill} stopOpacity={0.35} />
                <stop offset="95%" stopColor={c.fill} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={v => `₱${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone" dataKey="sales" name="Sales"
            stroke={COLORS.sales.stroke} fill={`url(#fill-sales)`}
            strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Area
            type="monotone" dataKey="ewallet" name="E-Wallet"
            stroke={COLORS.ewallet.stroke} fill={`url(#fill-ewallet)`}
            strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Area
            type="monotone" dataKey="tobacco" name="Tobacco"
            stroke={COLORS.tobacco.stroke} fill={`url(#fill-tobacco)`}
            strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Area
            type="monotone" dataKey="total" name="Total"
            stroke={COLORS.total.stroke} fill={`url(#fill-total)`}
            strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }}
            strokeDasharray="5 3"
          />
        </AreaChart>
      </ResponsiveContainer>
      <CustomLegend />
    </div>
  )
}
