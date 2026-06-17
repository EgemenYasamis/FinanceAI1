"""Bütçe hedefleri: budget_goals tablosu ve aylık harcama hesapları."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pandas as pd


def current_month_period() -> str:
    """İlk ay günü ISO formatında (budget_goals.month_period ile uyumlu)."""
    today = date.today()
    return f"{today.year}-{today.month:02d}-01"


def spending_for_month(df: pd.DataFrame, month_period: str, category: str | None = None) -> float:
    """Belirtilen ay ve isteğe bağlı kategori için toplam harcama."""
    if df.empty or "amt" not in df.columns:
        return 0.0

    filtered = df.copy()
    if "ay_periyot" in filtered.columns:
        filtered["ay_periyot"] = filtered["ay_periyot"].astype(str)
        filtered = filtered[filtered["ay_periyot"] == month_period]
    elif "trans_date_trans_time" in filtered.columns:
        ts = pd.to_datetime(filtered["trans_date_trans_time"], errors="coerce")
        target = pd.Timestamp(month_period)
        filtered = filtered[
            (ts.dt.year == target.year) & (ts.dt.month == target.month)
        ]

    if category and category != "genel" and "category" in filtered.columns:
        filtered = filtered[filtered["category"] == category]

    return round(float(filtered["amt"].sum()), 2)


def category_spending_map(df: pd.DataFrame, month_period: str) -> dict[str, float]:
    if df.empty or "amt" not in df.columns or "category" not in df.columns:
        return {}

    filtered = df.copy()
    if "ay_periyot" in filtered.columns:
        filtered["ay_periyot"] = filtered["ay_periyot"].astype(str)
        filtered = filtered[filtered["ay_periyot"] == month_period]
    else:
        return {}

    grouped = filtered.groupby("category")["amt"].sum()
    return {str(k): round(float(v), 2) for k, v in grouped.items()}


def budget_record_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "category": row.get("category"),
        "limit_tutar": float(row.get("monthly_limit") or 0),
        "month_period": str(row.get("month_period", "")),
        "warning_threshold_pct": float(row.get("warning_threshold_pct") or 80),
    }
