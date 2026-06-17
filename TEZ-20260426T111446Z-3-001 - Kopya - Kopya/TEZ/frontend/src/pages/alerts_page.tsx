import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Loader2,
  Save,
  Shield,
  X,
} from 'lucide-react'
import { ApiErrorBanner } from '@/components/ui/api_error_banner'
import { useAuth } from '@/contexts/auth_context'
import {
  CATEGORY_OPTIONS,
  formatCategory,
} from '@/lib/categories'
import {
  getApiErrorMessage,
  getBudget,
  getTransactions,
  setBudget,
} from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ButceVeri, IslemGecmisKayit } from '@/types/api'
import {
  inputClass,
  mutedText,
  pageDescription,
  pageEyebrow,
  pageTitleMt,
  panelCard,
  panelCardLg,
  sectionTitle,
} from '@/lib/theme_classes'

const metricCardBase = cn(panelCard, 'p-5')

const GENEL_KATEGORI = 'genel'

type AlertSeverity = 'critical' | 'warning'

type DynamicAlert = {
  id: string
  severity: AlertSeverity
  title: string
  subtitle: string
  icon: 'shield' | 'triangle' | 'bell'
}

function spendingForBudget(
  budget: ButceVeri,
  category: string,
): number {
  if (category === GENEL_KATEGORI) {
    return budget.bu_ay_toplam_harcama
  }
  return budget.kategori_harcamalari[category] ?? 0
}

function buildDynamicAlerts(
  budget: ButceVeri | null,
  transactions: IslemGecmisKayit[],
): {
  critical: DynamicAlert[]
  warning: DynamicAlert[]
  normalCount: number
} {
  const critical: DynamicAlert[] = []
  const warning: DynamicAlert[] = []
  let normalCount = 0

  if (budget?.butceler?.length) {
    for (const hedef of budget.butceler) {
      const limit = hedef.limit_tutar
      if (limit <= 0) continue

      const harcama = spendingForBudget(budget, hedef.category)
      const kullanimYuzde = (harcama / limit) * 100
      const kategoriLabel =
        hedef.category === GENEL_KATEGORI
          ? 'Genel bütçe'
          : formatCategory(hedef.category)

      if (kullanimYuzde >= 100) {
        critical.push({
          id: `budget-${hedef.category}-critical`,
          severity: 'critical',
          title: `${kategoriLabel} limiti aşıldı`,
          subtitle: `Bu ay ${formatCurrency(harcama)} / ${formatCurrency(limit)} (%${kullanimYuzde.toFixed(0)} kullanım)`,
          icon: 'triangle',
        })
      } else if (kullanimYuzde >= 80) {
        warning.push({
          id: `budget-${hedef.category}-warning`,
          severity: 'warning',
          title: `${kategoriLabel} limitine yaklaşıyorsunuz`,
          subtitle: `Bu ay ${formatCurrency(harcama)} / ${formatCurrency(limit)} (%${kullanimYuzde.toFixed(0)} kullanım)`,
          icon: 'bell',
        })
      } else {
        normalCount += 1
      }
    }
  }

  for (const tx of transactions) {
    if (!tx.is_fraud) continue
    const merchant = tx.merchant?.trim() || 'Bilinmeyen satıcı'
    const tutar = tx.amt ?? 0
    critical.push({
      id: `fraud-${tx.id ?? `${merchant}-${tutar}`}`,
      severity: 'critical',
      title: `Şüpheli İşlem Tespit Edildi: ${merchant} - ${formatCurrency(tutar)}`,
      subtitle: tx.trans_date_trans_time
        ? `İşlem tarihi: ${new Date(tx.trans_date_trans_time).toLocaleString('tr-TR')}`
        : 'Fraud risk analizi işaretledi',
      icon: 'shield',
    })
  }

  return { critical, warning, normalCount }
}

function SuccessToast({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-xl',
        'border-emerald-500/40 bg-emerald-50 text-emerald-900',
        'animate-[slideUp_0.35s_ease-out] dark:border-emerald-500/30 dark:bg-emerald-950/90 dark:text-emerald-100',
        'dark:shadow-[0_0_32px_rgba(16,185,129,0.25)]',
      )}
    >
      <CheckCircle2
        className="mt-0.5 size-5 shrink-0 text-emerald-500 dark:text-emerald-400"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Bütçe Kaydedildi</p>
        <p className="mt-0.5 text-xs text-emerald-800/90 dark:text-emerald-200/90">
          {message}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-300"
        aria-label="Bildirimi kapat"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}

