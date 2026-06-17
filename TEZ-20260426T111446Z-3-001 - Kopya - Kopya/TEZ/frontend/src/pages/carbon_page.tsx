import { useEffect, useMemo, useState } from 'react'
import { Info, Leaf } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ApiErrorBanner } from '@/components/ui/api_error_banner'
import { ChartSkeleton, PieChartSkeleton } from '@/components/ui/chart_skeleton'
import { useAuth } from '@/contexts/auth_context'
import { formatCategory } from '@/lib/categories'
import { getApiErrorMessage, getTransactions } from '@/lib/api'
import { formatKarbon, formatTrendPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  pageDescription,
  pageEyebrow,
  pageTitleMt,
  panelCard,
  progressTrack,
  sectionTitle,
  tableHeadRow,
  tableRowHover,
} from '@/lib/theme_classes'
import type { IslemGecmisKayit } from '@/types/api'
import { useTheme } from '@/hooks/use_theme'

type MetricVariant = 'danger' | 'default' | 'positive'

type CarbonMetric = {
  title: string
  value: string
  subtitle: string
  variant: MetricVariant
}

type CategoryCo2 = {
  name: string
  kg: number
  percent: number
  gradient: string
}

const glassCard = cn(panelCard, 'rounded-2xl p-5')

const CATEGORY_GRADIENTS = [
  'from-purple-500 via-fuchsia-500 to-pink-500',
  'from-teal-400 via-cyan-400 to-teal-500',
  'from-yellow-400 via-lime-400 to-green-500',
  'from-emerald-500 via-green-500 to-teal-600',
  'from-orange-400 via-amber-400 to-yellow-500',
  'from-slate-600 via-slate-500 to-slate-600',
]

const PIE_COLORS = ['#2dd4bf', '#14b8a6', '#10b981', '#06b6d4', '#22c55e', '#84cc16', '#a3e635', '#64748b']

const TR_MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

const METRIC_VARIANT_STYLES: Record<
  MetricVariant,
  { card: string; value: string; subtitle: string }
> = {
  danger: {
    card: 'border-red-200 dark:border-red-500/30',
    value: 'text-slate-800 dark:text-white',
    subtitle: 'text-red-500 dark:text-red-400',
  },
  default: {
    card: 'border-slate-200 dark:border-white/5',
    value: 'text-slate-800 dark:text-white',
    subtitle: 'text-slate-500 dark:text-slate-400',
  },
  positive: {
    card: 'border-teal-200 dark:border-teal-500/30',
    value: 'text-teal-600 dark:text-teal-400',
    subtitle: 'text-teal-600 dark:text-teal-400',
  },
}

function getTransactionDate(row: IslemGecmisKayit): Date | null {
  const raw = row.trans_date_trans_time ?? row.created_at
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function getCarbonKg(row: IslemGecmisKayit): number {
  const value = row.karbon_kgco2
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return key
  return `${TR_MONTH_SHORT[month - 1] ?? key} ${String(year).slice(-2)}`
}

function emissionLevelLabel(kg: number): { label: string; variant: MetricVariant } {
  if (kg >= 2500) return { label: 'YÜKSEK', variant: 'danger' }
  if (kg >= 800) return { label: 'ORTA', variant: 'default' }
  return { label: 'DÜŞÜK', variant: 'positive' }
}

function computeCarbonStats(transactions: IslemGecmisKayit[]) {
  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth()
  const lastMonthDate = new Date(thisYear, thisMonth - 1, 1)
  const lastYear = lastMonthDate.getFullYear()
  const lastMonth = lastMonthDate.getMonth()

  let thisMonthTotal = 0
  let lastMonthTotal = 0
  let allTimeTotal = 0

  const categoryMap = new Map<string, number>()
  const monthlyMap = new Map<string, number>()

  for (const row of transactions) {
    const carbon = getCarbonKg(row)
    if (carbon <= 0) continue

    allTimeTotal += carbon

    const date = getTransactionDate(row)
    if (date) {
      if (date.getFullYear() === thisYear && date.getMonth() === thisMonth) {
        thisMonthTotal += carbon
      }
      if (date.getFullYear() === lastYear && date.getMonth() === lastMonth) {
        lastMonthTotal += carbon
      }
      const key = monthKey(date)
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + carbon)
    }

    const category = row.category?.trim() || 'diger'
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + carbon)
  }

  const monthChangePct =
    lastMonthTotal > 0
      ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
      : thisMonthTotal > 0
        ? 100
        : 0

  const monthlyTrend = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, co2]) => ({
      name: formatMonthLabel(key),
      co2: Math.round(co2 * 100) / 100,
    }))

  const categoryTotal = [...categoryMap.values()].reduce((sum, v) => sum + v, 0)
  const categories: CategoryCo2[] = [...categoryMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([category, kg], index) => ({
      name: formatCategory(category),
      kg: Math.round(kg * 100) / 100,
      percent: categoryTotal > 0 ? Math.round((kg / categoryTotal) * 100) : 0,
      gradient: CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length],
    }))

  const pieData = categories.map((c) => ({
    name: c.name,
    value: c.kg,
  }))

  const topCarbon = [...transactions]
    .filter((row) => getCarbonKg(row) > 0)
    .sort((a, b) => getCarbonKg(b) - getCarbonKg(a))
    .slice(0, 8)

  return {
    thisMonthTotal,
    lastMonthTotal,
    allTimeTotal,
    monthChangePct,
    monthlyTrend,
    categories,
    pieData,
    topCarbon,
  }
}

