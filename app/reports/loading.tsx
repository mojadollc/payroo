export default function Loading() {
  return (
    <div className="min-h-screen bg-background p-4 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="h-7 w-32 bg-muted rounded animate-pulse" />
        <div className="h-9 w-28 bg-muted rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-muted/30 p-4 space-y-2 animate-pulse">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-6 w-28 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-muted/30 h-48 animate-pulse" />
    </div>
  )
}
