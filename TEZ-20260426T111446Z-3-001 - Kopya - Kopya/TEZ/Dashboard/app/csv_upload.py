"""CSV toplu yükleme: pandas okuma, satır bazlı analiz, Supabase insert satırları."""

from __future__ import annotations

import io
from datetime import datetime
from typing import Any

import pandas as pd

from app.transaction_insert import (
    build_transaction_row,
    fraud_analizi,
    karbon_hesapla,
)

CSV_COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "tarih": ("tarih", "date", "datetime", "trans_date", "islem_tarihi"),
    "satici": ("satici", "merchant", "aciklama", "açıklama", "description", "satici_adi"),
    "tutar": ("tutar", "amt", "amount", "miktar", "harcama"),
    "kategori": ("kategori", "category", "kat"),
    "konum": ("konum", "location", "city", "ilce", "ilçe", "tr_ilce"),
}

KNOWN_CATEGORIES = {
    "grocery_pos",
    "grocery_net",
    "gas_transport",
    "food_dining",
    "shopping_pos",
    "shopping_net",
    "entertainment",
    "health_fitness",
    "personal_care",
    "home",
    "kids_pets",
    "travel",
    "misc_pos",
    "misc_net",
}

DEFAULTS = {
    "tarih": None,
    "satici": "Bilinmiyor",
    "tutar": None,
    "kategori": "misc_pos",
    "konum": "İzmir",
}


def _normalize_header(name: str) -> str:
    return (
        str(name)
        .strip()
        .lower()
        .replace("ı", "i")
        .replace("ş", "s")
        .replace("ğ", "g")
        .replace("ü", "u")
        .replace("ö", "o")
        .replace("ç", "c")
    )


def _resolve_column_map(columns: list[str]) -> dict[str, str | None]:
    normalized = {_normalize_header(c): c for c in columns}
    resolved: dict[str, str | None] = {}
    for canonical, aliases in CSV_COLUMN_ALIASES.items():
        resolved[canonical] = None
        for alias in aliases:
            key = _normalize_header(alias)
            if key in normalized:
                resolved[canonical] = normalized[key]
                break
    return resolved


def _normalize_category(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return DEFAULTS["kategori"]
    raw = str(value).strip()
    if not raw:
        return DEFAULTS["kategori"]
    key = raw.lower().replace(" ", "_").replace("-", "_")
    if key in KNOWN_CATEGORIES:
        return key
    tr_map = {
        "market": "grocery_pos",
        "akaryakit": "gas_transport",
        "ulasim": "gas_transport",
        "yeme": "food_dining",
        "icecek": "food_dining",
        "alisveris": "shopping_pos",
        "eglence": "entertainment",
        "saglik": "health_fitness",
        "seyahat": "travel",
        "diger": "misc_pos",
    }
    for fragment, cat in tr_map.items():
        if fragment in key:
            return cat
    return DEFAULTS["kategori"]


def _parse_tutar(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (int, float)):
        num = float(value)
        return num if num > 0 else None
    text = str(value).strip().replace(" ", "").replace("₺", "")
    if not text:
        return None
    text = text.replace(".", "").replace(",", ".") if text.count(",") == 1 else text.replace(",", "")
    try:
        num = float(text)
        return num if num > 0 else None
    except ValueError:
        return None


def _parse_tarih(value: Any) -> datetime:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return datetime.now()
    if isinstance(value, datetime):
        return value
    parsed = pd.to_datetime(value, errors="coerce", dayfirst=True)
    if pd.isna(parsed):
        return datetime.now()
    if hasattr(parsed, "to_pydatetime"):
        return parsed.to_pydatetime()
    return datetime.now()


def read_csv_dataframe(content: bytes) -> pd.DataFrame:
    raw = io.BytesIO(content)
    for sep in (",", ";", "\t"):
        try:
            df = pd.read_csv(raw, sep=sep, encoding="utf-8-sig")
            if df.shape[1] > 1:
                return df
        except Exception:
            pass
        raw.seek(0)
    return pd.read_csv(raw, encoding="utf-8-sig")


def dataframe_to_transaction_rows(owner_id: str, df: pd.DataFrame) -> tuple[list[dict[str, Any]], int]:
    """
  DataFrame satırlarını analiz edip Supabase insert listesi döner.
  Geçersiz tutarlı satırlar atlanır; atlanan sayısı ikinci değerdir.
    """
    if df.empty:
        return [], 0

    col_map = _resolve_column_map(list(df.columns))
    rows: list[dict[str, Any]] = []
    skipped = 0
    now = datetime.now()

    for _, series in df.iterrows():
        def cell(canonical: str) -> Any:
            col = col_map.get(canonical)
            if col is None:
                return None
            return series[col]

        tutar = _parse_tutar(cell("tutar"))
        if tutar is None:
            skipped += 1
            continue

        tarih = _parse_tarih(cell("tarih") if col_map.get("tarih") else now)
        satici_raw = cell("satici")
        if satici_raw is None or (isinstance(satici_raw, float) and pd.isna(satici_raw)):
            satici = DEFAULTS["satici"]
        else:
            satici = str(satici_raw).strip() or DEFAULTS["satici"]

        kategori = _normalize_category(cell("kategori"))
        konum_raw = cell("konum")
        if konum_raw is None or (isinstance(konum_raw, float) and pd.isna(konum_raw)):
            konum = DEFAULTS["konum"]
        else:
            konum = str(konum_raw).strip() or DEFAULTS["konum"]

        karbon_kgco2, karbon_katsayisi = karbon_hesapla(kategori, tutar)
        fraud_sonuc = fraud_analizi(tutar, tarih.hour)

        row = build_transaction_row(
            owner_id=owner_id,
            satici=satici,
            tutar=tutar,
            tarih=tarih,
            kategori=kategori,
            konum=konum,
            karbon_kgco2=karbon_kgco2,
            karbon_katsayisi=karbon_katsayisi,
            is_fraud=fraud_sonuc["fraud"],
        )
        rows.append(row)

    return rows, skipped
