import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  FileSpreadsheet,
  Leaf,
  Loader2,
  Shield,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth_context'
import { addTransaction, getApiErrorMessage, getBudget, uploadCSV } from '@/lib/api'
import {
  CATEGORY_OPTIONS,
  formatCategory,
  inferCategoryFromMerchant,
} from '@/lib/categories'
import { defaultDateTimeLocal, toApiDateTime } from '@/lib/datetime'
import { formatCurrency, formatKarbon } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ButceVeri, IslemEkleSonuc } from '@/types/api'
import {
  inputClassAlt,
  labelText,
  mutedText,
  pageDescription,
  pageEyebrow,
  pageTitleMt,
  panelCardLg,
  progressTrack,
  sectionTitle,
} from '@/lib/theme_classes'

type TabId = 'single' | 'csv'
type PreviewPhase = 'empty' | 'draft' | 'loading' | 'result'

const glassCard = cn(
  panelCardLg,
  'p-6 shadow-sm transition-all duration-300',
  'dark:shadow-[0_0_32px_rgba(124,58,237,0.12)]',
)

const GENEL_BUTCE_KATEGORI = 'genel'

const NO_BUDGET_MESSAGE =
  'Henüz bütçe belirlenmedi. Uyarılar sayfasından limit koyabilirsiniz.'

const DIFFERENT_MONTH_MESSAGE =
  'Farklı bir ay seçildi, bu ayın bütçesini etkilemez.'

function isSelectedMonthCurrent(dateTimeLocal: string): boolean {
  if (!dateTimeLocal.trim()) return true
  const parsed = new Date(dateTimeLocal)
  if (Number.isNaN(parsed.getTime())) return true
  const now = new Date()
  return (
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth()
  )
}

function resolveBudgetLimit(budget: ButceVeri | null, category: string): number | null {
  if (!budget?.butceler?.length) return null
  const trimmed = category.trim()
  if (trimmed) {
    const categoryBudget = budget.butceler.find((b) => b.category === trimmed)
    if (categoryBudget) return categoryBudget.limit_tutar
  }
  const genel = budget.butceler.find((b) => b.category === GENEL_BUTCE_KATEGORI)
  return genel?.limit_tutar ?? null
}

function resolveCurrentSpending(budget: ButceVeri | null, category: string): number {
  if (!budget) return 0
  const trimmed = category.trim()
  if (trimmed && budget.butceler.some((b) => b.category === trimmed)) {
    return budget.kategori_harcamalari[trimmed] ?? 0
  }
  return budget.bu_ay_toplam_harcama
}

function computeBudgetUsage(
  limit: number,
  currentSpending: number,
  draftAmount: number,
): {
  percent: number
  barPercent: number
  isOverLimit: boolean
  draftText: string
  resultText: string
} {
  const projected = currentSpending + (draftAmount > 0 ? draftAmount : 0)
  const percent = Math.round((projected / limit) * 100)
  const barPercent = Math.min(100, percent)
  const isOverLimit = projected > limit
  const remaining = Math.max(0, limit - projected)

  if (isOverLimit) {
    return {
      percent,
      barPercent,
      isOverLimit,
      draftText: `Tahmini limit aşımı: %${percent} (${formatCurrency(projected)} / ${formatCurrency(limit)})`,
      resultText: `Aylık limit aşıldı — ${formatCurrency(projected)} / ${formatCurrency(limit)}`,
    }
  }
  if (percent >= 80) {
    return {
      percent,
      barPercent,
      isOverLimit,
      draftText: `Limite yaklaşıyorsunuz: %${percent} — kalan ${formatCurrency(remaining)}`,
      resultText: `Bütçe kullanımı %${percent} — kalan ${formatCurrency(remaining)}`,
    }
  }
  return {
    percent,
    barPercent,
    isOverLimit,
    draftText: `Tahmini kullanım: %${percent} — kalan ${formatCurrency(remaining)}`,
    resultText: `Bütçe kullanımı %${percent} — kalan ${formatCurrency(remaining)}`,
  }
}

