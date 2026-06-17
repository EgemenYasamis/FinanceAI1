export type NavItemId =
  | 'dashboard'
  | 'add_transaction'
  | 'transactions'
  | 'alerts'
  | 'location'
  | 'carbon'

export type NavItem = {
  id: NavItemId
  label: string
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Ana Panel' },
  { id: 'add_transaction', label: 'İşlem Ekle' },
  { id: 'transactions', label: 'İşlemler' },
  { id: 'alerts', label: 'Uyarılar' },
  { id: 'location', label: 'Konum Analizi' },
  { id: 'carbon', label: 'Karbon Ayak İzi' },
]
