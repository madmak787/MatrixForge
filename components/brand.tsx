import { cn } from '@/lib/utils'

/** The ◈ mark on a dark tile; the one place the theme glows */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'brand-mark flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/12 font-mono text-sm font-bold text-primary',
        className,
      )}
      aria-hidden
    >
      <span className="glow-text">◈</span>
    </span>
  )
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark />
      <span className="text-[15px] font-semibold tracking-tight">
        Matrix<span className="text-primary">Forge</span>
      </span>
    </span>
  )
}