type PreviewCardProps = {
  title: string
  icon: typeof Leaf
  variant: 'carbon' | 'fraud' | 'budget'
  phase: PreviewPhase
  draftText: string
  resultText?: string
  budgetPercent?: number
  budgetBarPercent?: number
  isBudgetOverLimit?: boolean
  isFraudResult?: boolean
  budgetUnavailableMessage?: string | null
}

function PreviewCard({
  title,
  icon: Icon,
  variant,
  phase,
  draftText,
  resultText,
  budgetPercent = 0,
  budgetBarPercent = 0,
  isBudgetOverLimit = false,
  isFraudResult = false,
  budgetUnavailableMessage = null,
}: PreviewCardProps) {
  const isActive = phase !== 'empty'
  const displayPercent = phase === 'result' ? budgetPercent : phase === 'draft' ? budgetPercent : 0
  const displayBarPercent =
    phase === 'result' || phase === 'draft' ? budgetBarPercent : 0
  const showBudgetOverLimit =
    variant === 'budget' && isActive && (isBudgetOverLimit || displayPercent > 100)
  const BudgetIcon = showBudgetOverLimit ? AlertTriangle : Icon

  const variantStyles = {
    carbon: cn(
      'border-emerald-500/25 bg-emerald-500/5',
      'dark:border-emerald-500/20 dark:bg-emerald-500/10',
    ),
    fraud: cn(
      'border-violet-500/25 bg-violet-500/5',
      'dark:border-primary/25 dark:bg-primary/10',
      phase === 'result' && isFraudResult && 'border-red-500/30 bg-red-500/5 dark:bg-red-500/10',
      phase === 'result' && !isFraudResult && 'border-emerald-500/30 bg-emerald-500/5',
    ),
    budget: cn(
      'border-amber-500/25 bg-amber-500/5',
      'dark:border-amber-500/20 dark:bg-amber-500/10',
      showBudgetOverLimit && 'border-red-500/30 bg-red-500/5 dark:border-red-500/25 dark:bg-red-500/10',
    ),
  }

  const iconStyles = {
    carbon: 'text-emerald-500 dark:text-emerald-400',
    fraud: 'text-violet-600 dark:text-primary',
    budget: showBudgetOverLimit
      ? 'text-red-500 dark:text-red-400'
      : 'text-amber-500 dark:text-amber-400',
  }

  let subtitle = 'Formu doldurun — önizleme burada görünecek'
  if (variant === 'budget' && budgetUnavailableMessage) {
    subtitle = budgetUnavailableMessage
  } else if (phase === 'draft') subtitle = draftText
  else if (phase === 'loading') subtitle = 'Yükleniyor…'
  else if (phase === 'result' && resultText) subtitle = resultText

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 backdrop-blur-sm transition-all duration-500 ease-out',
        variantStyles[variant],
        isActive ? 'scale-100 opacity-100' : 'scale-[0.98] opacity-70',
      )}
    >
      <div className="mb-3 flex items-center gap-3">
        <span
          className={cn(
            'flex size-10 items-center justify-center rounded-xl bg-white/60 dark:bg-white/5',
            phase === 'loading' && 'animate-pulse',
          )}
        >
          {phase === 'loading' ? (
            <Loader2 className={cn('size-5 animate-spin', iconStyles[variant])} aria-hidden />
          ) : (
            <BudgetIcon className={cn('size-5', iconStyles[variant])} aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{title}</h3>
          <p
            className={cn(
              'text-xs transition-colors duration-300',
              showBudgetOverLimit
                ? 'font-semibold text-red-600 dark:text-red-400'
                : phase === 'result'
                  ? 'font-medium text-slate-700 dark:text-slate-200'
                  : isActive
                    ? 'text-slate-600 dark:text-slate-300'
                    : 'text-slate-400 dark:text-slate-500',
            )}
          >
            {subtitle}
          </p>
        </div>
      </div>

      {variant === 'budget' && !budgetUnavailableMessage ? (
        <div className="space-y-2">
          <div className={cn(progressTrack, 'h-2')}>
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 ease-out',
                showBudgetOverLimit
                  ? 'bg-red-500 dark:bg-red-500'
                  : 'bg-gradient-to-r from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-400',
              )}
              style={{
                width:
                  phase === 'loading'
                    ? '40%'
                    : isActive
                      ? `${displayBarPercent}%`
                      : '0%',
              }}
            />
          </div>
          {phase === 'loading' ? (
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80">Bütçe etkisi hesaplanıyor…</p>
          ) : isActive ? (
            <p
              className={cn(
                'flex items-center gap-1.5 text-xs',
                showBudgetOverLimit
                  ? 'font-medium text-red-600 dark:text-red-400'
                  : 'text-amber-700/80 dark:text-amber-300/80',
              )}
            >
              {showBudgetOverLimit ? (
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              ) : null}
              {phase === 'result' ? subtitle : `Tahmini etki: %${displayPercent} bütçe kullanımı`}
            </p>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            'flex items-center gap-2 text-xs font-medium',
            isActive ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500',
          )}
        >
          {phase === 'loading' ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {subtitle}
            </>
          ) : phase === 'draft' ? (
            <>
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-40" />
                <span className="relative inline-flex size-2 rounded-full bg-current" />
              </span>
              {subtitle}
            </>
          ) : phase === 'result' ? null : (
            subtitle
          )}
        </div>
      )}
    </div>
  )
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
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Başarıyla Kaydedildi</p>
        <p className="mt-0.5 text-xs text-emerald-800/90 dark:text-emerald-200/90">{message}</p>
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

