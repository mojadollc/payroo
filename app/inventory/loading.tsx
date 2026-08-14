function S({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className ?? ""}`} />
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-background p-4 space-y-4">
      {/* Mobile stats grid */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="p-3 border rounded-xl space-y-2">
            <div className="flex items-center gap-1.5"><S className="w-7 h-7 rounded-md" /><S className="w-16 h-3" /></div>
            <S className="w-20 h-5" />
          </div>
        ))}
      </div>

      {/* Mobile filter + search */}
      <div className="md:hidden space-y-3">
        <S className="w-full h-12 rounded-xl" />
        <S className="w-full h-12 rounded-xl" />
      </div>

      {/* Mobile product grid */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-xl overflow-hidden">
            <S className="w-full h-28 rounded-none" />
            <div className="p-3 space-y-2">
              <S className="w-3/4 h-3.5" /><S className="w-16 h-5" /><S className="w-24 h-3" />
              <div className="flex gap-1">{[1,2,3,4].map(j => <S key={j} className="h-8 w-8" />)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop stats */}
      <div className="hidden md:grid grid-cols-4 gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between"><S className="h-8 w-8" /><div className="space-y-1"><S className="h-5 w-20" /><S className="h-3 w-16" /></div></div>
            <S className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Desktop tabs + grid */}
      <div className="hidden md:block space-y-4">
        <div className="grid grid-cols-4 bg-gray-100 p-1 rounded-lg gap-1">
          {[1,2,3,4].map(i => <S key={i} className="h-9 rounded-md" />)}
        </div>
        <div className="flex items-center justify-between gap-4">
          <S className="h-9 flex-1 max-w-sm" />
          <div className="flex gap-1"><S className="h-9 w-9" /><S className="h-9 w-9" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="rounded-lg border overflow-hidden">
              <S className="w-full h-28 sm:h-32 rounded-none" />
              <div className="p-2 space-y-2">
                <S className="w-3/4 h-3" /><S className="w-16 h-4" /><S className="w-20 h-3" />
                <div className="flex gap-1">{[1,2,3,4].map(j => <S key={j} className="h-7 w-7" />)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
