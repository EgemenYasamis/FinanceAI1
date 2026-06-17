import { cn } from '@/lib/utils'

/** Cam / panel kart — light: beyaz; dark: mevcut koyu cam */
export const panelCard = cn(
  'rounded-xl border border-slate-200 bg-white shadow-md',
  'dark:border-white/5 dark:bg-[#0f172a] dark:shadow-[0_0_24px_rgba(0,0,0,0.2)] dark:backdrop-blur-md',
)

export const panelCardLg = cn(
  'rounded-2xl border border-slate-200 bg-white shadow-md',
  'dark:border-slate-700/50 dark:bg-card-dark/40 dark:shadow-[0_0_24px_rgba(0,0,0,0.2)] dark:backdrop-blur-md',
)

export const panelCardPrimary = cn(
  'rounded-2xl border border-slate-200 bg-white shadow-md',
  'dark:border-primary/20 dark:bg-card-dark/30 dark:backdrop-blur-md dark:shadow-lg',
)

export const pageEyebrow = 'text-sm font-medium uppercase tracking-wider text-primary'

export const pageTitle = 'text-3xl font-bold text-slate-800 dark:text-white sm:text-4xl'

export const pageTitleMt = 'mt-2 text-3xl font-bold text-slate-800 dark:text-white sm:text-4xl'

export const pageTitleMtSm = 'mt-1 text-3xl font-bold text-slate-800 dark:text-white sm:text-4xl'

export const pageDescription = 'mt-2 max-w-2xl text-slate-500 dark:text-slate-400'

export const sectionTitle = 'text-lg font-semibold text-slate-800 dark:text-white'

export const labelText = 'text-sm font-medium text-slate-600 dark:text-slate-300'

export const mutedText = 'text-sm text-slate-500 dark:text-slate-400'

export const inputClass = cn(
  'rounded-xl border border-slate-200 bg-white px-3 py-2.5',
  'text-sm text-slate-800 placeholder:text-slate-400',
  'outline-none transition-colors duration-200',
  'focus:border-primary focus:ring-2 focus:ring-primary/20',
  'dark:border-slate-700/80 dark:bg-[#020617] dark:text-white dark:placeholder:text-slate-500',
)

export const inputClassAlt = cn(
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5',
  'text-sm text-slate-800 placeholder:text-slate-400',
  'outline-none transition-colors duration-200',
  'focus:border-primary focus:ring-2 focus:ring-primary/20',
  'dark:border-slate-700/80 dark:bg-[#0f172a] dark:text-white dark:placeholder:text-slate-500',
)

export const tableHeadRow = cn(
  'border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500',
  'dark:border-slate-700/60 dark:text-slate-400',
)

export const tableRowHover = cn(
  'transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-white/5',
)

export const tableDivide = 'divide-y divide-slate-200 dark:divide-slate-700/40'

export const progressTrack = 'overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800/80'
