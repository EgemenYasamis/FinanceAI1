import { cn } from '@/lib/utils'

type ChartSkeletonProps = {
  className?: string
}

export function ChartSkeleton({ className }: ChartSkeletonProps) {
  return (
    <div
      className={cn(
        'flex h-64 w-full animate-pulse flex-col justify-end gap-2 rounded-lg',
        'bg-slate-100/80 p-4 dark:bg-slate-800/40',
        className,
      )}
      aria-hidden
    >
      <div className="flex h-full items-end justify-between gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="w-full rounded-t-md bg-slate-200 dark:bg-slate-700/60"
            style={{ height: `${35 + (index % 3) * 18}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function PieChartSkeleton({ className }: ChartSkeletonProps) {
  return (
    <div
      className={cn(
        'flex h-64 w-full animate-pulse items-center justify-center',
        className,
      )}
      aria-hidden
    >
      <div className="size-44 rounded-full bg-slate-200 dark:bg-slate-700/60" />
    </div>
  )
}
