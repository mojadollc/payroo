"use client"

export function DefaultProductImage({ className = "" }: { className?: string }) {
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center bg-gray-100 gap-1 ${className}`}>
      <svg viewBox="0 0 64 64" className="w-10 h-10 opacity-40">
        {/* Basket icon */}
        <path d="M8 24h48l-4 28H12L8 24z" fill="#9ca3af" />
        <path d="M8 24l8-14h32l8 14" fill="none" stroke="#6b7280" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 24h48" fill="none" stroke="#6b7280" strokeWidth="3" strokeLinecap="round" />
        <circle cx="24" cy="56" r="3" fill="#6b7280" />
        <circle cx="40" cy="56" r="3" fill="#6b7280" />
        <path d="M24 32v14M32 32v14M40 32v14" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-[10px] font-bold text-gray-400 tracking-wide">Payroo</span>
    </div>
  )
}