function AlertListItem({ alert }: { alert: DynamicAlert }) {
  const isCritical = alert.severity === 'critical'
  const Icon =
    alert.icon === 'shield'
      ? Shield
      : alert.icon === 'bell'
        ? Bell
        : AlertTriangle

  const iconColor = isCritical
    ? alert.icon === 'shield'
      ? 'text-red-500 dark:text-red-400'
      : 'text-red-500 dark:text-red-400'
    : 'text-amber-500 dark:text-yellow-400'

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-slate-200',
        'bg-white px-4 py-4 shadow-sm transition-colors duration-150',
        'hover:bg-slate-50',
        'dark:border-slate-700/40 dark:bg-card-dark/30 dark:backdrop-blur-sm dark:shadow-none',
        'dark:hover:bg-white/5',
        isCritical ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-yellow-500',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          'bg-white/60 dark:bg-white/5',
          isCritical ? 'bg-red-500/10 dark:bg-red-500/15' : 'bg-amber-500/10 dark:bg-yellow-500/15',
        )}
      >
        <Icon className={cn('size-5', iconColor)} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-800 dark:text-white">{alert.title}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{alert.subtitle}</p>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  count,
  variant,
}: {
  label: string
  count: number
  variant: 'critical' | 'warning' | 'normal'
}) {
  const styles = {
    critical: {
      border: 'border-red-200 dark:border-red-500/30',
      text: 'text-red-600 dark:text-red-400',
      glow: 'shadow-sm dark:shadow-[0_0_20px_rgba(239,68,68,0.08)]',
    },
    warning: {
      border: 'border-amber-200 dark:border-yellow-500/30',
      text: 'text-amber-600 dark:text-yellow-400',
      glow: 'shadow-sm dark:shadow-[0_0_20px_rgba(234,179,8,0.08)]',
    },
    normal: {
      border: 'border-emerald-200 dark:border-green-500/30',
      text: 'text-emerald-600 dark:text-green-400',
      glow: 'shadow-sm dark:shadow-[0_0_20px_rgba(34,197,94,0.08)]',
    },
  }[variant]

  return (
    <div className={cn(metricCardBase, styles.border, styles.glow)}>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn('mt-2 text-4xl font-bold tabular-nums', styles.text)}>{count}</p>
    </div>
  )
}

