"""Yeni işlem kaydı: basit analiz simülasyonu ve Supabase insert yardımcıları."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.utils import (
    DEFAULT_LATITUDE,
    DEFAULT_LONGITUDE,
    normalize_coordinate,
    normalize_metin,
)

# Kategori → kg CO2 / TL çarpanı (basit simülasyon)
KARBON_CARPAN: dict[str, float] = {
    "gas_transport": 0.5,
    "grocery_pos": 0.1,
    "grocery_net": 0.1,
    "food_dining": 0.2,
    "shopping_pos": 0.15,
    "shopping_net": 0.12,
    "entertainment": 0.08,
    "health_fitness": 0.06,
    "personal_care": 0.09,
    "home": 0.11,
    "kids_pets": 0.1,
    "travel": 0.35,
    "misc_pos": 0.12,
    "misc_net": 0.1,
}

DEFAULT_KARBON_CARPAN = 0.15
DEFAULT_AYLIK_BUTCE = 8000.0

# Konum etiketi → koordinat (frontend regions ile uyumlu)
KONUM_KOORDINATLARI: list[tuple[str, float, float]] = [
    ("balatçık", 38.518, 27.058),
    ("çiğli", 38.518, 27.058),
    ("bostanlı", 38.478, 27.1023),
    ("karşıyaka", 38.478, 27.1023),
    ("bornova", 38.468, 27.2174),
    ("buca", 38.3837, 27.18),
    ("alsancak", 38.4378, 27.1434),
    ("konak", 38.4378, 27.1434),
    ("halkapınar", 38.448, 27.18),
    ("buca merkez", 38.3837, 27.18),
    ("merkez", 38.4237, 27.1428),
]
DEFAULT_MERCH_LAT = DEFAULT_LATITUDE
DEFAULT_MERCH_LONG = DEFAULT_LONGITUDE


def konum_koordinatlari(konum: str) -> tuple[float, float]:
    normalized = normalize_metin(konum)
    if not normalized:
        return normalize_coordinate(DEFAULT_MERCH_LAT, DEFAULT_MERCH_LONG)
    for anahtar, lat, lon in KONUM_KOORDINATLARI:
        anahtar_norm = normalize_metin(anahtar)
        if anahtar_norm in normalized or normalized in anahtar_norm:
            return normalize_coordinate(lat, lon)
    return normalize_coordinate(DEFAULT_MERCH_LAT, DEFAULT_MERCH_LONG)


def karbon_hesapla(kategori: str, tutar: float) -> tuple[float, float]:
    carpan = KARBON_CARPAN.get(kategori, DEFAULT_KARBON_CARPAN)
    kgco2 = round(tutar * carpan, 2)
    return kgco2, carpan


def fraud_analizi(tutar: float, saat: int) -> dict[str, Any]:
    risk_skoru = 0.0
    nedenler: list[str] = []

    if tutar > 5000:
        risk_skoru += 55
        nedenler.append("yüksek tutar")
    elif tutar > 3000:
        risk_skoru += 25
        nedenler.append("ortalama üstü tutar")

    if saat == 0 or saat >= 23:
        risk_skoru += 35
        nedenler.append("gece saati")
    elif saat <= 5:
        risk_skoru += 20
        nedenler.append("gece/şafak saati")

    risk_skoru = min(100.0, round(risk_skoru, 1))
    fraud = risk_skoru >= 50

    if fraud:
        fraud_durum = "Yüksek Risk"
        mesaj = f"Risk skoru %{risk_skoru:.0f}"
        if nedenler:
            mesaj += f" ({', '.join(nedenler)})"
    else:
        fraud_durum = "Normal İşlem"
        mesaj = f"Risk skoru düşük (%{risk_skoru:.0f})"

    return {
        "fraud": fraud,
        "risk_skoru": risk_skoru,
        "fraud_durum": fraud_durum,
        "fraud_mesaj": mesaj,
    }


def butce_etkisi_hesapla(
    tutar: float,
    mevcut_aylik_toplam: float,
    aylik_limit: float = DEFAULT_AYLIK_BUTCE,
) -> dict[str, Any]:
    yeni_toplam = mevcut_aylik_toplam + tutar
    etki_yuzde = min(100, round((yeni_toplam / aylik_limit) * 100, 1))
    kalan = max(0.0, round(aylik_limit - yeni_toplam, 2))
    asim = yeni_toplam > aylik_limit

    if asim:
        mesaj = f"Aylık limit aşıldı ({yeni_toplam:,.0f} ₺ / {aylik_limit:,.0f} ₺)"
    elif etki_yuzde >= 80:
        mesaj = f"Limite yaklaşıyorsunuz — kalan {kalan:,.0f} ₺"
    else:
        mesaj = f"Bütçe kullanımı %{etki_yuzde:.0f} — kalan {kalan:,.0f} ₺"

    return {
        "butce_etki_yuzde": etki_yuzde,
        "butce_mesaj": mesaj,
        "aylik_toplam_sonra": round(yeni_toplam, 2),
    }


def build_transaction_row(
    *,
    owner_id: str,
    satici: str,
    tutar: float,
    tarih: datetime,
    kategori: str,
    konum: str,
    karbon_kgco2: float,
    karbon_katsayisi: float,
    is_fraud: bool,
) -> dict[str, Any]:
    merch_lat, merch_long = konum_koordinatlari(konum)
    merch_lat, merch_long = normalize_coordinate(merch_lat, merch_long)
    ay_periyot = f"{tarih.year}-{tarih.month:02d}-01"

    return {
        "owner_id": owner_id,
        "trans_date_trans_time": tarih.isoformat(),
        "merchant": satici,
        "category": kategori,
        "amt": round(tutar, 2),
        "saat": tarih.hour,
        "yil": tarih.year,
        "ay": tarih.month,
        "gun": tarih.day,
        "haftanin_gunu": tarih.weekday(),
        "hafta_sonu": tarih.weekday() >= 5,
        "ay_periyot": ay_periyot,
        "karbon_kgco2": karbon_kgco2,
        "karbon_katsayisi": karbon_katsayisi,
        "is_fraud": is_fraud,
        "tr_ilce": normalize_metin(konum) or konum.strip(),
        "merch_lat": merch_lat,
        "merch_long": merch_long,
        "city": "İzmir",
        "state": "TR35",
    }
