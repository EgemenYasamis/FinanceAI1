"""Veri yokken API'nin döndüreceği güvenli varsayılan yanıtlar."""


def empty_kullanici_veri(user_id: str) -> dict:
    return {
        "user_id": user_id,
        "toplam_islem": 0,
        "toplam_harcama": 0.0,
        "ort_harcama": 0.0,
        "en_cok_kategori": None,
        "ilk_islem": None,
        "son_islem": None,
    }


def empty_ozet_veri(user_id: str) -> dict:
    return {
        "user_id": user_id,
        "son_ay": {
            "ay": "",
            "toplam_harcama": 0.0,
            "islem_sayisi": 0,
            "ort_harcama": 0.0,
            "toplam_co2": 0.0,
            "degisim_yuzde": 0.0,
        },
        "onceki_ay": None,
        "aylik_trend": [],
        "kategori_dagilimi": [],
    }


def empty_tahmin_veri() -> dict:
    return {
        "son_ay_toplam": 0.0,
        "gelecek_ay_tahmini": None,
        "fark": 0.0,
        "yon": "sabit",
        "mesaj": "Bu kullanıcı için henüz yeterli işlem verisi yok (min 6 ay).",
        "tahmin": None,
    }


def empty_fraud_ozet() -> dict:
    return {
        "riskli_islem": 0,
        "degisim_yuzde": 0.0,
        "toplam_islem": 0,
    }


def empty_karbon_veri(user_id: str) -> dict:
    return {
        "user_id": user_id,
        "son_ay_co2": 0.0,
        "toplam_co2": 0.0,
        "seviye": "düşük",
        "oneri": "Henüz karbon verisi bulunmuyor.",
        "aylik_trend": [],
        "kategori_dagilimi": [],
    }


def empty_oneri_veri(user_id: str) -> dict:
    return {
        "user_id": user_id,
        "oneriler": [],
        "mesaj": "Tasarruf önerisi için yeterli veri yok.",
    }
