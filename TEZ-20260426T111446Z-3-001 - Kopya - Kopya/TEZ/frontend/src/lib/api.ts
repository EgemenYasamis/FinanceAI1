import axios, { type AxiosError } from 'axios'
import type {
  ApiResponse,
  ButceKontrolIstek,
  ButceKontrolSonuc,
  FraudOzetVeri,
  HarcamaOzetVeri,
  IslemAnalizIstek,
  IslemAnalizSonuc,
  ButceAyarlaSonuc,
  ButceVeri,
  CsvUploadSonuc,
  IslemEkleIstek,
  IslemEkleSonuc,
  IslemGecmisKayit,
  KullaniciVeri,
  OneriVeri,
  TahminVeri,
} from '@/types/api'

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

async function getVeri<T>(path: string): Promise<T> {
  const { data } = await api.get<ApiResponse<T>>(path)
  if (!data || typeof data !== 'object' || !('veri' in data)) {
    throw new Error(`Beklenmeyen API yanıtı: ${path}`)
  }
  return data.veri
}

/** İşlem / harcama özeti — backend: GET /ozet/{user_id} */
export function fetchTransactionsSummary(userId: string) {
  return getVeri<HarcamaOzetVeri>(`/ozet/${userId}`)
}

/** Toplam harcama ve işlem sayısı — backend: GET /kullanici/{user_id} */
export function fetchKullanici(userId: string) {
  return getVeri<KullaniciVeri>(`/kullanici/${userId}`)
}

/** ARIMA gelecek ay tahmini — backend: GET /tahmin/{user_id} */
export function fetchForecast(userId: string) {
  return getVeri<TahminVeri>(`/tahmin/${userId}`)
}

/** Fraud / anomali özeti — backend: GET /fraud-ozet/{user_id} */
export function fetchAnomalyStats(userId: string) {
  return getVeri<FraudOzetVeri>(`/fraud-ozet/${userId}`)
}

/** Tekli işlem kaydı + analiz — backend: POST /islem-ekle */
export async function addTransaction(payload: IslemEkleIstek) {
  const { data } = await api.post<IslemEkleSonuc>('/islem-ekle', payload)
  if (!data?.basarili) {
    throw new Error('İşlem kaydı başarısız.')
  }
  return data
}

/** CSV toplu yükleme — backend: POST /upload-csv (multipart/form-data) */
export async function uploadCSV(file: File, userId: string) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('owner_id', userId)

  const { data } = await axios.post<CsvUploadSonuc>(
    `${BASE_URL}/upload-csv`,
    formData,
    { timeout: 120_000 },
  )

  if (!data?.basarili) {
    throw new Error('CSV yükleme başarısız.')
  }
  return data
}

/** Yapay zeka işlem analizi — backend: POST /islem-analiz */
export async function analyzeTransaction(payload: IslemAnalizIstek) {
  const { data } = await api.post<IslemAnalizSonuc>('/islem-analiz', payload)
  if (!data?.basarili) {
    throw new Error('İşlem analizi başarısız.')
  }
  return data
}

/** Kullanıcının geçmiş işlemleri (en yeniden en eskiye) — backend: GET /son-islemler/{user_id} */
export function getTransactions(userId: string, limit = 50) {
  return getVeri<IslemGecmisKayit[]>(`/son-islemler/${userId}?limit=${limit}`)
}

/** @deprecated getTransactions kullanın */
export const fetchRecentTransactions = getTransactions

/** Tasarruf uyarıları — backend: GET /oneri/{user_id} */
export function fetchAlerts(userId: string) {
  return getVeri<OneriVeri>(`/oneri/${userId}`)
}

/** Bütçe limit kontrolü — backend: POST /butce-kontrol */
export async function submitBudgetLimit(payload: ButceKontrolIstek) {
  const { data } = await api.post<ApiResponse<ButceKontrolSonuc>>(
    '/butce-kontrol',
    payload,
  )
  if (!data?.basarili || !data.veri) {
    throw new Error('Bütçe kontrolü başarısız.')
  }
  return data.veri
}

/** Bütçe hedefi kaydet — backend: POST /butce-ayarla */
export async function setBudget(userId: string, amount: number, category: string) {
  const { data } = await api.post<ButceAyarlaSonuc>('/butce-ayarla', {
    owner_id: userId,
    kategori: category,
    limit_tutar: amount,
  })
  if (!data?.basarili) {
    throw new Error('Bütçe kaydı başarısız.')
  }
  return data
}

/** Kullanıcı bütçe hedefleri — backend: GET /butce/{user_id} */
export function getBudget(userId: string) {
  return getVeri<ButceVeri>(`/butce/${userId}`)
}

export function isApiConnectionError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  const axiosError = error as AxiosError
  return (
    !axiosError.response ||
    axiosError.code === 'ECONNABORTED' ||
    axiosError.code === 'ERR_NETWORK'
  )
}

export function getApiErrorMessage(error: unknown): string {
  if (isApiConnectionError(error)) {
    return 'Sistem motoruna bağlanılamıyor, FastAPI çalışıyor mu?'
  }
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string })?.detail
    if (detail) return detail
    if (error.response?.status === 404) {
      return 'Kullanıcı verisi bulunamadı. Lütfen oturumunuzu kontrol edin.'
    }
  }
  if (error instanceof Error) return error.message
  return 'Veriler alınırken bir hata oluştu.'
}
