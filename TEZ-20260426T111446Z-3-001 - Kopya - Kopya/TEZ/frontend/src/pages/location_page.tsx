import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, MapPin, ShieldAlert } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ApiErrorBanner } from '@/components/ui/api_error_banner'
import { ChartSkeleton } from '@/components/ui/chart_skeleton'
import { useAuth } from '@/contexts/auth_context'
import { formatCategory } from '@/lib/categories'
import { getApiErrorMessage, getTransactions } from '@/lib/api'
import { formatCurrency, formatCurrencyDetailed } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  pageEyebrow,
  pageTitleMtSm,
  panelCard,
  panelCardLg,
  progressTrack,
  sectionTitle,
  tableDivide,
  tableHeadRow,
  tableRowHover,
} from '@/lib/theme_classes'
import type { IslemGecmisKayit } from '@/types/api'

type PointColor = 'pink' | 'purple' | 'cyan' | 'yellow' | 'red'

type MapPoint = {
  id: string
  label: string
  transactions: number
  spending: number
  color: PointColor
  top: string
  left: string
  isRisky: boolean
}

type RegionRow = {
  name: string
  transactionCount: number
  totalSpending: number
  fraudCount: number
  topCategory: string
  color: PointColor
  isRisky: boolean
}

const POINT_COLORS: PointColor[] = ['pink', 'purple', 'cyan', 'yellow']

const POINT_STYLES: Record<
  PointColor,
  { dot: string; glow: string; badge: string; legend: string }
> = {
  pink: {
    dot: 'bg-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.6)]',
    glow: 'bg-pink-500/25',
    badge: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    legend: 'bg-pink-500',
  },
  purple: {
    dot: 'bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.6)]',
    glow: 'bg-purple-500/25',
    badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    legend: 'bg-purple-500',
  },
  cyan: {
    dot: 'bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]',
    glow: 'bg-cyan-400/25',
    badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    legend: 'bg-cyan-400',
  },
  yellow: {
    dot: 'bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]',
    glow: 'bg-yellow-400/25',
    badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    legend: 'bg-yellow-400',
  },
  red: {
    dot: 'bg-red-500 shadow-[0_0_22px_rgba(239,68,68,0.75)]',
    glow: 'bg-red-500/30',
    badge: 'bg-red-500/20 text-red-300 border-red-500/40',
    legend: 'bg-red-500',
  },
}

const BAR_FILL_DEFAULT = '#7c3aed'
const BAR_FILL_RISKY = '#ef4444'

const glassCard = cn(panelCard, 'rounded-2xl p-5')

function getLocationKey(row: IslemGecmisKayit): string {
  const konum = row.tr_ilce?.toLowerCase().trim()
  return konum || 'belirtilmeyen'
}

function capitalizeLocation(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1))
    .join(' ')
}

function getAmount(row: IslemGecmisKayit): number {
  const amt = row.amt
  return typeof amt === 'number' && Number.isFinite(amt) ? amt : 0
}

function isFraudRow(row: IslemGecmisKayit): boolean {
  return Boolean(row.is_fraud)
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-ğüşıöç]/gi, '')
}

function computeMapPosition(index: number, total: number): { top: string; left: string } {
  if (total <= 0) return { top: '50%', left: '50%' }
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2
  const radiusX = 32
  const radiusY = 26
  const left = 50 + radiusX * Math.cos(angle)
  const top = 50 + radiusY * Math.sin(angle)
  return { top: `${top}%`, left: `${left}%` }
}

function resolveTopCategory(categoryTotals: Map<string, number>): string {
  let top = ''
  let max = 0
  for (const [category, total] of categoryTotals) {
    if (total > max) {
      max = total
      top = category
    }
  }
  return top ? formatCategory(top) : '—'
}

