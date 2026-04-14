export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2" />
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Search bar skeleton */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="flex gap-2">
                <div className="h-10 flex-1 bg-muted rounded animate-pulse" />
                <div className="h-10 w-10 bg-muted rounded animate-pulse" />
                <div className="h-10 w-16 bg-muted rounded animate-pulse" />
              </div>
            </div>
            {/* Product grid skeleton */}
            <div className="border rounded-lg p-3">
              <div className="h-4 w-32 bg-muted rounded animate-pulse mb-3" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="border rounded-lg overflow-hidden">
                    <div className="aspect-square bg-muted animate-pulse" />
                    <div className="p-2 space-y-1">
                      <div className="h-3 w-full bg-muted rounded animate-pulse" />
                      <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Cart skeleton */}
          <div className="lg:col-span-1">
            <div className="border rounded-lg p-3">
              <div className="h-5 w-24 bg-muted rounded animate-pulse mb-4" />
              <div className="py-12 flex flex-col items-center">
                <div className="h-12 w-12 bg-muted rounded-full animate-pulse mb-4" />
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
