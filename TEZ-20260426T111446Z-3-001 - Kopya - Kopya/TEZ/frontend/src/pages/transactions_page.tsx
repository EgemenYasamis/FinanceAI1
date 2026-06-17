import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Leaf,
  MapPin,
  Search,
  Shield,
  Store,
  Tag,
} from 'lucide-react'
import { ApiErrorBanner } from '@/components/ui/api_error_banner'
import { useAuth } from '@/contexts/auth_context'
import { defaultDateTimeLocal, hourFromDateTimeLocal } from '@/lib/datetime'
import { analyzeTransaction, getApiErrorMessage, getTransactions } from '@/lib/api'
import { formatCategory } from '@/lib/categories'
import { getCategoryIcon } from '@/lib/category_icons'
import {
  formatCurrencyDetailed,
  formatDateTime,
  formatKarbon,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  inputClassAlt,
  labelText,
  mutedText,
  pageDescription,
  pageEyebrow,
  pageTitleMt,
  panelCard,
  panelCardPrimary,
  sectionTitle,
  tableHeadRow,
  tableRowHover,
} from '@/lib/theme_classes'
import type { IslemAnalizSonuc, IslemGecmisKayit } from '@/types/api'

const glassCardClass = cn(panelCard, 'p-4 shadow-sm dark:shadow-[0_0_24px_rgba(124,58,237,0.08)]')

type AnalysisDisplay = {
  result: IslemAnalizSonuc
  regionLabel: string
}

function AnalysisMiniCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Tag
}) {
  return (
    <div className={glassCardClass}>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
        {label}
      </div>
      <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{value}</p>
    </div>
  )
}

function StatusBar({
  analysis,
  isAnalyzing,
}: {
  analysis: AnalysisDisplay | null
  isAnalyzing: boolean
}) {
  if (isAnalyzing) {
    return (
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700/50">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/60" />
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-500 dark:border-slate-600/40 dark:bg-slate-800/30 dark:text-slate-400">
        Sol taraftan işlem bilgilerini girip Sorgula&apos;ya basın.
      </div>
    )
  }

  const { result } = analysis
  if (result.fraud) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-red-500/35 bg-red-500/10 px-4 py-3',
          'text-sm text-red-200',
        )}
      >
        <AlertTriangle className="size-4 shrink-0 text-red-400" aria-hidden />
        <span>
          <strong className="font-semibold">Şüpheli işlem</strong>
          {' — '}
          {result.fraud_mesaj}
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3',
        'text-sm text-emerald-200',
      )}
    >
      <CheckCircle2 className="size-4 shrink-0 text-emerald-400" aria-hidden />
      <span>
        <strong className="font-semibold">Normal işlem</strong>
        {' — '}
        {result.fraud_mesaj}
      </span>
    </div>
  )
}

const SKELETON_ROW_COUNT = 6

function TransactionsTableSkeleton() {
  return (
    <>
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
        <tr
          key={`skeleton-${index}`}
          className="border-b border-slate-100 dark:border-slate-800/80"
          aria-hidden
        >
          <td className="px-6 py-4">
            <div className="h-4 w-28 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
          </td>
          <td className="px-4 py-4">
            <div className="h-4 w-32 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
          </td>
          <td className="px-4 py-4">
            <div className="h-4 w-24 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
          </td>
          <td className="px-4 py-4">
            <div className="ml-auto h-4 w-20 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
          </td>
          <td className="px-4 py-4">
            <div className="h-4 w-24 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
          </td>
          <td className="px-6 py-4">
            <div className="h-6 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700/60" />
          </td>
        </tr>
      ))}
    </>
  )
}

function getTransactionTimestamp(row: IslemGecmisKayit): string | undefined {
  return row.trans_date_trans_time ?? row.created_at
}

