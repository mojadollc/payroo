"use client"
import { useState, useEffect } from "react"
import { CalendarIcon, X, ChevronDown } from "lucide-react"
import { format, subDays, startOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DateRangePickerProps {
  dateRange: { from: Date; to: Date }
  setDateRange: (range: { from: Date; to: Date }) => void
}

const currentYear = new Date().getFullYear()
const YEARS = [2025, 2026]

function yearRange(year: number) {
  return {
    from: startOfYear(new Date(year, 0, 1)),
    to: year === currentYear ? new Date() : endOfYear(new Date(year, 0, 1)),
  }
}

const PRESETS = [
  { label: "Today",      range: () => { const d = new Date(); d.setHours(0,0,0,0); return { from: d, to: new Date() } } },
  { label: "Yesterday",  range: () => { const d = subDays(new Date(),1); d.setHours(0,0,0,0); const e=new Date(d); e.setHours(23,59,59,999); return { from:d, to:e } } },
  { label: "7 Days",     range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "30 Days",    range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "This Week",  range: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: new Date() }) },
  { label: "This Month", range: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: "Last Month", range: () => { const s = startOfMonth(subMonths(new Date(),1)); return { from: s, to: endOfMonth(s) } } },
  { label: "All Time",   range: () => ({ from: new Date(2020, 0, 1), to: new Date() }) },
]

function getLabel(dr: { from: Date; to: Date }): string {
  const { from, to } = dr
  const fy = from.getFullYear(), ty = to.getFullYear()
  if (fy === ty) {
    const isFullYear = from.getMonth() === 0 && from.getDate() === 1 &&
      (ty === currentYear || (to.getMonth() === 11 && to.getDate() === 31))
    if (isFullYear) return `${fy}`
  }
  if (fy === ty) return `${format(from,"MMM d")} – ${format(to,"MMM d")}`
  return `${format(from,"MMM d, yy")} – ${format(to,"MMM d, yy")}`
}

function isActivePreset(label: string, dr: { from: Date; to: Date }): boolean {
  const r = PRESETS.find(p => p.label === label)?.range()
  if (!r) return false
  return Math.abs(r.from.getTime() - dr.from.getTime()) < 60000 &&
         Math.abs(r.to.getTime() - dr.to.getTime()) < 60000
}

export function DateRangePicker({ dateRange, setDateRange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const fn = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", fn)
    return () => window.removeEventListener("resize", fn)
  }, [])

  const apply = (range: { from: Date; to: Date }) => {
    setDateRange(range)
    setOpen(false)
  }

  const activeYear = YEARS.find(y => {
    const r = yearRange(y)
    return Math.abs(r.from.getTime() - dateRange.from.getTime()) < 60000
  })

  const pickerContent = (
    <div className={cn("flex flex-col", isMobile ? "w-full" : "w-[300px]")}>
      {/* Years */}
      <div className="p-3 border-b">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Year</p>
        <div className="grid grid-cols-2 gap-2">
          {YEARS.map(year => (
            <button
              key={year}
              onClick={() => apply(yearRange(year))}
              className={cn(
                "h-10 rounded-xl text-sm font-bold border transition-colors",
                activeYear === year
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-foreground border-transparent hover:border-primary/40"
              )}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Quick presets */}
      <div className="p-3 border-b">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Quick Select</p>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => apply(p.range())}
              className={cn(
                "h-9 rounded-xl text-xs font-semibold border transition-colors px-2",
                isActivePreset(p.label, dateRange)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-foreground border-transparent hover:border-primary/40"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom calendar */}
      <div className="p-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-1">Custom Range</p>
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={dateRange.from}
          selected={{ from: dateRange.from, to: dateRange.to }}
          onSelect={(range) => {
            if (range?.from && range?.to) apply({ from: range.from, to: range.to })
            else if (range?.from) setDateRange({ from: range.from, to: range.from })
          }}
          numberOfMonths={1}
          disabled={{ after: new Date() }}
          className="p-0"
        />
      </div>

      {/* Reset */}
      <div className="p-2 pt-0">
        <button
          onClick={() => apply(PRESETS[2].range())}
          className="w-full h-9 rounded-xl text-xs font-semibold text-muted-foreground bg-muted/40 hover:bg-muted transition-colors"
        >
          Reset to 7 Days
        </button>
      </div>
    </div>
  )

  // Mobile: bottom sheet
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          <span>{getLabel(dateRange)}</span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>

        {open && (
          <div className="fixed inset-0 z-[70]">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <span className="font-bold text-sm">Date Range</span>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-full bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {pickerContent}
              <div className="h-8" />
            </div>
          </div>
        )}
      </>
    )
  }

  // Desktop: popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm"
          className="h-9 text-xs gap-1.5 bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          <span>{getLabel(dateRange)}</span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        {pickerContent}
      </PopoverContent>
    </Popover>
  )
}