function MetricCard({ metric }: { metric: CarbonMetric }) {
  const styles = METRIC_VARIANT_STYLES[metric.variant]

  return (
    <div className={cn(glassCard, styles.card)}>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{metric.title}</p>
      <p className={cn('mt-2 text-3xl font-bold tabular-nums tracking-tight', styles.value)}>
        {metric.value}
      </p>
      <p className={cn('mt-1 text-xs font-medium uppercase tracking-wide', styles.subtitle)}>
        {metric.subtitle}
      </p>
    </div>
  )
}

function MetricCardSkeleton() {
  return (
    <div className={cn(glassCard, 'border-slate-200 dark:border-white/5')} aria-hidden>
      <div className="h-4 w-24 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
      <div className="mt-3 h-9 w-32 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
      <div className="mt-2 h-3 w-20 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
    </div>
  )
}

function CategoryBarSkeleton() {
  return (
    <li className="space-y-2" aria-hidden>
      <div className="flex justify-between">
        <div className="h-4 w-28 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
        <div className="h-4 w-10 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
      </div>
      <div className={cn('h-1.5', progressTrack)}>
        <div className="h-full w-2/3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700/60" />
      </div>
    </li>
  )
}

function ActivityRowSkeleton() {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800/80" aria-hidden>
      <td className="px-4 py-3">
        <div className="h-4 w-32 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-24 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
      </td>
      <td className="px-4 py-3">
        <div className="ml-auto h-4 w-20 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
      </td>
    </tr>
  )
}