function toDateOnlyKey(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  // Saat/dakika ne olursa olsun yalnızca YYYY-MM-DD kısmını al.
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`
}

function filterTransactions(
  rows: IslemGecmisKayit[],
  filters: {
    merchant: string
    location: string
    tutar: string
    dateTime: string
    applyAmount: boolean
    applyDate: boolean
  },
): IslemGecmisKayit[] {
  const merchantQuery = filters.merchant.trim().toLowerCase()
  const locationQuery = filters.location.trim().toLowerCase()
  const tutarNum = Number(filters.tutar.trim())
  const dateKey = filters.applyDate ? toDateOnlyKey(filters.dateTime) : null

  const hasAnyFilter =
    merchantQuery.length > 0 ||
    locationQuery.length > 0 ||
    (filters.applyAmount && Number.isFinite(tutarNum) && tutarNum > 0) ||
    dateKey != null

  if (!hasAnyFilter) return rows

  return rows.filter((row) => {
    if (merchantQuery.length > 0) {
      const merchantName = (row.merchant ?? '').toLowerCase()
      if (!merchantName.includes(merchantQuery)) return false
    }

    if (locationQuery.length > 0) {
      const district = (row.tr_ilce ?? '').toLowerCase()
      if (!district.includes(locationQuery)) return false
    }

    if (filters.applyAmount && Number.isFinite(tutarNum) && tutarNum > 0) {
      const rowAmount = row.amt ?? 0
      if (Math.abs(rowAmount - tutarNum) > 0.009) return false
    }

    if (dateKey != null) {
      const timestamp = getTransactionTimestamp(row)
      const rowDateKey = toDateOnlyKey(timestamp)
      if (rowDateKey !== dateKey) return false
    }

    return true
  })
}

function CategoryCell({ category }: { category: string | undefined }) {
  const label = formatCategory(category)
  if (label === '—') {
    return <span className="text-slate-500 dark:text-slate-400">—</span>
  }

  const Icon = getCategoryIcon(category)

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon
        className="size-4 shrink-0 text-slate-400 dark:text-slate-500"
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </span>
  )
}

function DurumBadge({ isFraud }: { isFraud: boolean }) {
  if (isFraud) {
    return (
      <span className="inline-flex rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-300">
        Şüpheli
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
      Normal
    </span>
  )
}

export function TransactionsPage() {
  const { userId } = useAuth()

  const [merchant, setMerchant] = useState('')
  const [tutar, setTutar] = useState('100')
  const [dateTime, setDateTime] = useState(defaultDateTimeLocal)
  const [location, setLocation] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [dateTouched, setDateTouched] = useState(false)

  const [analysis, setAnalysis] = useState<AnalysisDisplay | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [transactions, setTransactions] = useState<IslemGecmisKayit[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)

  useEffect(() => {
    if (!userId) return
    const activeUserId = userId

    let cancelled = false

    async function loadHistory() {
      setIsHistoryLoading(true)
      setHistoryError(null)
      try {
        const rows = await getTransactions(activeUserId, 50)
        if (!cancelled) setTransactions(rows ?? [])
      } catch (err) {
        if (!cancelled) {
          setTransactions([])
          setHistoryError(getApiErrorMessage(err))
        }
      } finally {
        if (!cancelled) setIsHistoryLoading(false)
      }
    }

    loadHistory()
    return () => {
      cancelled = true
    }
  }, [userId, historyRefreshKey])

  const filteredTransactions = useMemo(
    () =>
      filterTransactions(transactions, {
        merchant,
        location,
        tutar,
        dateTime,
        applyAmount: amountTouched,
        applyDate: dateTouched,
      }),
    [transactions, merchant, location, tutar, dateTime, amountTouched, dateTouched],
  )

  const hasActiveTableFilter =
    merchant.trim().length > 0 ||
    location.trim().length > 0 ||
    amountTouched ||
    dateTouched

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const trimmedMerchant = merchant.trim()
    const trimmedLocation = location.trim()
    if (!trimmedMerchant) {
      setFormError('Lütfen satıcı adı girin.')
      return
    }
    if (!trimmedLocation) {
      setFormError('Lütfen alışveriş bölgesi girin.')
      return
    }

    const tutarNum = Number(tutar)
    if (!Number.isFinite(tutarNum) || tutarNum <= 0) {
      setFormError('Geçerli bir tutar girin.')
      return
    }
    if (!dateTime.trim()) {
      setFormError('Lütfen işlem tarih/saatini seçin.')
      return
    }
    const saatNum = hourFromDateTimeLocal(dateTime)

    if (!userId) {
      setFormError('Oturum bulunamadı. Lütfen tekrar giriş yapın.')
      return
    }

    setIsAnalyzing(true)

    try {
      const result = await analyzeTransaction({
        user_id: userId,
        merchant: trimmedMerchant,
        tutar: tutarNum,
        saat: saatNum,
        konum: trimmedLocation,
      })
      setAnalysis({
        result,
        regionLabel: result.konum ?? trimmedLocation,
      })
      setHistoryRefreshKey((k) => k + 1)
    } catch (err) {
      setAnalysis(null)
      setFormError(getApiErrorMessage(err))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const kategori = analysis
    ? formatCategory(analysis.result.kategori)
    : '—'
  const karbon = analysis
    ? formatKarbon(analysis.result.karbon_kgco2)
    : '—'
  const bolge = analysis?.regionLabel ?? '—'
  const fraudOlasilik = analysis
    ? `%${analysis.result.fraud_olasilik.toFixed(1)}`
    : '—'

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <header className="mb-8">
        <p className={pageEyebrow}>İşlem Sorgula</p>
        <h1 className={pageTitleMt}>Yapay Zeka Analizi</h1>
        <p className={pageDescription}>
          Yeni işlemleri fraud ve karbon etkisi açısından analiz edin; geçmiş
          hareketlerinizi hesap özeti tablosunda inceleyin.
        </p>
      </header>

      <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className={cn(glassCardClass, 'p-6')}
          noValidate
        >
          <h2 className={cn('mb-5', sectionTitle)}>Sorgu Formu</h2>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="merchant"
                className={cn('mb-1.5 block', labelText)}
              >
                Satıcı adı
              </label>
              <input
                id="merchant"
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="Örn: Migros"
                className={inputClassAlt}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="tutar"
                  className={cn('mb-1.5 block', labelText)}
                >
                  Tutar (₺)
                </label>
                <input
                  id="tutar"
                  type="number"
                  min={1}
                  step={0.01}
                  value={tutar}
                  onChange={(e) => {
                    setAmountTouched(true)
                    setTutar(e.target.value)
                  }}
                  className={inputClassAlt}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="datetime"
                  className={cn('mb-1.5 block', labelText)}
                >
                  Tarih/Saat
                </label>
                <input
                  id="datetime"
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => {
                    setDateTouched(true)
                    setDateTime(e.target.value)
                  }}
                  className={cn(inputClassAlt, 'cursor-pointer')}
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="bolge"
                className={cn('mb-1.5 block', labelText)}
              >
                Alışveriş bölgesi
              </label>
              <input
                id="bolge"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Örn: Halkapınar, Buca Merkez"
                className={inputClassAlt}
                required
              />
            </div>
          </div>

          {formError ? (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isAnalyzing}
            className={cn(
              'mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5',
              'bg-gradient-to-r from-primary to-purple-500 text-sm font-semibold text-white',
              'transition-all duration-200 ease-out',
              'hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(124,58,237,0.45)]',
              'active:scale-[0.98]',
              'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100',
            )}
          >
            <Search className="size-4" aria-hidden />
            {isAnalyzing ? 'Analiz ediliyor…' : 'Sorgula'}
          </button>
        </form>

        <div className={cn(glassCardClass, 'flex flex-col p-6')}>
          <h2 className={cn('mb-5', sectionTitle)}>Analiz Sonucu</h2>

          <div className="grid flex-1 grid-cols-2 gap-3">
            <AnalysisMiniCard label="Kategori" value={kategori} icon={Tag} />
            <AnalysisMiniCard label="Karbon" value={karbon} icon={Leaf} />
            <AnalysisMiniCard label="Bölge" value={bolge} icon={MapPin} />
            <AnalysisMiniCard
              label="Fraud Olasılığı"
              value={fraudOlasilik}
              icon={Shield}
            />
          </div>

          <div className="mt-5 space-y-2">
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700/40">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  analysis?.result.fraud
                    ? 'w-full bg-red-500/70'
                    : analysis
                      ? 'w-full bg-emerald-500/70'
                      : 'w-0 bg-primary/50',
                )}
              />
            </div>
            <StatusBar analysis={analysis} isAnalyzing={isAnalyzing} />
          </div>
        </div>
      </section>

      <section className={cn(panelCardPrimary, 'overflow-hidden')}>
        <div className="border-b border-slate-200 px-6 py-5 dark:border-primary/15">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary dark:bg-primary/20">
              <Store className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className={sectionTitle}>Hesap Özeti</h2>
              <p className={mutedText}>
                {hasActiveTableFilter
                  ? `${filteredTransactions.length} / ${transactions.length} işlem gösteriliyor`
                  : 'Geçmiş işlem hareketleri'}
              </p>
            </div>
          </div>
        </div>

        {historyError ? (
          <div className="p-6">
            <ApiErrorBanner message={historyError} />
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className={cn(tableHeadRow, 'bg-slate-50 dark:bg-[#0f172a]/60')}>
                <th className="px-6 py-3.5 font-medium">Tarih/Saat</th>
                <th className="px-4 py-3.5 font-medium">Satıcı</th>
                <th className="px-4 py-3.5 font-medium">Kategori</th>
                <th className="px-4 py-3.5 text-right font-medium">Tutar</th>
                <th className="px-4 py-3.5 font-medium">Karbon Etkisi</th>
                <th className="px-6 py-3.5 font-medium">Durum</th>
              </tr>
            </thead>
            <tbody>
              {isHistoryLoading ? (
                <TransactionsTableSkeleton />
              ) : transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    Henüz kayıtlı işlem bulunamadı.
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    Form kriterlerine uygun işlem bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((row, index) => {
                  const isFraud = Boolean(row.is_fraud)
                  const amt = row.amt ?? 0
                  const karbonVal = row.karbon_kgco2 ?? 0
                  const timestamp = getTransactionTimestamp(row)
                  const rowKey =
                    row.id != null
                      ? String(row.id)
                      : `${timestamp ?? ''}-${row.merchant ?? ''}-${index}`

                  return (
                    <tr
                      key={rowKey}
                      className={cn('border-b border-slate-100 dark:border-slate-800/80', tableRowHover)}
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-slate-600 dark:text-slate-300">
                        {formatDateTime(timestamp)}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-4 font-medium text-slate-800 dark:text-white">
                        {row.merchant ?? '—'}
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        <CategoryCell category={row.category} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-medium text-slate-800 dark:text-white">
                        {formatCurrencyDetailed(amt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-600 dark:text-slate-300">
                        {karbonVal > 0 ? formatKarbon(karbonVal) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <DurumBadge isFraud={isFraud} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
