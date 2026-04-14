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
  { label: "Last 7 Days", range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "Last 30 Days", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
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
          className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateRange?.from ? (
            dateRange.to ? (
              <>
                {format(dateRange.from, "MMM dd")} – {format(dateRange.to, "MMM dd, yyyy")}
              </>
            ) : (
              format(dateRange.from, "MMM dd, yyyy")
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex flex-col sm:flex-row">
          {/* Presets sidebar */}
          <div className="flex sm:flex-col gap-1 p-3 border-b sm:border-b-0 sm:border-r flex-wrap">
            <p className="hidden sm:block text-xs font-semibold text-muted-foreground mb-1">Quick Select</p>
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start text-xs h-8 px-2 sm:px-3"
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          {/* Calendar */}
          <div>
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
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