export function AddTransactionPage() {
  const { userId } = useAuth()
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<TabId>('single')
  const [merchant, setMerchant] = useState('')
  const [tutar, setTutar] = useState('')
  const [dateTime, setDateTime] = useState(defaultDateTimeLocal)
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('')
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [categoryAiPulse, setCategoryAiPulse] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isCsvUploading, setIsCsvUploading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<IslemEkleSonuc | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [budgetData, setBudgetData] = useState<ButceVeri | null>(null)

  const tutarNum = Number(tutar)
  const hasDraftPreview =
    merchant.trim().length > 0 ||
    (Number.isFinite(tutarNum) && tutarNum > 0) ||
    location.trim().length > 0

  const budgetLimit = resolveBudgetLimit(budgetData, category)
  const hasBudget = budgetLimit != null && budgetLimit > 0
  const currentMonthlySpending = resolveCurrentSpending(budgetData, category)

  const isCurrentMonthSelected = useMemo(
    () => isSelectedMonthCurrent(dateTime),
    [dateTime],
  )

  const budgetUsage = useMemo(() => {
    if (!hasBudget || budgetLimit == null) return null
    const draftAmount =
      isCurrentMonthSelected && Number.isFinite(tutarNum) && tutarNum > 0
        ? tutarNum
        : 0
    return computeBudgetUsage(budgetLimit, currentMonthlySpending, draftAmount)
  }, [hasBudget, budgetLimit, currentMonthlySpending, tutarNum, isCurrentMonthSelected])

  const previewPhase: PreviewPhase = isSaving
    ? 'loading'
    : analysisResult
      ? 'result'
      : hasDraftPreview
        ? 'draft'
        : 'empty'

  useEffect(() => {
    if (!toastMessage) return undefined
    const timer = window.setTimeout(() => setToastMessage(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

  useEffect(() => {
    if (!userId) {
      setBudgetData(null)
      return
    }
    let cancelled = false
    getBudget(userId)
      .then((data) => {
        if (!cancelled) setBudgetData(data)
      })
      .catch(() => {
        if (!cancelled) setBudgetData(null)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (categoryTouched) return
    const inferred = inferCategoryFromMerchant(merchant)
    if (inferred && inferred !== category) {
      setCategory(inferred)
      setCategoryAiPulse(true)
      const timer = window.setTimeout(() => setCategoryAiPulse(false), 1200)
      return () => window.clearTimeout(timer)
    }
    if (!merchant.trim()) {
      setCategory('')
    }
    return undefined
  }, [merchant, category, categoryTouched])

  const handleCsvFile = useCallback((selected: File | null) => {
    if (!selected) {
      setFile(null)
      return
    }
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setFormError('Lütfen yalnızca .csv dosyası yükleyin.')
      return
    }
    setFormError(null)
    setFile(selected)
  }, [])

  function resetCsvForm() {
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function resetSingleForm() {
    setMerchant('')
    setTutar('')
    setDateTime(defaultDateTimeLocal())
    setLocation('')
    setCategory('')
    setCategoryTouched(false)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragOver(false)
    const file = event.dataTransfer.files[0] ?? null
    handleCsvFile(file)
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    handleCsvFile(file)
  }

  async function handleSingleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setAnalysisResult(null)

    const trimmedMerchant = merchant.trim()
    if (!trimmedMerchant) {
      setFormError('Satıcı / açıklama alanı zorunludur.')
      return
    }
    if (!Number.isFinite(tutarNum) || tutarNum <= 0) {
      setFormError('Geçerli bir tutar girin.')
      return
    }
    if (!location.trim()) {
      setFormError('Konum bilgisi girin.')
      return
    }
    if (!category.trim()) {
      setFormError('Kategori seçin veya satıcı adından otomatik algılanmasını bekleyin.')
      return
    }

    if (!userId) {
      setFormError('Oturum bulunamadı. Lütfen tekrar giriş yapın.')
      return
    }

    setIsSaving(true)

    try {
      const result = await addTransaction({
        owner_id: userId,
        satici: trimmedMerchant,
        tutar: tutarNum,
        tarih: toApiDateTime(dateTime),
        kategori: category,
        konum: location.trim(),
      })

      setAnalysisResult(result)
      try {
        const freshBudget = await getBudget(userId)
        setBudgetData(freshBudget)
      } catch {
        /* bütçe yenileme isteğe bağlı */
      }
      resetSingleForm()
      setToastMessage(
        `${result.fraud_durum} · ${result.karbon_metin || formatKarbon(result.karbon_kgco2)}`,
      )
    } catch (err) {
      setFormError(getApiErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCsvUpload() {
    if (!file) {
      setFormError('Önce bir CSV dosyası seçin veya sürükleyin.')
      return
    }
    if (!userId) {
      setFormError('Oturum bulunamadı. Lütfen tekrar giriş yapın.')
      return
    }

    setFormError(null)
    setIsCsvUploading(true)

    try {
      const result = await uploadCSV(file, userId)
      const count = result.kaydedilen_sayisi
      resetCsvForm()
      setToastMessage(
        `${count} adet işlem başarıyla yüklendi ve analiz edildi`,
      )
    } catch (err) {
      setFormError(getApiErrorMessage(err))
    } finally {
      setIsCsvUploading(false)
    }
  }

  const carbonResultText = analysisResult
    ? analysisResult.karbon_metin || formatKarbon(analysisResult.karbon_kgco2)
    : undefined

  const fraudResultText = analysisResult
    ? `${analysisResult.fraud_durum} (%${analysisResult.risk_skoru.toFixed(0)} risk)`
    : undefined

  const budgetAfterSave = useMemo(() => {
    if (!hasBudget || budgetLimit == null || !analysisResult) return null
    // Kayıt sonrası getBudget ile güncellenen harcama zaten yeni işlemi içerir
    return computeBudgetUsage(budgetLimit, currentMonthlySpending, 0)
  }, [hasBudget, budgetLimit, currentMonthlySpending, analysisResult])

  const isDifferentMonthDraft =
    hasBudget && !analysisResult && hasDraftPreview && !isCurrentMonthSelected

  const budgetUnavailableMessage =
    !hasBudget && !hasDraftPreview && !analysisResult ? NO_BUDGET_MESSAGE : null
  const budgetDraftText = !hasBudget
    ? NO_BUDGET_MESSAGE
    : isDifferentMonthDraft
      ? DIFFERENT_MONTH_MESSAGE
      : budgetUsage?.draftText ?? 'Bütçe limitine etkisi…'
  const budgetResultText = hasBudget
    ? budgetAfterSave?.resultText
    : undefined
  const activeBudgetUsage = analysisResult ? budgetAfterSave : budgetUsage
  const budgetResultPercent =
    hasBudget && !isDifferentMonthDraft ? (activeBudgetUsage?.percent ?? 0) : 0
  const budgetResultBarPercent =
    hasBudget && !isDifferentMonthDraft ? (activeBudgetUsage?.barPercent ?? 0) : 0
  const isBudgetOverLimit =
    hasBudget && !isDifferentMonthDraft
      ? (activeBudgetUsage?.isOverLimit ?? false)
      : false
  const budgetCardPhase: PreviewPhase = !hasBudget
    ? hasDraftPreview || analysisResult
      ? 'draft'
      : 'empty'
    : previewPhase

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      {toastMessage ? (
        <SuccessToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      ) : null}

      <header className="mb-8">
        <p className={pageEyebrow}>Harcama Girişi</p>
        <h1 className={pageTitleMt}>İşlem Ekle</h1>
        <p className={pageDescription}>
          Tekli işlem veya banka ekstresi CSV ile harcamalarınızı kaydedin; kaydetmeden
          önce karbon, güvenlik ve bütçe etkisini canlı önizleyin.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <div className={glassCard}>
          <div
            className={cn(
              'mb-6 flex rounded-xl border border-slate-200/80 bg-slate-100/80 p-1',
              'dark:border-slate-700/50 dark:bg-slate-900/50',
            )}
            role="tablist"
            aria-label="İşlem giriş türü"
          >
            {(
              [
                { id: 'single' as const, label: 'Tekli İşlem' },
                { id: 'csv' as const, label: 'Toplu Yükle (CSV)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setFormError(null)
                }}
                className={cn(
                  'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-300 ease-out',
                  activeTab === tab.id
                    ? cn(
                        'bg-white text-primary shadow-sm',
                        'dark:bg-primary/20 dark:text-white dark:shadow-[0_0_20px_rgba(124,58,237,0.25)]',
                      )
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'single' ? (
            <div className="transition-all duration-300 ease-out" role="tabpanel">
              <form onSubmit={handleSingleSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="merchant" className={cn('mb-1.5 block', labelText)}>
                    Satıcı / Açıklama
                  </label>
                  <input
                    id="merchant"
                    type="text"
                    value={merchant}
                    onChange={(e) => {
                      setMerchant(e.target.value)
                      if (analysisResult) setAnalysisResult(null)
                    }}
                    placeholder="Örn: Migros, Shell"
                    className={inputClassAlt}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="tutar" className={cn('mb-1.5 block', labelText)}>
                      Tutar (₺)
                    </label>
                    <input
                      id="tutar"
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={tutar}
                      onChange={(e) => {
                        setTutar(e.target.value)
                        if (analysisResult) setAnalysisResult(null)
                      }}
                      placeholder="0,00"
                      className={inputClassAlt}
                    />
                  </div>
                  <div>
                    <label htmlFor="datetime" className={cn('mb-1.5 block', labelText)}>
                      Tarih/Saat
                    </label>
                    <input
                      id="datetime"
                      type="datetime-local"
                      value={dateTime}
                      onChange={(e) => setDateTime(e.target.value)}
                      className={cn(inputClassAlt, 'cursor-pointer')}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="location" className={cn('mb-1.5 block', labelText)}>
                    Konum
                  </label>
                  <input
                    id="location"
                    type="text"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value)
                      if (analysisResult) setAnalysisResult(null)
                    }}
                    placeholder="Örn: Balatçık"
                    className={inputClassAlt}
                  />
                </div>

                <div>
                  <label htmlFor="category" className={cn('mb-1.5 flex items-center gap-2', labelText)}>
                    Kategori
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        'border-primary/30 bg-primary/10 text-primary',
                        'transition-transform duration-300',
                        categoryAiPulse && 'scale-110',
                      )}
                      title="Yapay zeka ile otomatik kategori"
                    >
                      <Sparkles
                        className={cn('size-3', categoryAiPulse && 'animate-pulse')}
                        aria-hidden
                      />
                      AI
                    </span>
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value)
                      setCategoryTouched(true)
                      if (analysisResult) setAnalysisResult(null)
                    }}
                    className={cn(inputClassAlt, 'cursor-pointer')}
                  >
                    <option value="">Kategori seçin veya satıcı girin…</option>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {category && !categoryTouched ? (
                    <p className={cn('mt-1.5 flex items-center gap-1.5', mutedText)}>
                      <Sparkles className="size-3.5 text-primary" aria-hidden />
                      {formatCategory(category)} otomatik algılandı
                    </p>
                  ) : null}
                </div>

                {formError ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
                  >
                    {formError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSaving}
                  className={cn(
                    'mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5',
                    'bg-gradient-to-r from-primary via-violet-600 to-purple-500',
                    'text-sm font-semibold text-white shadow-lg',
                    'transition-all duration-300 ease-out',
                    'hover:scale-[1.02] hover:shadow-[0_0_36px_rgba(124,58,237,0.5)]',
                    'active:scale-[0.98]',
                    'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100',
                  )}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Kaydediliyor ve analiz ediliyor…
                    </>
                  ) : (
                    'İşlemi Kaydet ve Analiz Et'
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="transition-all duration-300 ease-out" role="tabpanel">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all duration-300',
                  isDragOver
                    ? 'border-primary bg-primary/5 scale-[1.01] dark:bg-primary/10'
                    : 'border-slate-300 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-900/40',
                )}
              >
                <span
                  className={cn(
                    'mb-4 flex size-16 items-center justify-center rounded-2xl',
                    'bg-primary/10 text-primary transition-transform duration-300',
                    isDragOver && 'scale-110',
                  )}
                >
                  <CloudUpload className="size-8" aria-hidden />
                </span>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Banka ekstrenizi (.csv) buraya sürükleyin
                </p>
                <p className={cn('mt-1 max-w-xs', mutedText)}>
                  Sütunlar: tarih, satici, tutar, kategori, konum (virgül veya noktalı virgül)
                </p>
                {file ? (
                  <p className="mt-3 flex items-center gap-2 text-sm font-medium text-primary">
                    <FileSpreadsheet className="size-4" aria-hidden />
                    {file.name}
                  </p>
                ) : null}
                <input
                  ref={fileInputRef}
                  id={fileInputId}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={handleFileInputChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'mt-6 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium',
                    'text-slate-700 transition-colors duration-200',
                    'hover:border-primary hover:text-primary',
                    'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
                    'dark:hover:border-primary dark:hover:text-primary',
                  )}
                >
                  Dosya Seç
                </button>
              </div>

              {formError && activeTab === 'csv' ? (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
                >
                  {formError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={handleCsvUpload}
                disabled={isCsvUploading || !file}
                className={cn(
                  'mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5',
                  'bg-gradient-to-r from-primary to-purple-500 text-sm font-semibold text-white',
                  'transition-all duration-300 ease-out',
                  'hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(124,58,237,0.4)]',
                  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100',
                )}
              >
                {isCsvUploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    İşleniyor…
                  </>
                ) : (
                  'Verileri Yükle'
                )}
              </button>
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <h2 className={cn('mb-1', sectionTitle)}>Canlı Analiz Önizlemesi</h2>
          <p className={cn('mb-4', mutedText)}>
            {previewPhase === 'result'
              ? 'Kayıt sonrası backend analiz sonuçları'
              : 'Kaydetmeden önce tahmini etkiler'}
          </p>

          <div className="space-y-4">
            <PreviewCard
              title="Karbon Etkisi"
              icon={Leaf}
              variant="carbon"
              phase={previewPhase}
              draftText="Hesaplanıyor…"
              resultText={carbonResultText}
            />
            <PreviewCard
              title="Fraud (Risk) Kontrolü"
              icon={Shield}
              variant="fraud"
              phase={previewPhase}
              draftText="Güvenlik taraması…"
              resultText={fraudResultText}
              isFraudResult={analysisResult?.fraud ?? false}
            />
            <PreviewCard
              title="Bütçe Durumu"
              icon={Wallet}
              variant="budget"
              phase={budgetCardPhase}
              draftText={budgetDraftText}
              resultText={budgetResultText}
              budgetPercent={budgetResultPercent}
              budgetBarPercent={budgetResultBarPercent}
              isBudgetOverLimit={isBudgetOverLimit}
              budgetUnavailableMessage={budgetUnavailableMessage}
            />
          </div>
        </aside>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
