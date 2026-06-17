/** `datetime-local` input için varsayılan değer (yerel saat). */
export function defaultDateTimeLocal(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/** datetime-local değerinden saat (0–23) çıkarır. */
export function hourFromDateTimeLocal(localValue: string): number {
  if (!localValue) return new Date().getHours()
  const match = localValue.match(/T(\d{2}):/)
  if (match) {
    const hour = Number(match[1])
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23) return hour
  }
  const parsed = new Date(localValue)
  if (!Number.isNaN(parsed.getTime())) return parsed.getHours()
  return new Date().getHours()
}

/** İşlem Ekle API'si için ISO tarih/saat. */
export function toApiDateTime(localValue: string): string {
  if (!localValue) return new Date().toISOString()
  const parsed = new Date(localValue)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}
