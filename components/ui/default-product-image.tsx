"use client"

export function DefaultProductImage({ className = "" }: { className?: string }) {
  return (
    <div className={`flex h-full w-full items-center justify-center bg-gray-100 ${className}`}>
      <svg viewBox="0 0 120 80" className="w-3/4 max-w-[120px] opacity-40">
        {/* Payroo logo circle */}
        <circle cx="60" cy="32" r="18" fill="#9ca3af" />
        <text x="60" y="38" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#f3f4f6" fontFamily="Arial, sans-serif">P</text>
        {/* Brand text */}
        <text x="60" y="60" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#9ca3af" fontFamily="Arial, sans-serif">Payroo</text>
        <text x="60" y="73" textAnchor="middle" fontSize="8" fill="#d1d5db" fontFamily="Arial, sans-serif">No Image</text>
      </svg>
    </div>
  )
}
