import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

import { PieChart as PieChartIcon, ShieldAlert, TrendingUp, Wallet } from 'lucide-react'

import { ApiErrorBanner } from '@/components/ui/api_error_banner'
import { PageBrandEyebrow } from '@/components/ui/page_brand_eyebrow'

import { CategoryPieChart } from '@/components/ui/category_pie_chart'

import { ChartSkeleton, PieChartSkeleton } from '@/components/ui/chart_skeleton'

import { SampleChart } from '@/components/ui/sample_chart'

import { StatCard } from '@/components/ui/stat_card'

import { useAuth } from '@/contexts/auth_context'

import {

  fetchAnomalyStats,

  fetchForecast,

  fetchKullanici,

  fetchTransactionsSummary,

  getApiErrorMessage,

  getBudget,

} from '@/lib/api'

import { formatCurrency, formatTrendPercent } from '@/lib/format'

import {

  mutedText,

  pageDescription,

  pageTitleMt,

  panelCard,

  sectionTitle,

} from '@/lib/theme_classes'

import type {
  ButceVeri,
  FraudOzetVeri,
  HarcamaOzetVeri,
  KullaniciVeri,
  TahminVeri,
} from '@/types/api'

const GENEL_BUTCE_KATEGORI = 'genel'

function resolveGenelBudgetLimit(budget: ButceVeri | null): number | null {
  const genel = budget?.butceler?.find((b) => b.category === GENEL_BUTCE_KATEGORI)
  return genel?.limit_tutar ?? null
}



type DashboardMetrics = {

  kullanici: KullaniciVeri | null

  ozet: HarcamaOzetVeri | null

  tahmin: TahminVeri | null

  fraud: FraudOzetVeri | null

  budget: ButceVeri | null

}



const EMPTY_METRICS: DashboardMetrics = {

  kullanici: null,

  ozet: null,

  tahmin: null,

  fraud: null,

  budget: null,

}



