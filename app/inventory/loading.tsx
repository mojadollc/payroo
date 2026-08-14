export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile View Skeleton */}
      <div className="md:hidden space-y-3 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="h-6 w-32 bg-muted rounded animate-pulse mb-1" />
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-16 bg-muted rounded animate-pulse" />
            <div className="h-9 w-16 bg-muted rounded animate-pulse" />
          </div>
        </div>

        {/* Stats Strip */}
        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="shrink-0 bg-white border border-gray-100 rounded-2xl px-3.5 py-2.5 shadow-sm min-w-[120px] space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 bg-muted rounded-md animate-pulse" />
                <div className="w-16 h-3 bg-muted rounded animate-pulse" />
              </div>
              <div className="w-20 h-4 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 bg-muted rounded animate-pulse" />
            <div className="h-10 w-full bg-muted rounded-xl animate-pulse pl-9" />
          </div>
          <div className="h-10 w-28 bg-muted rounded-xl animate-pulse" />
        </div>

        {/* Product List Skeleton */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center gap-3 px-3 py-2.5">
              <div className="shrink-0 w-14 h-14 bg-muted rounded-xl animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="w-3/4 h-3.5 bg-muted rounded animate-pulse" />
                <div className="w-1/2 h-3 bg-muted rounded animate-pulse" />
              </div>
              <div className="shrink-0 flex flex-col gap-1">
                {[1, 2, 3, 4].map(j => <div key={j} className="w-7 h-7 bg-muted rounded-lg animate-pulse" />)}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Skeleton */}
        <div className="flex items-center justify-center gap-1 pt-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="px-2.5 py-1 w-8 h-8 bg-muted rounded border animate-pulse" />
          ))}
        </div>
      </div>

      {/* Desktop View Skeleton */}
      <div className="hidden md:block space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-8 w-40 bg-muted rounded animate-pulse mb-1" />
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 bg-muted rounded animate-pulse" />
            <div className="h-9 w-20 bg-muted rounded animate-pulse" />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                <div className="text-right">
                  <div className="h-6 w-20 bg-muted rounded animate-pulse mb-1" />
                  <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                </div>
              </div>
              <div className="h-3 w-32 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="space-y-6">
          <div className="grid w-full grid-cols-4 bg-gray-100 p-1 rounded-lg gap-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-9 bg-muted rounded animate-pulse" />
            ))}
          </div>

          {/* Search and View Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <div className="absolute left-2 top-2.5 w-4 h-4 bg-muted rounded animate-pulse" />
              <div className="h-9 w-full bg-muted rounded animate-pulse pl-8" />
            </div>
            <div className="flex items-center border rounded-md">
              <div className="h-9 w-9 bg-muted rounded-none rounded-l-md animate-pulse" />
              <div className="h-9 w-9 bg-muted rounded-none rounded-r-md animate-pulse" />
            </div>
          </div>

          {/* Product Grid Skeleton */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="rounded-lg border overflow-hidden bg-card">
                <div className="relative w-full h-28 sm:h-32 bg-muted animate-pulse" />
                <div className="p-2 space-y-2">
                  <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                    <div className="h-5 w-10 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(j => (
                      <div key={j} className="h-7 w-7 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-1 pt-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="px-2.5 py-1 w-8 h-8 bg-muted rounded border animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      {/* Floating Button Skeleton */}
      <div className="md:hidden fixed bottom-6 right-6">
        <div className="h-12 w-12 bg-muted rounded-full animate-pulse" />
      </div>
    </div>
  )
}
