from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

# ============================================================
# API'YE GELEN VERİ MODELLERİ (Request)
# ============================================================

class IslemGirisi(BaseModel):
    """Yeni işlem analizi için gelen veri"""
    user_id: str
    merchant: str
    tutar: float
    saat: int
    konum: str = Field(..., min_length=1)
    merch_lat: Optional[float] = None
    merch_long: Optional[float] = None

class KullaniciGirisi(BaseModel):
    """Kullanıcı kaydı için gelen veri"""
    kullanici_adi: str
    email: str
    sifre: str

class BudgetGirisi(BaseModel):
    """Bütçe limiti belirlemek için gelen veri"""
    user_id: str
    kategori: str
    limit: float


class ButceAyarlaGirisi(BaseModel):
    """Supabase budget_goals kaydı — POST /butce-ayarla"""
    owner_id: str
    kategori: str = Field(default="genel", min_length=1)
    limit_tutar: float = Field(..., gt=0)


class IslemEkleGirisi(BaseModel):
    """Tekli işlem kaydı — Supabase transactions insert"""
    owner_id: str
    satici: str = Field(..., min_length=1)
    tutar: float = Field(..., gt=0)
    tarih: datetime
    kategori: str = Field(..., min_length=1)
    konum: str = Field(..., min_length=1)


# ============================================================
# API'DEN DÖNEN VERİ MODELLERİ (Response)
# ============================================================

class IslemSonucu(BaseModel):
    """İşlem analiz sonucu"""
    merchant: str
    tutar: float
    kategori: str
    fraud: bool
    fraud_olasilik: float
    fraud_mesaj: str
    karbon_kgco2: float
    mesafe_km: float

class HarcamaOzeti(BaseModel):
    """Aylık harcama özeti"""
    user_id: str
    son_ay_toplam: float
    onceki_ay_toplam: Optional[float]
    degisim_yuzde: float
    islem_sayisi: int
    toplam_co2: float

class TahminSonucu(BaseModel):
    """Gelecek ay tahmin sonucu"""
    son_ay_toplam: float
    gelecek_ay_tahmini: float
    fark: float
    yon: str
    mesaj: str

class GenelYanit(BaseModel):
    """Genel API yanıtı"""
    basarili: bool
    mesaj: str
    veri: Optional[dict] = None

class KonumFiltre(BaseModel):
    """Konum analizi için filtre"""
    ilce: Optional[str] = None
    kategori: Optional[str] = None

class MccSorgu(BaseModel):
    """MCC kod sorgusu"""
    mcc_kodu: int