export function DashboardPage() {

  const { userId } = useAuth()

  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS)

  const [isLoading, setIsLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)



  useEffect(() => {

    if (!userId) return

    const activeUserId = userId



    let cancelled = false



    async function loadDashboard() {

      setIsLoading(true)

      setError(null)



      try {

        const [kullanici, ozet, tahmin, fraud, budget] = await Promise.all([

          fetchKullanici(activeUserId),

          fetchTransactionsSummary(activeUserId),

          fetchForecast(activeUserId),

          fetchAnomalyStats(activeUserId),

          getBudget(activeUserId).catch(() => null),

        ])



        if (!cancelled) {

          setMetrics({ kullanici, ozet, tahmin, fraud, budget })

        }

      } catch (err) {

        if (!cancelled) {

          setMetrics(EMPTY_METRICS)

          setError(getApiErrorMessage(err))

        }

      } finally {

        if (!cancelled) {

          setIsLoading(false)

        }

      }

    }



    loadDashboard()



    return () => {

      cancelled = true

    }

  }, [userId])



  const sonAyToplam = metrics.ozet?.son_ay?.toplam_harcama

  const harcamaTrend = metrics.ozet?.son_ay?.degisim_yuzde

  const budgetLimit = resolveGenelBudgetLimit(metrics.budget)

  const buAyHarcama = metrics.budget?.bu_ay_toplam_harcama ?? sonAyToplam

  const isBudgetExceeded =

    budgetLimit != null &&

    budgetLimit > 0 &&

    buAyHarcama != null &&

    buAyHarcama > budgetLimit

  const tahminSonAy = metrics.tahmin?.son_ay_toplam

  const gelecekTahmin = metrics.tahmin?.gelecek_ay_tahmini



  let tahminTrend: number | null = null

  if (tahminSonAy && gelecekTahmin != null && tahminSonAy > 0) {

    tahminTrend = ((gelecekTahmin - tahminSonAy) / tahminSonAy) * 100

  }



  const aylikHarcamaValue =

    buAyHarcama != null && budgetLimit != null && budgetLimit > 0

      ? `${formatCurrency(buAyHarcama)} / ${formatCurrency(budgetLimit)}`

      : buAyHarcama != null

        ? formatCurrency(buAyHarcama)

        : '—'

  const aylikHarcamaTrend =

    budgetLimit != null && budgetLimit > 0

      ? 'Bütçe'

      : harcamaTrend != null

        ? `${formatTrendPercent(harcamaTrend)} önceki aya göre`

        : undefined



  const toplamHarcamaValue = metrics.kullanici

    ? formatCurrency(metrics.kullanici.toplam_harcama)

    : '—'



  const tahminValue =

    gelecekTahmin != null ? formatCurrency(gelecekTahmin) : metrics.tahmin?.mesaj ?? '—'



  const fraudValue = metrics.fraud

    ? metrics.fraud.riskli_islem.toLocaleString('tr-TR')

    : '—'



  const trendChartData =

    metrics.ozet?.aylik_trend?.map((row) => ({

      name: row.ay_periyot,

      value: row.toplam_harcama,

    })) ?? []



  return (

    <div className="p-6 sm:p-8 lg:p-10">

      <header className="mb-8">

        <PageBrandEyebrow />

        <h1 className={pageTitleMt}>Ana Panel</h1>

        <p className={pageDescription}>

          Oturumunuza özel canlı harcama, kategori dağılımı, ARIMA tahmini ve fraud metrikleri.

        </p>

      </header>



      {error ? <ApiErrorBanner message={error} /> : null}



      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

        <StatCard

          title="Aylık Harcama (Son 30 gün)"

          value={aylikHarcamaValue}

          icon={Wallet}

          trend={aylikHarcamaTrend}

          valueClassName={isBudgetExceeded ? 'text-red-600 dark:text-red-400' : undefined}

          iconClassName={

            isBudgetExceeded

              ? 'bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-400'

              : undefined

          }

          badge={isBudgetExceeded ? 'Bütçe Aşıldı!' : undefined}

          isLoading={isLoading}

        />

        <StatCard

          title="Toplam Harcama"

          value={toplamHarcamaValue}

          icon={TrendingUp}

          trend={

            metrics.kullanici

              ? `${metrics.kullanici.toplam_islem.toLocaleString('tr-TR')} işlem`

              : undefined

          }

          isLoading={isLoading}

        />

        <StatCard

          title="Fraud Uyarısı"

          value={fraudValue}

          icon={ShieldAlert}

          trend={

            metrics.fraud

              ? `${formatTrendPercent(metrics.fraud.degisim_yuzde)} risk değişimi · ${metrics.fraud.toplam_islem.toLocaleString('tr-TR')} işlem`

              : undefined

          }

          className="sm:col-span-2 lg:col-span-1"

          isLoading={isLoading}

        />

      </section>



      <section className="mt-6 grid gap-6 lg:grid-cols-2">

        <div className={cn(panelCard, 'p-5')}>

          <h2 className={sectionTitle}>Aylık Harcama Trendi</h2>

          <p className={cn('mb-4', mutedText)}>

            {isLoading

              ? 'Veriler yükleniyor…'

              : trendChartData.length

                ? 'Son aylara göre harcama grafiği'

                : 'Trend verisi henüz yok'}

          </p>

          {isLoading ? (

            <ChartSkeleton />

          ) : (

            <SampleChart data={trendChartData} />

          )}

        </div>



        <div className={cn(panelCard, 'p-5')}>

          <div className="mb-4 flex items-center gap-2">

            <PieChartIcon className="size-4 text-primary" aria-hidden />

            <h2 className={sectionTitle}>Kategori Dağılımı</h2>

          </div>

          <p className={cn('mb-4', mutedText)}>

            {isLoading

              ? 'Veriler yükleniyor…'

              : metrics.ozet?.kategori_dagilimi?.length

                ? 'Harcama kategorilerine göre dağılım'

                : 'Kategori verisi henüz yok'}

          </p>

          {isLoading ? (

            <PieChartSkeleton />

          ) : (

            <CategoryPieChart data={metrics.ozet?.kategori_dagilimi} />

          )}

        </div>

      </section>



      <section className={cn(panelCard, 'mt-6 p-5')}>

        <h2 className={sectionTitle}>Gelecek Ay Tahmini (ARIMA)</h2>

        <p className={cn('mb-2', mutedText)}>

          {isLoading

            ? 'Tahmin yükleniyor…'

            : metrics.tahmin?.mesaj ?? 'ARIMA modeli ile gelecek ay projeksiyonu'}

        </p>

        {isLoading ? (

          <div className="animate-pulse space-y-2">

            <div className="h-8 w-40 rounded-md bg-slate-200 dark:bg-slate-700/60" />

            <div className="h-4 w-56 rounded-md bg-slate-100 dark:bg-slate-700/40" />

          </div>

        ) : (

          <div className="flex flex-wrap items-baseline gap-3">

            <p className="text-2xl font-semibold text-slate-800 dark:text-white">

              {tahminValue}

            </p>

            {tahminTrend != null ? (

              <span className="text-sm text-emerald-600 dark:text-emerald-400">

                {formatTrendPercent(tahminTrend)} tahmini değişim

              </span>

            ) : null}

          </div>

        )}

      </section>

    </div>

  )

}

