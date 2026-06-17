export function formatCurrency(value: number): string {
  return `₺${value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`
}

export function formatCurrencyDetailed(value: number): string {
  return `₺${value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatKarbon(value: number): string {
  return `${value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg CO₂`
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTrendPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}