function computeLocationStats(transactions: IslemGecmisKayit[]) {
  const regionMap = new Map<
    string,
    {
      transactionCount: number
      totalSpending: number
      fraudCount: number
      categoryTotals: Map<string, number>
    }
  >()

  let totalFraud = 0

  for (const row of transactions) {
    const name = getLocationKey(row)
    const spending = getAmount(row)
    const fraud = isFraudRow(row)
    if (fraud) totalFraud += 1

    const existing = regionMap.get(name) ?? {
      transactionCount: 0,
      totalSpending: 0,
      fraudCount: 0,
      categoryTotals: new Map<string, number>(),
    }

    existing.transactionCount += 1
    existing.totalSpending += spending
    if (fraud) existing.fraudCount += 1

    const category = row.category?.trim() || 'diger'
    existing.categoryTotals.set(
      category,
      (existing.categoryTotals.get(category) ?? 0) + spending,
    )

    regionMap.set(name, existing)
  }

  const regions: RegionRow[] = [...regionMap.entries()]
    .map(([name, data], index) => {
      const isRisky = data.fraudCount > 0
      return {
        name: capitalizeLocation(name),
        transactionCount: data.transactionCount,
        totalSpending: Math.round(data.totalSpending * 100) / 100,
        fraudCount: data.fraudCount,
        topCategory: resolveTopCategory(data.categoryTotals),
        color: isRisky ? 'red' : POINT_COLORS[index % POINT_COLORS.length],
        isRisky,
      }
    })
    .sort((a, b) => b.totalSpending - a.totalSpending)

  const topForMap = regions.filter((r) => r.name !== 'Belirtilmeyen').slice(0, 6)
  const mapPoints: MapPoint[] = topForMap.map((region, index) => {
    const pos = computeMapPosition(index, topForMap.length)
    return {
      id: slugify(region.name),
      label: region.name,
      transactions: region.transactionCount,
      spending: region.totalSpending,
      color: region.color,
      top: pos.top,
      left: pos.left,
      isRisky: region.isRisky,
    }
  })

  const barChartData = regions.slice(0, 10).map((r) => ({
    name: r.name.length > 14 ? `${r.name.slice(0, 12)}…` : r.name,
    fullName: r.name,
    harcama: r.totalSpending,
    isRisky: r.isRisky,
    fraudCount: r.fraudCount,
  }))

  const riskyRegions = regions.filter((r) => r.isRisky)
  const topPopular = regions.slice(0, 5)

  return {
    regions,
    mapPoints,
    barChartData,
    riskyRegions,
    topPopular,
    totalFraud,
    regionCount: regions.length,
  }
}

function formatCompactAmount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}M ₺`
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K ₺`
  }
  return formatCurrency(value)
}

function GlowingMapPoint({ point }: { point: MapPoint }) {
  const styles = POINT_STYLES[point.color]

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ top: point.top, left: point.left }}
      title={`${point.label} — ${point.transactions} işlem · ${formatCurrency(point.spending)}`}
    >
      <span
        className={cn(
          'absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md',
          styles.glow,
        )}
        aria-hidden
      />
      <span
        className={cn(
          'relative block size-3 rounded-full ring-2',
          point.isRisky ? 'ring-red-400/60' : 'ring-white/20',
          styles.dot,
        )}
        aria-hidden
      />
      {point.isRisky ? (
        <span
          className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white"
          aria-label="Riskli bölge"
        >
          !
        </span>
      ) : null}
    </div>
  )
}

function TopoMapBackground() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]"
      viewBox="0 0 800 400"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M0 120 Q120 80 200 130 T400 100 T600 140 T800 90"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        className="text-primary/60"
      />
      <path
        d="M0 200 Q150 160 280 210 T520 180 T800 220"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
        className="text-cyan-400/50"
      />
      <path
        d="M0 280 Q100 250 220 300 T480 270 T800 310"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
        className="text-purple-400/40"
      />
      <path
        d="M80 0 Q140 100 100 200 T120 400"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        className="text-slate-400/30"
      />
      <path
        d="M320 0 Q360 120 340 240 T360 400"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        className="text-slate-400/25"
      />
      <path
        d="M560 0 Q600 140 580 260 T620 400"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        className="text-slate-400/25"
      />
      <circle cx="200" cy="130" r="2" fill="currentColor" className="text-primary/30" />
      <circle cx="520" cy="180" r="2" fill="currentColor" className="text-cyan-400/30" />
      <circle cx="400" cy="100" r="1.5" fill="currentColor" className="text-purple-400/25" />
    </svg>
  )
}

