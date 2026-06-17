import { cn } from '@/lib/utils'

type PageBrandEyebrowProps = {
  className?: string
}

/** Sayfa başlığı üstü marka etiketi — sidebar ile uyumlu FINANCEAI */
export function PageBrandEyebrow({ className }: PageBrandEyebrowProps) {
  return (
    <p
      className={cn(
        'text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400',
        className,
      )}
    >
      <span className="text-primary">FINANCE</span>
      <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent dark:from-primary dark:to-violet-400">
        AI
      </span>
    </p>
  )
}

type PageBrandTitleProps = {
  className?: string
}

/** Giriş gibi tek başlıklı sayfalar için FINANCEAI başlığı */
export function PageBrandTitle({ className }: PageBrandTitleProps) {
  return (
    <h1
      className={cn(
        'text-2xl font-bold tracking-tight text-slate-800 dark:text-white',
        className,
      )}
    >
      FINANCE
      <span className="bg-gradient-to-r from-primary via-violet-500 to-violet-600 bg-clip-text text-transparent">
        AI
      </span>
    </h1>
  )
}
