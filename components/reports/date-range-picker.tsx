"use client"
import { useState } from "react"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { format, subDays, startOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DateRangePickerProps {
  dateRange: { from: Date; to: Date } | undefined
  setDateRange: (range: { from: Date; to: Date } | undefined) => void
}

const currentYear = new Date().getFullYear()

function yearRange(year: number) {
  return { from: startOfYear(new Date(year, 0, 1)), to: year === currentYear ? new Date() : endOfYear(new Date(year, 0, 1)) }
}

const quickPresets = [
  { label: "Today", range: () => { const d = new Date(); d.setHours(0,0,0,0); return { from: d, to: new Date() } } },
  { label: "Yesterday", range: () => { const d = subDays(new Date(), 1); d.setHours(0,0,0,0); const e = new Date(d); e.setHours(23,59,59,999); return { from: d, to: e } } },
  { label: "7 Days", range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "30 Days", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "This Week", range: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: new Date() }) },
  { label: "This Month", range: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: "Last Month", range: () => { const s = startOfMonth(subMonths(new Date(), 1)); return { from: s, to: endOfMonth(s) } } },
  { label: "This Year", range: () => yearRange(currentYear) },
  { label: "Last Year", range: () => yearRange(currentYear - 1) },
  { label: "All Time", range: () => ({ from: new Date(2020, 0, 1), to: new Date() }) },
]

function getLabel(dateRange: { from: Date; to: Date } | undefined): string {
  if (!dateRange) return "Date range"
  const { from, to } = dateRange
  // Full year detection
  const fromYear = from.getFullYear()
  const toYear = to.getFullYear()
  if (fromYear === toYear) {
    const isFullYear = from.getMonth() === 0 && from.getDate() === 1 &&
      (toYear === currentYear || (to.getMonth() === 11 && to.getDate() === 31))
    if (isFullYear) return `Year ${fromYear}`
  }
  // Same year short format
  if (fromYear === toYear) return `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`
  return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`
}

export function DateRangePicker({ dateRange, setDateRange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [yearPickerYear, setYearPickerYear] = useState(currentYear)
  // Generate last 6 years for the year grid
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i)

  const apply = (range: { from: Date; to: Date }) => {
    setDateRange(range)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 text-xs gap-1.5 max-w-[200px]", !dateRange && "text-muted-foreground")}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{getLabel(dateRange)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        {/* Quick presets */}
        <div className="flex flex-wrap gap-1.5 p-3 border-b">
          {quickPresets.map((preset) => (
            <Button
              key={preset.label}
              variant={dateRange && getLabel(dateRange) === (preset.label === "This Year" ? `Year ${currentYear}` : preset.label === "Last Year" ? `Year ${currentYear - 1}` : preset.label) ? "default" : "secondary"}
              size="sm"
              className="text-[11px] h-7 px-2.5 rounded-full"
              onClick={() => apply(preset.range())}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {/* Year grid selector */}
        <div className="p-3 border-b">
          <p className="text-[11px] font-semibold text-muted-foreground mb-2">Select Year</p>
          <div className="grid grid-cols-3 gap-1.5">
            {years.map(year => (
              <Button
                key={year}
                variant={dateRange && getLabel(dateRange) === `Year ${year}` ? "default" : "outline"}
                size="sm"
                className="text-xs h-8"
                onClick={() => apply(yearRange(year))}
              >
                {year}
              </Button>
            ))}
          </div>
        </div>

        {/* Calendar for custom range */}
        <div className="p-1">
          <p className="text-[11px] font-semibold text-muted-foreground px-2 pt-2 pb-1">Custom Range</p>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={{ from: dateRange?.from!, to: dateRange?.to }}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                apply({ from: range.from, to: range.to })
              } else if (range?.from) {
                setDateRange({ from: range.from, to: range.from })
              }
            }}
            numberOfMonths={1}
            disabled={{ after: new Date() }}
          />
        </div>

        {/* Clear */}
        {dateRange && (
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full text-xs h-7 text-muted-foreground" onClick={() => { setDateRange(undefined); setOpen(false) }}>
              Clear filter (show last 30 days)
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
