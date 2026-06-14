"use client"

import { useMemo, useEffect, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { Sale, EWalletTransaction } from "@/lib/firebase/types"

interface ProfitChartProps {
  sales: Sale[]
  ewalletTransactions: EWalletTransaction[]
  isLoading: boolean
}

const chartConfig = {
  sales: {
    label: "Sales Profit",
    color: "hsl(var(--chart-1))",
  },
  ewallet: {
    label: "E-Wallet Profit",
    color: "hsl(var(--chart-2))",
  },
  total: {
    label: "Total Profit",
    color: "hsl(var(--secondary))",
  },
} satisfies ChartConfig

export function ProfitChart({ sales, ewalletTransactions, isLoading }: ProfitChartProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const chartData = useMemo(() => {
    const dataMap = new Map<string, { date: string; ts: number; sales: number; ewallet: number; total: number }>()

    sales.forEach((sale) => {
      const d = sale.createdAt.toDate()
      const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      const ts = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const existing = dataMap.get(date) || { date, ts, sales: 0, ewallet: 0, total: 0 }
      existing.sales += sale.profit
      existing.total += sale.profit
      dataMap.set(date, existing)
    })

    ewalletTransactions.forEach((t) => {
      const d = t.createdAt.toDate()
      const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      const ts = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const existing = dataMap.get(date) || { date, ts, sales: 0, ewallet: 0, total: 0 }
      existing.ewallet += t.profit
      existing.total += t.profit
      dataMap.set(date, existing)
    })

    return Array.from(dataMap.values()).sort((a, b) => a.ts - b.ts)
  }, [sales, ewalletTransactions])

  if (!mounted) {
    return <div className="min-h-[200px] md:min-h-[300px] bg-muted rounded-lg animate-pulse" />
  }

  if (isLoading) {
    return <div className="min-h-[200px] md:min-h-[300px] bg-muted rounded-lg animate-pulse" />
  }

  if (chartData.length === 0) {
    return (
      <div className="min-h-[200px] md:min-h-[300px] flex items-center justify-center text-muted-foreground text-sm">
        No data available for selected date range
      </div>
    )
  }

  return (
    <div className="min-h-[200px] md:min-h-[300px] w-full">
      <ChartContainer config={chartConfig} className="h-[200px] md:h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sales)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-sales)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillEwallet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-ewallet)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-ewallet)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `₱${value}`} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area type="monotone" dataKey="sales" stroke="var(--color-sales)" fill="url(#fillSales)" dot={false} />
            <Area type="monotone" dataKey="ewallet" stroke="var(--color-ewallet)" fill="url(#fillEwallet)" dot={false} />
            <Area type="monotone" dataKey="total" stroke="var(--color-total)" fill="url(#fillTotal)" dot={false} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  )
}
