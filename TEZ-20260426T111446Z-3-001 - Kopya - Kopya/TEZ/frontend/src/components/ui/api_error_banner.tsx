import { AlertCircle } from 'lucide-react'



type ApiErrorBannerProps = {

  message: string

}



export function ApiErrorBanner({ message }: ApiErrorBannerProps) {

  return (

    <div

      role="alert"

      className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"

    >

      <AlertCircle

        className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"

        aria-hidden

      />

      <p className="text-sm leading-relaxed">{message}</p>

    </div>

  )

}

