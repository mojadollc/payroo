function S({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className ?? ""}`} />
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-background p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="space-y-1"><S className="h-6 w-28" /><S className="h-3 w-20" /></div>
        <div className="flex gap-2"><S className="h-9 w-16" /><S className="h-9 w-16" /></div>
      </div>

      {/* Mobile stats strip */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="shrink-0 bg-white border border-gray-100 rounded-2xl px-3.5 py-2.5 shadow-sm min-w-[120px] space-y-2">
            <div className="flex items-center gap-1.5"><S className="w-6 h-6 rounded-md" /><S className="w-16 h-3" /></div>
            <S className="w-20 h-4" />
          </div>
        ))}
      </div>

      {/* Mobile search */}
      <div className="md:hidden flex gap-2">
        <S className="flex-1 h-10 rounded-xl" />
        <S className="w-28 h-10 rounded-xl" />
      </div>

      {/* Mobile product rows */}
      <div className="md:hidden space-y-2">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center gap-3 px-3 py-2.5">
            <S className="shrink-0 w-14 h-14 rounded-xl" />
            <div className="flex-1 space-y-2"><S className="w-3/4 h-3.5" /><S className="w-1/2 h-3" /></div>
            <div className="shrink-0 flex flex-col gap-1">{[1,2,3,4].map(j => <S key={j} className="w-7 h-7 rounded-lg" />)}</div>
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
            <div key={i} className="rounded-lg border overflow-hidden bg-card">
              <S className="w-full h-28 sm:h-32 rounded-none" />
              <div className="p-2 space-y-2">
                <S className="w-3/4 h-3" /><S className="w-16 h-4" /><S className="w-20 h-3" />
                <div className="flex gap-1">{[1,2,3,4].map(j => <S key={j} className="h-7 w-7" />)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAB placeholder */}
      <div className="md:hidden fixed bottom-6 right-4">
        <S className="w-14 h-14 rounded-full" />
      </div>
    </div>
  )
}