export function AlertsPage() {
  const { userId } = useAuth()
  const [budget, setBudgetData] = useState<ButceVeri | null>(null)
  const [transactions, setTransactions] = useState<IslemGecmisKayit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [category, setCategory] = useState(GENEL_KATEGORI)
  const [limit, setLimit] = useState('')
  const [budgetError, setBudgetError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const loadData = useCallback(async (activeUserId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const [budgetData, txData] = await Promise.all([
        getBudget(activeUserId),
        getTransactions(activeUserId, 500),
      ])
      setBudgetData(budgetData)
      setTransactions(txData)

      const mevcutGenel = budgetData.butceler.find((b) => b.category === GENEL_KATEGORI)
      if (mevcutGenel) {
        setLimit(String(mevcutGenel.limit_tutar))
      }
    } catch (err) {
      setBudgetData(null)
      setTransactions([])
      setError(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    loadData(userId)
  }, [userId, loadData])

  useEffect(() => {
    if (!toastMessage) return undefined
    const timer = window.setTimeout(() => setToastMessage(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

  const { critical, warning, normalCount } = useMemo(
    () => buildDynamicAlerts(budget, transactions),
    [budget, transactions],
  )

  async function handleBudgetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBudgetError(null)

    const limitNum = Number(limit)
    if (!Number.isFinite(limitNum) || limitNum <= 0) {
      setBudgetError('Geçerli bir limit girin.')
      return
    }

    if (!userId) {
      setBudgetError('Oturum bulunamadı. Lütfen tekrar giriş yapın.')
      return
    }

    setIsSaving(true)
    try {
      const sonuc = await setBudget(userId, limitNum, category || GENEL_KATEGORI)
      setToastMessage(sonuc.mesaj)
      await loadData(userId)
    } catch (err) {
      setBudgetError(getApiErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const aktifButce = budget?.butceler.find((b) => b.category === category)

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      {toastMessage ? (
        <SuccessToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      ) : null}

      <header className="mb-8">
        <p className={pageEyebrow}>Uyarılar</p>
        <h1 className={pageTitleMt}>Harcama Uyarıları</h1>
        <p className={pageDescription}>
          Bütçe limitinize ve işlem geçmişinize göre gerçek zamanlı uyarılar;
          limit aşımı ve şüpheli işlemler burada listelenir.
        </p>
      </header>

      {error ? <ApiErrorBanner message={error} /> : null}

      {isLoading ? (
        <p className={cn('mb-8 flex items-center justify-center gap-2', mutedText)}>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Uyarılar yükleniyor…
        </p>
      ) : null}

      {!isLoading && budget && budget.butceler.length === 0 ? (
        <p
          className={cn(
            'mb-8 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm',
            'text-slate-500 dark:border-slate-700/50 dark:bg-card-dark/40 dark:text-slate-400 dark:shadow-none',
          )}
        >
          Henüz bütçe belirlemediniz. Aşağıdaki formdan limit tanımlayın; harcamalarınız
          bu limite göre izlenecektir.
        </p>
      ) : null}

      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Kritik uyarı" count={critical.length} variant="critical" />
        <MetricCard label="Dikkat" count={warning.length} variant="warning" />
        <MetricCard label="Normal" count={normalCount} variant="normal" />
      </section>

      {!isLoading ? (
        <section className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h2 className={cn('mb-4 flex items-center gap-2', sectionTitle)}>
              <AlertTriangle className="size-5 text-red-500 dark:text-red-400" aria-hidden />
              Kritik Uyarılar
            </h2>
            <div className="space-y-3">
              {critical.length === 0 ? (
                <p
                  className={cn(
                    'rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm shadow-sm',
                    'text-slate-500 dark:border-slate-700/40 dark:bg-card-dark/20 dark:shadow-none',
                  )}
                >
                  Kritik uyarı bulunmuyor.
                </p>
              ) : (
                critical.map((alert) => <AlertListItem key={alert.id} alert={alert} />)
              )}
            </div>
          </div>

          <div>
            <h2 className={cn('mb-4 flex items-center gap-2', sectionTitle)}>
              <Bell className="size-5 text-amber-500 dark:text-yellow-400" aria-hidden />
              Dikkat Edilmesi Gerekenler
            </h2>
            <div className="space-y-3">
              {warning.length === 0 ? (
                <p
                  className={cn(
                    'rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm shadow-sm',
                    'text-slate-500 dark:border-slate-700/40 dark:bg-card-dark/20 dark:shadow-none',
                  )}
                >
                  Dikkat gerektiren uyarı bulunmuyor.
                </p>
              ) : (
                warning.map((alert) => <AlertListItem key={alert.id} alert={alert} />)
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className={cn(panelCardLg, 'p-6')}>
        <h2 className={cn('mb-2', sectionTitle)}>Bütçe Belirle</h2>
        {budget && !isLoading ? (
          <p className={cn('mb-5', mutedText)}>
            Bu ay toplam harcama:{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {formatCurrency(budget.bu_ay_toplam_harcama)}
            </span>
            {aktifButce ? (
              <>
                {' '}
                · Seçili limit: {formatCurrency(aktifButce.limit_tutar)}
              </>
            ) : null}
          </p>
        ) : null}

        <form
          onSubmit={handleBudgetSubmit}
          className="flex flex-col gap-4 lg:flex-row lg:items-end"
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="budget-category" className="sr-only">
              Kategori seç
            </label>
            <select
              id="budget-category"
              value={category}
              onChange={(e) => {
                const next = e.target.value
                setCategory(next)
                const mevcut = budget?.butceler.find((b) => b.category === next)
                setLimit(mevcut ? String(mevcut.limit_tutar) : '')
              }}
              className={cn(inputClass, 'w-full cursor-pointer')}
            >
              <option value={GENEL_KATEGORI}>Genel (Tüm harcamalar)</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full lg:w-48">
            <label htmlFor="budget-limit" className="sr-only">
              Limit gir
            </label>
            <input
              id="budget-limit"
              type="number"
              min={1}
              step={1}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="₺ Limit gir"
              className={cn(inputClass, 'w-full')}
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className={cn(
              'flex shrink-0 items-center justify-center gap-2 rounded-xl px-8 py-2.5',
              'bg-gradient-to-r from-primary to-purple-500 text-sm font-semibold text-white',
              'transition-all duration-200 ease-out',
              'hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(124,58,237,0.4)]',
              'active:scale-[0.98]',
              'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100',
              'lg:min-w-[140px]',
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Kaydediliyor…
              </>
            ) : (
              <>
                <Save className="size-4" aria-hidden />
                Kaydet
              </>
            )}
          </button>
        </form>

        {budgetError ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {budgetError}
          </p>
        ) : null}
      </section>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
