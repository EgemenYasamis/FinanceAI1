const KATEGORI_TR: Record<string, string> = {
  grocery_pos: 'Market (Fiziksel)',
  grocery_net: 'Market (Online)',
  gas_transport: 'Akaryakıt / Ulaşım',
  food_dining: 'Yeme İçme',
  shopping_pos: 'Alışveriş (Fiziksel)',
  shopping_net: 'Alışveriş (Online)',
  entertainment: 'Eğlence',
  health_fitness: 'Sağlık / Spor',
  personal_care: 'Kişisel Bakım',
  home: 'Ev Ürünleri',
  kids_pets: 'Çocuk / Evcil Hayvan',
  travel: 'Seyahat',
  misc_pos: 'Diğer (Fiziksel)',
  misc_net: 'Diğer (Online)',
}

export function formatCategory(category: string | undefined): string {
  if (!category) return '—'
  return KATEGORI_TR[category] ?? category
}

export const CATEGORY_OPTIONS = Object.entries(KATEGORI_TR).map(([value, label]) => ({
  value,
  label,
}))

/** Satıcı adından kategori tahmini — şimdilik yalnızca UI (backend sonra bağlanacak) */
const MERCHANT_CATEGORY_HINTS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /migros|a101|bim|carrefour|metro|market/i, category: 'grocery_pos' },
  { pattern: /shell|opet|bp|petrol|akaryakıt|tüpraş/i, category: 'gas_transport' },
  { pattern: /starbucks|mcdonald|burger|domino|pizza|restoran|cafe|kahve/i, category: 'food_dining' },
  { pattern: /trendyol|hepsiburada|n11|amazon|gitti/i, category: 'shopping_net' },
  { pattern: /zara|h&m|lc waikiki|defacto|mağaza/i, category: 'shopping_pos' },
  { pattern: /netflix|spotify|sinema|bilet|eğlence/i, category: 'entertainment' },
  { pattern: /eczane|hastane|spor|fitness|sağlık/i, category: 'health_fitness' },
  { pattern: /otel|uçak|thy|pegasus|booking|seyahat/i, category: 'travel' },
]

export function inferCategoryFromMerchant(merchant: string): string | null {
  const trimmed = merchant.trim()
  if (!trimmed) return null
  const hit = MERCHANT_CATEGORY_HINTS.find(({ pattern }) => pattern.test(trimmed))
  return hit?.category ?? null
}

export function formatTrendLabel(trend: string): string {
  const map: Record<string, string> = {
    artiyor: 'artıyor',
    azaliyor: 'azalıyor',
    dalgali: 'dalgalı',
  }
  return map[trend] ?? trend
}
