'use client'

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in duration-300 slide-in-from-bottom-4">
      {children}
    </div>
  )
}