function CarbonTrendChart({ data }: { data: Array<{ name: string; co2: number }> }) {
  const { isDark } = useTheme()
  const dotFill = isDark ? '#0f172a' : '#ffffff'

  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Aylık karbon trendi için henüz yeterli veri yok.
      </div>
    )
  }

  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickFormatter={(v) => (typeof v === 'number' ? v.toLocaleString('tr-TR') : v)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(45,212,191,0.3)',
              borderRadius: '0.75rem',
              color: '#e2e8f0',
            }}
            formatter={(value) => [
              typeof value === 'number'
                ? `${value.toLocaleString('tr-TR')} kg CO₂`
                : value,
              'Salınım',
            ]}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Line
            type="monotone"
            dataKey="co2"
            stroke="#2dd4bf"
            strokeWidth={2.5}
            dot={{
              r: 5,
              fill: dotFill,
              stroke: '#2dd4bf',
              strokeWidth: 2.5,
            }}
            activeDot={{
              r: 7,
              fill: '#2dd4bf',
              stroke: dotFill,
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function CarbonCategoryPieChart({
  data,
}: {
  data: Array<{ name: string; value: number }>
}) {
  if (!data.length) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Kategori dağılımı için veri yok.
      </div>
    )
  }

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={78}
            paddingAngle={2}
          >
            {data.map((_, index) => (
              <Cell key={`carbon-slice-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(45,212,191,0.3)',
              borderRadius: '0.75rem',
              color: '#e2e8f0',
            }}
            formatter={(value) => [
              typeof value === 'number'
                ? `${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} kg CO₂`
                : value,
              'Karbon',
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function CarbonCategoryBarChart({
  data,
}: {
  data: Array<{ name: string; kg: number }>
}) {
  if (!data.length) {
    return null
  }

  return (
    <div className="mt-4 h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(45,212,191,0.3)',
              borderRadius: '0.75rem',
              color: '#e2e8f0',
            }}
            formatter={(value) => [
              typeof value === 'number'
                ? `${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} kg CO₂`
                : value,
              'Toplam',
            ]}
          />
          <Bar dataKey="kg" fill="#2dd4bf" radius={[0, 6, 6, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CarbonPage() {
  const { userId } = useAuth()
  const [transactions, setTransactions] = useState<IslemGecmisKayit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    const activeUserId = userId
    let cancelled = false

    async function loadCarbonData() {
      setIsLoading(true)
      setError(null)
      try {
        const rows = await getTransactions(activeUserId, 100)
        if (!cancelled) setTransactions(rows ?? [])
      } catch (err) {
        if (!cancelled) {
          setTransactions([])
          setError(getApiErrorMessage(err))
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadCarbonData()
    return () => {
      cancelled = true
    }
  }, [userId])

  const stats = useMemo(() => computeCarbonStats(transactions), [transactions])

  const emissionLevel = emissionLevelLabel(stats.thisMonthTotal)

  const metrics: CarbonMetric[] = useMemo(() => {
    const trendVariant: MetricVariant =
      stats.monthChangePct > 0 ? 'danger' : stats.monthChangePct < 0 ? 'positive' : 'default'
    const trendSubtitle =
      stats.monthChangePct > 0
        ? 'artış var'
        : stats.monthChangePct < 0
          ? 'azalış var'
          : 'değişim yok'

    return [
      {
        title: 'Bu Ayki Toplam Salınım',
        value: stats.thisMonthTotal.toLocaleString('tr-TR', { maximumFractionDigits: 0 }),
        subtitle: `kg CO₂ • ${emissionLevel.label}`,
        variant: emissionLevel.variant,
      },
      {
        title: 'Toplam CO₂',
        value: stats.allTimeTotal.toLocaleString('tr-TR', { maximumFractionDigits: 0 }),
        subtitle: 'kg CO₂ (tüm işlemler)',
        variant: 'default',
      },
      {
        title: 'Geçen aya göre',
        value: formatTrendPercent(stats.monthChangePct),
        subtitle: trendSubtitle,
        variant: trendVariant,
      },
    ]
  }, [stats, emissionLevel])

  const barChartData = stats.categories.map((c) => ({ name: c.name, kg: c.kg }))

  const tipMessage =
    stats.categories.length > 0
      ? `${stats.categories[0].name} kategorisi toplam salınımın %${stats.categories[0].percent}'ini oluşturuyor — bu alanda harcamayı azaltmayı deneyin`
      : 'İşlem ekledikçe karbon ayak iziniz burada görünecek'

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <header className="mb-8">
        <p className={pageEyebrow}>Sürdürülebilirlik</p>
        <h1 className={pageTitleMt}>Karbon Ayak İzi</h1>
        <p className={pageDescription}>
          Harcama kategorilerine göre karbon emisyonlarınızı takip edin ve azaltma
          önerilerini inceleyin.
        </p>
      </header>

      {error ? (
        <div className="mb-6">
          <ApiErrorBanner message={error} />
        </div>
      ) : null}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }, (_, i) => <MetricCardSkeleton key={`metric-skel-${i}`} />)
          : metrics.map((metric) => <MetricCard key={metric.title} metric={metric} />)}
      </section>

      <section
        className={cn(
          'mb-8 flex items-center gap-3 rounded-xl border border-teal-200',
          'bg-teal-50 px-4 py-3.5',
          'dark:border-teal-500/30 dark:bg-teal-500/5 dark:backdrop-blur-sm',
        )}
        role="status"
      >
        <Info className="size-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
        <p className="text-sm font-medium text-teal-700 dark:text-teal-400">{tipMessage}</p>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_0.85fr]">
        <div className={glassCard}>
          <h2 className={cn('mb-4', sectionTitle)}>Aylık CO₂ trendi</h2>
          {isLoading ? <ChartSkeleton /> : <CarbonTrendChart data={stats.monthlyTrend} />}
        </div>

        <div className={glassCard}>
          <h2 className={cn('mb-5', sectionTitle)}>Kategoriye Göre Karbon Dağılımı</h2>
          {isLoading ? (
            <>
              <PieChartSkeleton className="h-52" />
              <ul className="mt-5 space-y-5">
                {Array.from({ length: 4 }, (_, i) => (
                  <CategoryBarSkeleton key={`cat-skel-${i}`} />
                ))}
              </ul>
            </>
          ) : (
            <>
              <CarbonCategoryPieChart data={stats.pieData} />
              <ul className="mt-5 space-y-5">
                {stats.categories.length === 0 ? (
                  <li className="text-sm text-slate-500 dark:text-slate-400">
                    Henüz karbon verisi içeren işlem yok.
                  </li>
                ) : (
                  stats.categories.map((cat) => (
                    <li key={cat.name}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {cat.name}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                          %{cat.percent} · {cat.kg.toLocaleString('tr-TR')} kg
                        </span>
                      </div>
                      <div className={cn('h-1.5', progressTrack)}>
                        <div
                          className={cn(
                            'h-full rounded-full bg-gradient-to-r transition-all duration-500',
                            cat.gradient,
                          )}
                          style={{ width: `${cat.percent}%` }}
                          role="progressbar"
                          aria-valuenow={cat.percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${cat.name} — %${cat.percent}`}
                        />
                      </div>
                    </li>
                  ))
                )}
              </ul>
              <CarbonCategoryBarChart data={barChartData} />
            </>
          )}
        </div>
      </section>

      <section className={glassCard}>
        <div className="mb-4 flex items-center gap-2">
          <Leaf className="size-5 text-teal-500 dark:text-teal-400" aria-hidden />
          <h2 className={sectionTitle}>En Çok Karbon Üreten İşlemler</h2>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/50">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className={tableHeadRow}>
                <th className="px-4 py-3 font-medium">Satıcı</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 text-right font-medium">Karbon Skoru</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <ActivityRowSkeleton key={`act-skel-${i}`} />
                ))
              ) : stats.topCarbon.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    Karbon skoru olan işlem bulunamadı.
                  </td>
                </tr>
              ) : (
                stats.topCarbon.map((row, index) => (
                  <tr
                    key={row.id ?? `${row.merchant}-${index}`}
                    className={tableRowHover}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                      {row.merchant?.trim() || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatCategory(row.category)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-teal-600 dark:text-teal-400">
                      {formatKarbon(getCarbonKg(row))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
