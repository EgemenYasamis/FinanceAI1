import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import { panelCard } from '@/lib/theme_classes'



type StatCardProps = {

  title: string

  value: string

  icon: LucideIcon

  trend?: string

  className?: string

  valueClassName?: string

  iconClassName?: string

  badge?: string

  isLoading?: boolean

}



function StatCardSkeleton() {

  return (

    <div className="animate-pulse space-y-3">

      <div className="h-3 w-24 rounded-md bg-slate-200 dark:bg-slate-600/60" />

      <div className="h-8 w-32 rounded-md bg-slate-200 dark:bg-slate-600/80" />

      <div className="h-3 w-20 rounded-md bg-slate-100 dark:bg-slate-600/50" />

    </div>

  )

}



export function StatCard({

  title,

  value,

  icon: Icon,

  trend,

  className,

  valueClassName,

  iconClassName,

  badge,

  isLoading = false,

}: StatCardProps) {

  return (

    <article className={cn(panelCard, 'relative p-5', className)}>

      {badge && !isLoading ? (

        <span

          className={cn(

            'absolute right-5 top-5 rounded-full border border-red-500/30',

            'bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',

            'text-red-600 dark:text-red-400',

          )}

        >

          {badge}

        </span>

      ) : null}

      <div className="flex items-start justify-between gap-3">

        <div className="min-w-0 flex-1">

          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>

          {isLoading ? (

            <div className="mt-2">

              <StatCardSkeleton />

            </div>

          ) : (

            <>

              <p

                className={cn(

                  'mt-1 text-2xl font-semibold text-slate-800 dark:text-white',

                  valueClassName,

                )}

              >

                {value}

              </p>

              {trend ? (

                <p

                  className={cn(

                    'mt-2 text-xs',

                    valueClassName

                      ? 'text-red-500/90 dark:text-red-400/90'

                      : 'text-emerald-600 dark:text-emerald-400',

                  )}

                >

                  {trend}

                </p>

              ) : null}

            </>

          )}

        </div>

        <span

          className={cn(

            'rounded-lg bg-primary/15 p-2.5 text-primary dark:bg-primary/20',

            isLoading && 'opacity-50',

            iconClassName,

          )}

        >

          <Icon className="size-5" aria-hidden />

        </span>

      </div>

    </article>

  )

}