function MapLegend({
  mapPoints,
  riskyCount,
}: {
  mapPoints: MapPoint[]
  riskyCount: number
}) {
  return (
    <div
      className={cn(
        'absolute left-4 top-4 z-10 max-w-[17rem] rounded-xl border border-slate-200/80',
        'bg-white/90 p-3 backdrop-blur-md',
        'shadow-md dark:border-white/10 dark:bg-white/5',
        'dark:shadow-[0_0_24px_rgba(0,0,0,0.35)]',
      )}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Lejant
      </p>
      <ul className="space-y-2">
        {mapPoints.slice(0, 3).map((point) => {
          const styles = POINT_STYLES[point.color]
          return (
            <li
              key={point.id}
              className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
            >
              <span
                className={cn('size-2.5 shrink-0 rounded-full', styles.legend)}
                aria-hidden
              />
              <span className="truncate">
                {point.label} ({point.transactions} işlem)
              </span>
            </li>
          )
        })}
        {riskyCount > 0 ? (
          <li className="flex items-center gap-2 text-xs text-red-400">
            <span className="size-2.5 shrink-0 rounded-full bg-red-500" aria-hidden />
            <span>Kırmızı: riskli bölge ({riskyCount})</span>
          </li>
        ) : null}
        <li className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="size-2.5 shrink-0 rounded-full bg-cyan-400" aria-hidden />
          <span>Diğer aktif bölgeler</span>
        </li>
      </ul>
    </div>
  )
}

function SummaryCardSkeleton() {
  return (
    <div className={cn(glassCard, 'border-slate-200 dark:border-white/5')} aria-hidden>
      <div className="h-4 w-28 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
      <div className="mt-3 h-8 w-20 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
    </div>
  )
}

function TableRowSkeleton() {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800/80" aria-hidden>
      <td className="py-3.5 pr-4">
        <div className="h-4 w-28 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
      </td>
      <td className="py-3.5 pr-4">
        <div className="h-4 w-16 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700/60" />
      </td>
      <td className="py-3.5">
        <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700/60" />
      </td>
    </tr>
  )
}

