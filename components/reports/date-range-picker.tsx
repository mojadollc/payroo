"use client"
import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { format, subDays, startOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DateRangePickerProps {
  dateRange: { from: Date; to: Date } | undefined
  setDateRange: (range: { from: Date; to: Date } | undefined) => void
}

const presets = [
  { label: "Today", range: () => { const d = new Date(); d.setHours(0,0,0,0); return { from: d, to: new Date() } } },
  { label: "Yesterday", range: () => { const d = subDays(new Date(), 1); d.setHours(0,0,0,0); const e = new Date(d); e.setHours(23,59,59,999); return { from: d, to: e } } },
  { label: "7 Days", range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "30 Days", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "This Week", range: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: new Date() }) },
  { label: "This Month", range: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: "Last Month", range: () => { const s = startOfMonth(subMonths(new Date(), 1)); return { from: s, to: endOfMonth(s) } } },
]

export function DateRangePicker({ dateRange, setDateRange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  const applyPreset = (preset: typeof presets[0]) => {
    setDateRange(preset.range())
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 text-xs gap-1.5 max-w-[180px]", !dateRange && "text-muted-foreground")}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          {dateRange?.from ? (
            <span className="truncate">
              {format(dateRange.from, "MMM d")} – {format(dateRange.to, "MMM d")}
            </span>
          ) : (
            <span>Date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        {/* Quick presets */}
        <div className="flex flex-wrap gap-1.5 p-3 border-b">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant="secondary"
              size="sm"
              className="text-[11px] h-7 px-2.5 rounded-full"
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        {/* Calendar */}
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={dateRange?.from}
          selected={{
            from: dateRange?.from!,
            to: dateRange?.to,
          }}
          onSelect={(range) => {
            if (range?.from && range?.to) {
              setDateRange({ from: range.from, to: range.to })
              setOpen(false)
            } else if (range?.from) {
              setDateRange({ from: range.from, to: range.from })
            }
          }}
          numberOfMonths={1}
          disabled={{ after: new Date() }}
        />
      </PopoverContent>
    </Popover>
  )
}
