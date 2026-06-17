export type ApiResponse<T> = {
  basarili: boolean
  veri: T
}

export type KullaniciVeri = {
  user_id: string
  toplam_islem: number
  toplam_harcama: number
  ort_harcama: number
  en_cok_kategori: string | null
  ilk_islem: string | null
  son_islem: string | null
}

export type OzetSonAy = {
  ay: string
  toplam_harcama: number
  islem_sayisi: number
  ort_harcama: number
  toplam_co2: number
  degisim_yuzde: number
}

export type HarcamaOzetVeri = {
  user_id: string
  son_ay: OzetSonAy
  onceki_ay?: { ay: string; toplam_harcama: number } | null
  aylik_trend: Array<{
    ay_periyot: string
    toplam_harcama: number
    degisim: number
  }>
  kategori_dagilimi: Array<{
    category: string
    toplam: number
    islem: number
  }>
}

export type TahminVeri = {
  son_ay_toplam?: number
  gelecek_ay_tahmini?: number | null
  fark?: number
  yon?: string
  mesaj?: string
  tahmin?: null
}

export type FraudOzetVeri = {
  riskli_islem: number
  degisim_yuzde: number
  toplam_islem: number
}

export type IslemAnalizIstek = {
  user_id: string
  merchant: string
  tutar: number
  saat: number
  konum: string
  merch_lat?: number
  merch_long?: number
}

export type IslemAnalizSonuc = {
  basarili: boolean
  merchant: string
  konum?: string
  tutar: number
  kategori: string
  fraud: boolean
  fraud_olasilik: number
  fraud_mesaj: string
  karbon_kgco2: number
  mesafe_km: number
}

export type IslemGecmisKayit = {
  id?: string | number
  trans_date_trans_time?: string
  created_at?: string
  merchant?: string
  amt?: number
  category?: string
  mcc_aciklama?: string
  tr_ilce?: string
  is_fraud?: boolean
  karbon_kgco2?: number
}

export type UyariKategoriItem = {
  kategori: string
  son_ay_harcama: number
  gecmis_ortalama: number
  gelecek_ay_tahmini: number
  trend: string
  fark_yuzde: number
  uyari_seviye: string
  tahmin_yontemi: string
}

export type OneriVeri = {
  user_id: string
  son_ay?: string
  ozet?: {
    kirmizi_uyari: number
    sari_uyari: number
    normal: number
  }
  kirmizi?: UyariKategoriItem[]
  sari?: UyariKategoriItem[]
  normal?: UyariKategoriItem[]
  mesaj?: string
}

export type ButceKontrolIstek = {
  user_id: string
  kategori: string
  limit: number
}

export type ButceKontrolSonuc = {
  user_id: string
  kategori: string
  limit: number
  harcanan: number
  asim: number
  asim_yuzde: number
  uyari: boolean
  mesaj: string
}

export type IslemEkleIstek = {
  owner_id: string
  satici: string
  tutar: number
  tarih: string
  kategori: string
  konum: string
}

export type IslemEkleSonuc = {
  basarili: boolean
  islem_id?: string | number | null
  merchant?: string
  tutar?: number
  kategori?: string
  karbon_kgco2: number
  karbon_metin: string
  fraud: boolean
  risk_skoru: number
  fraud_durum: string
  fraud_mesaj: string
  butce_etki_yuzde: number
  butce_mesaj: string
}

export type CsvUploadSonuc = {
  basarili: boolean
  kaydedilen_sayisi: number
  atlanan_sayisi?: number
  toplam_satir?: number
}

export type ButceKayit = {
  id?: string
  category: string
  limit_tutar: number
  month_period: string
  warning_threshold_pct?: number
}

export type ButceVeri = {
  owner_id: string
  ay_periyot: string
  butceler: ButceKayit[]
  bu_ay_toplam_harcama: number
  kategori_harcamalari: Record<string, number>
}

export type ButceAyarlaSonuc = {
  basarili: boolean
  mesaj: string
  veri?: ButceKayit
}
