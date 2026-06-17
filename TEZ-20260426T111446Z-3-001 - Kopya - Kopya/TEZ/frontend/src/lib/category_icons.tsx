import type { LucideIcon } from 'lucide-react'
import {
  Baby,
  Car,
  Clapperboard,
  Globe,
  HeartPulse,
  Home,
  Package,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Tag,
  Utensils,
} from 'lucide-react'

/** Backend kategori anahtarları → lucide ikon */
const CATEGORY_ICON_BY_KEY: Record<string, LucideIcon> = {
  gas_transport: Car,
  grocery_pos: ShoppingCart,
  grocery_net: ShoppingCart,
  food_dining: Utensils,
  shopping_pos: ShoppingBag,
  shopping_net: Globe,
  entertainment: Clapperboard,
  health_fitness: HeartPulse,
  personal_care: Sparkles,
  home: Home,
  kids_pets: Baby,
  travel: Plane,
  misc_pos: Package,
  misc_net: Package,
}

/** Türkçe etiket → ikon (ham etiket gelirse) */
const CATEGORY_ICON_BY_LABEL: Record<string, LucideIcon> = {
  'Akaryakıt / Ulaşım': Car,
  'Market (Fiziksel)': ShoppingCart,
  'Market (Online)': ShoppingCart,
  'Yeme İçme': Utensils,
  'Alışveriş (Fiziksel)': ShoppingBag,
  'Alışveriş (Online)': Globe,
  Eğlence: Clapperboard,
  'Sağlık / Spor': HeartPulse,
  'Kişisel Bakım': Sparkles,
  'Ev Ürünleri': Home,
  'Çocuk / Evcil Hayvan': Baby,
  Seyahat: Plane,
  'Diğer (Fiziksel)': Package,
  'Diğer (Online)': Package,
}

export function getCategoryIcon(category: string | undefined): LucideIcon {
  if (!category?.trim()) return Tag
  const trimmed = category.trim()
  return (
    CATEGORY_ICON_BY_KEY[trimmed] ??
    CATEGORY_ICON_BY_LABEL[trimmed] ??
    Tag
  )
}