function RegionSpendingBarChart({
  data,
}: {
  data: Array<{
    name: string
    fullName: string
    harcama: number
    isRisky: boolean
    fraudCount: number
  }>
}) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Bölgesel harcama verisi henüz yok.
      </div>
    )
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 48 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            angle={-28}
            textAnchor="end"
            height={56}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={(v) =>
              typeof v === 'number' ? formatCompactAmount(v) : String(v)
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(124,58,237,0.35)',
              borderRadius: '0.75rem',
              color: '#e2e8f0',
            }}
            labelFormatter={(_, payload) => {
              const item = payload?.[0]?.payload as { fullName?: string } | undefined
              return item?.fullName ?? ''
            }}
            formatter={(value, _name, item) => {
              const row = item.payload as { fraudCount?: number; isRisky?: boolean }
              const harcama =
                typeof value === 'number'
                  ? formatCurrencyDetailed(value)
                  : String(value)
              const fraudNote =
                row.isRisky && row.fraudCount
                  ? ` · ${row.fraudCount} şüpheli işlem`
                  : ''
              return [`${harcama}${fraudNote}`, 'Harcama']
            }}
          />
          <Bar dataKey="harcama" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {data.map((entry, index) => (
              <Cell
                key={`bar-${index}`}
                fill={entry.isRisky ? BAR_FILL_RISKY : BAR_FILL_DEFAULT}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LocationPage() {
  const { userId } = useAuth()
  const [transactions, setTransactions] = useState<IslemGecmisKayit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    const activeUserId = userId
    let cancelled = false

    async function loadLocationData() {
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

    loadLocationData()
    return () => {
      cancelled = true
    }
  }, [userId])

  const stats = useMemo(() => computeLocationStats(transactions), [transactions])

  const topRegionName = stats.regions[0]?.name ?? '—'

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <header className="mb-6">
        <p className={pageEyebrow}>Coğrafi Analiz</p>
        <h1 className={pageTitleMtSm}>Konum Analizi</h1>
        <p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-400">
          İşlemlerinizi konum bazında gruplayarak harcama dağılımını ve riskli
          bölgeleri gerçek verilerle inceleyin.
        </p>
      </header>

      {error ? (
        <div className="mb-6">
          <ApiErrorBanner message={error} />
        </div>
      ) : null}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }, (_, i) => (
            <SummaryCardSkeleton key={`sum-skel-${i}`} />
          ))
        ) : (
          <>
            <div className={glassCard}>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Aktif Bölge
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-800 dark:text-white">
                {stats.regionCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                farklı konum
              </p>
            </div>
            <div className={cn(glassCard, 'border-red-200 dark:border-red-500/30')}>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Şüpheli İşlem
              </p>
              <p className="mt-2 text-2xl font-bold text-red-500 dark:text-red-400">
                {stats.totalFraud}
              </p>
              <p className="mt-1 text-xs text-red-500/80 dark:text-red-400/80">
                toplam fraud bayrağı
              </p>
            </div>
            <div className={glassCard}>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                En Aktif Bölge
              </p>
              <p className="mt-2 truncate text-2xl font-bold text-primary">
                {topRegionName}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                en yüksek harcama
              </p>
            </div>
          </>
        )}
      </section>

      <section
        className={cn(
          'relative mb-8 min-h-[22rem] overflow-hidden rounded-2xl border border-slate-200',
          'bg-[#0a0f1c] shadow-md',
          'dark:border-primary/20 dark:shadow-[inset_0_0_60px_rgba(124,58,237,0.08)]',
          'sm:min-h-[26rem] lg:min-h-[28rem]',
        )}
        aria-label="Harita görselleştirmesi"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-cyan-500/5" />
        <TopoMapBackground />
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, rgba(236,72,153,0.15) 0%, transparent 40%), radial-gradient(circle at 70% 25%, rgba(168,85,247,0.12) 0%, transparent 35%), radial-gradient(circle at 50% 70%, rgba(34,211,238,0.08) 0%, transparent 45%)',
          }}
          aria-hidden
        />
        {!isLoading ? (
          <MapLegend
            mapPoints={stats.mapPoints}
            riskyCount={stats.riskyRegions.length}
          />
        ) : null}
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-16 animate-pulse rounded-full bg-slate-700/40" aria-hidden />
          </div>
        ) : stats.mapPoints.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-500">
            Haritada gösterilecek konum verisi yok.
          </div>
        ) : (
          stats.mapPoints.map((point) => <GlowingMapPoint key={point.id} point={point} />)
        )}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 text-xs text-slate-500">
          <MapPin className="size-3.5 text-primary/60" aria-hidden />
          <span>
            {isLoading
              ? 'Veriler yükleniyor…'
              : `${stats.mapPoints.length} bölge · canlı veri`}
          </span>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div className={cn(panelCardLg, 'p-5')}>
          <h2 className={cn('mb-4', sectionTitle)}>Bölgelere Göre Harcama Dağılımı</h2>
          {isLoading ? <ChartSkeleton className="h-72" /> : (
            <RegionSpendingBarChart data={stats.barChartData} />
          )}
        </div>

        <div
          className={cn(
            panelCardLg,
            'p-5',
            stats.riskyRegions.length > 0 &&
              'border-red-200 dark:border-red-500/35',
          )}
        >
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert
              className={cn(
                'size-5',
                stats.riskyRegions.length > 0
                  ? 'text-red-500'
                  : 'text-emerald-500',
              )}
              aria-hidden
            />
            <h2 className={sectionTitle}>Riskli Bölgeler</h2>
          </div>
          {isLoading ? (
            <ul className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <li
                  key={`risk-skel-${i}`}
                  className="h-14 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700/50"
                  aria-hidden
                />
              ))}
            </ul>
          ) : stats.riskyRegions.length === 0 ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              Şüpheli işlem içeren bölge tespit edilmedi.
            </p>
          ) : (
            <ul className="space-y-3">
              {stats.riskyRegions.map((region) => (
                <li
                  key={region.name}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border border-red-500/35',
                    'bg-red-500/10 px-4 py-3',
                  )}
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-red-400"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-red-700 dark:text-red-200">
                      {region.name}
                    </p>
                    <p className="mt-0.5 text-xs text-red-600/90 dark:text-red-300/90">
                      {region.fraudCount} şüpheli işlem ·{' '}
                      {formatCurrency(region.totalSpending)} toplam harcama
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={cn(panelCardLg, 'p-5')}>
          <h2 className={cn('mb-4', sectionTitle)}>Bölge Bazlı Analiz</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] text-left text-sm">
              <thead>
                <tr className={tableHeadRow}>
                  <th className="pb-3 pr-4 font-medium">Bölge</th>
                  <th className="pb-3 pr-4 font-medium">İşlem</th>
                  <th className="pb-3 pr-4 font-medium">Harcama</th>
                  <th className="pb-3 font-medium">En çok</th>
                </tr>
              </thead>
              <tbody className={tableDivide}>
                {isLoading ? (
                  Array.from({ length: 5 }, (_, i) => (
                    <TableRowSkeleton key={`region-skel-${i}`} />
                  ))
                ) : stats.regions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      Bölge verisi bulunamadı.
                    </td>
                  </tr>
                ) : (
                  stats.regions.slice(0, 8).map((row) => {
                    const styles = POINT_STYLES[row.color]
                    return (
                      <tr
                        key={row.name}
                        className={cn(
                          tableRowHover,
                          row.isRisky && 'bg-red-500/5 dark:bg-red-500/5',
                        )}
                      >
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                'size-2.5 shrink-0 rounded-full',
                                styles.legend,
                                row.isRisky &&
                                  'shadow-[0_0_12px_rgba(239,68,68,0.55)]',
                              )}
                              aria-hidden
                            />
                            <span
                              className={cn(
                                'font-medium',
                                row.isRisky
                                  ? 'text-red-300'
                                  : 'text-slate-800 dark:text-white',
                              )}
                            >
                              {row.name}
                              {row.isRisky ? (
                                <span className="ml-1.5 text-[10px] font-semibold uppercase text-red-400">
                                  Risk
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 pr-4 tabular-nums text-slate-600 dark:text-slate-300">
                          {row.transactionCount}
                        </td>
                        <td className="py-3.5 pr-4 tabular-nums text-slate-600 dark:text-slate-300">
                          {formatCompactAmount(row.totalSpending)}
                        </td>
                        <td className="py-3.5">
                          <span
                            className={cn(
                              'inline-flex rounded-lg border px-2.5 py-0.5 text-xs font-medium',
                              styles.badge,
                            )}
                          >
                            {row.topCategory}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={cn(panelCardLg, 'p-5')}>
          <h2 className={cn('mb-4', sectionTitle)}>Popüler Harcama Noktaları</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/50">
            <table className="w-full min-w-[280px] text-left text-sm">
              <thead>
                <tr className={cn(tableHeadRow, 'bg-slate-50 dark:bg-[#0f172a]/60')}>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Konum</th>
                  <th className="px-4 py-3 text-right font-medium">Harcama</th>
                  <th className="px-4 py-3 text-right font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }, (_, i) => (
                    <tr
                      key={`pop-skel-${i}`}
                      className="border-b border-slate-100 dark:border-slate-800/80"
                      aria-hidden
                    >
                      <td className="px-4 py-3">
                        <div className="h-4 w-6 animate-pulse rounded bg-slate-200 dark:bg-slate-700/60" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700/60" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="ml-auto h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700/60" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="ml-auto h-4 w-10 animate-pulse rounded bg-slate-200 dark:bg-slate-700/60" />
                      </td>
                    </tr>
                  ))
                ) : stats.topPopular.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      Henüz konum verisi yok.
                    </td>
                  </tr>
                ) : (
                  stats.topPopular.map((row, index) => (
                    <tr
                      key={row.name}
                      className={cn(
                        'border-b border-slate-100 dark:border-slate-800/80',
                        tableRowHover,
                        row.isRisky && 'bg-red-500/5',
                      )}
                    >
                      <td className="px-4 py-3 font-semibold text-primary">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                        {row.name}
                        {row.isRisky ? (
                          <span className="ml-2 inline-flex items-center rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-300">
                            Riskli
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800 dark:text-white">
                        {formatCurrencyDetailed(row.totalSpending)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {row.transactionCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!isLoading && stats.topPopular.length > 0 ? (
            <div className="mt-5 space-y-3">
              {stats.topPopular.slice(0, 3).map((row) => {
                const maxSpending = stats.topPopular[0]?.totalSpending ?? 1
                const percent = Math.round((row.totalSpending / maxSpending) * 100)
                return (
                  <div key={`bar-${row.name}`}>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-300">{row.name}</span>
                      <span className="font-medium text-primary">%{percent}</span>
                    </div>
                    <div className={cn('h-1.5', progressTrack)}>
                      <div
                        className={cn(
                          'h-full rounded-full bg-gradient-to-r transition-all duration-500',
                          row.isRisky
                            ? 'from-red-500 via-red-400 to-orange-500'
                            : 'from-primary via-purple-500 to-violet-600',
                        )}
                        style={{ width: `${percent}%` }}
                        role="progressbar"
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
