import pickle
import pandas as pd
import numpy as np
import hashlib
from statsmodels.tsa.arima.model import ARIMA
from sklearn.linear_model import LinearRegression
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

# ============================================================
# MODEL VE VERİ YÜKLEME
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]  # .../TEZ

def _data_path(filename: str) -> Path:
    """
    Verilerin bulunduğu TEZ kök klasörünü baz alır.
    Uygulama Streamlit/uvicorn hangi dizinden çalıştırılırsa çalıştırılsın
    aynı dosyaları bulmayı garanti eder.
    """
    return BASE_DIR / filename

def modelleri_yukle():
    """Tüm modelleri ve verileri yükler"""
    try:
        with open(_data_path('merchant_category_map.pkl'), 'rb') as f:
            merchant_map = pickle.load(f)

        with open(_data_path('label_encoders.pkl'), 'rb') as f:
            encoders = pickle.load(f)

        with open(_data_path('model_fraud.pkl'), 'rb') as f:
            model_fraud = pickle.load(f)

        with open(_data_path('model_tasarruf.pkl'), 'rb') as f:
            tasarruf_data = pickle.load(f)

        with open(_data_path('model_arima.pkl'), 'rb') as f:
            arima_data = pickle.load(f)

        df = pd.read_csv(_data_path('temiz_veri.csv'))
        aylik_ozet = pd.read_csv(_data_path('aylik_ozet.csv'))
        kategori_aylik = pd.read_csv(_data_path('kategori_aylik.csv'))

        print("Tüm modeller yüklendi!")
        return {
            'merchant_map': merchant_map,
            'encoders': encoders,
            'model_fraud': model_fraud,
            'tasarruf_data': tasarruf_data,
            'arima_data': arima_data,
            'df': df,
            'aylik_ozet': aylik_ozet,
            'kategori_aylik': kategori_aylik
        }
    except Exception as e:
        print(f"Model yükleme hatası: {e}")
        raise e


# ============================================================
# YARDIMCI FONKSİYONLAR
# ============================================================

# İzmir merkez — eksik/None/NaN koordinatlar için varsayılan
DEFAULT_LATITUDE = 38.4237
DEFAULT_LONGITUDE = 27.1428


def _is_invalid_numeric(value) -> bool:
    if value is None:
        return True
    try:
        if pd.isna(value):
            return True
        float(value)
        return False
    except (TypeError, ValueError):
        return True


def safe_numeric(value, default: float = 0.0) -> float:
    """None/NaN değerleri güvenli float'a çevirir."""
    return default if _is_invalid_numeric(value) else float(value)


def _is_invalid_coordinate(value) -> bool:
    if value is None:
        return True
    try:
        if pd.isna(value):
            return True
        float(value)
        return False
    except (TypeError, ValueError):
        return True


def normalize_coordinate(
    lat,
    lon,
    default_lat: float = DEFAULT_LATITUDE,
    default_lon: float = DEFAULT_LONGITUDE,
) -> tuple[float, float]:
    """None/NaN enlem-boylamı İzmir varsayılanına çevirir."""
    lat_out = default_lat if _is_invalid_coordinate(lat) else float(lat)
    lon_out = default_lon if _is_invalid_coordinate(lon) else float(lon)
    return lat_out, lon_out


def sanitize_dataframe_coordinates(df: pd.DataFrame) -> pd.DataFrame:
    """DataFrame'deki lat/long (ve türev) sütunlarında boş değerleri doldurur."""
    if df.empty:
        return df

    out = df.copy()

    def _fill_pair(lat_col: str, lon_col: str, fallbacks: list[tuple[str, str]]) -> None:
        if lat_col not in out.columns and lon_col not in out.columns:
            return
        if lat_col not in out.columns:
            out[lat_col] = pd.NA
        if lon_col not in out.columns:
            out[lon_col] = pd.NA

        lat = pd.to_numeric(out[lat_col], errors="coerce")
        lon = pd.to_numeric(out[lon_col], errors="coerce")

        for fb_lat, fb_lon in fallbacks:
            if fb_lat in out.columns:
                lat = lat.fillna(pd.to_numeric(out[fb_lat], errors="coerce"))
            if fb_lon in out.columns:
                lon = lon.fillna(pd.to_numeric(out[fb_lon], errors="coerce"))

        lat = lat.fillna(DEFAULT_LATITUDE)
        lon = lon.fillna(DEFAULT_LONGITUDE)
        out[lat_col] = lat
        out[lon_col] = lon

    _fill_pair("lat", "long", [("tr_lat", "tr_long"), ("merch_lat", "merch_long")])
    _fill_pair("merch_lat", "merch_long", [("tr_lat", "tr_long")])
    _fill_pair("tr_lat", "tr_long", [])

    return out


def sanitize_dataframe_numeric_features(df: pd.DataFrame) -> pd.DataFrame:
    """ML özellik sütunlarında None/NaN değerleri doldurur."""
    if df.empty:
        return df

    out = df.copy()
    amt = (
        pd.to_numeric(out["amt"], errors="coerce")
        if "amt" in out.columns
        else None
    )

    for col in (
        "city_pop",
        "gender_enc",
        "state_enc",
        "harcama_zscore",
        "kullanici_toplam",
    ):
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0.0)

    if "kullanici_ort" in out.columns:
        out["kullanici_ort"] = pd.to_numeric(out["kullanici_ort"], errors="coerce")
        ort_fill = float(amt.mean()) if amt is not None and amt.notna().any() else 0.0
        out["kullanici_ort"] = out["kullanici_ort"].fillna(ort_fill)

    if "kullanici_std" in out.columns:
        out["kullanici_std"] = pd.to_numeric(out["kullanici_std"], errors="coerce")
        if amt is not None and amt.notna().sum() > 1:
            std_fill = float(amt.std())
            if pd.isna(std_fill):
                std_fill = 0.0
        else:
            std_fill = 0.0
        out["kullanici_std"] = out["kullanici_std"].fillna(std_fill)

    if "kullanici_islem_sayisi" in out.columns:
        out["kullanici_islem_sayisi"] = pd.to_numeric(
            out["kullanici_islem_sayisi"], errors="coerce"
        ).fillna(float(len(out)))

    return out


def resolve_user_statistics(kullanici: pd.DataFrame, tutar: float) -> dict[str, float]:
    """Fraud modeli için kullanıcı özet alanları; eksikse işlem geçmişinden türetilir."""
    amt = (
        pd.to_numeric(kullanici["amt"], errors="coerce").dropna()
        if "amt" in kullanici.columns
        else pd.Series(dtype=float)
    )
    tutar_safe = safe_numeric(tutar, 0.0)

    ort_fallback = float(amt.mean()) if len(amt) else tutar_safe
    std_fallback = float(amt.std()) if len(amt) > 1 else 0.0
    if pd.isna(std_fallback):
        std_fallback = 0.0

    count_fallback = float(len(kullanici))

    def _col_value(col: str, fallback: float) -> float:
        if col not in kullanici.columns:
            return fallback
        return safe_numeric(kullanici[col].iloc[0], fallback)

    kullanici_ort = _col_value("kullanici_ort", ort_fallback)
    kullanici_std = _col_value("kullanici_std", std_fallback)
    kullanici_islem_sayisi = _col_value("kullanici_islem_sayisi", count_fallback)

    return {
        "kullanici_ort": kullanici_ort,
        "kullanici_std": kullanici_std,
        "kullanici_islem_sayisi": kullanici_islem_sayisi,
        "city_pop": _col_value("city_pop", 0.0),
        "gender_enc": _col_value("gender_enc", 0.0),
        "state_enc": _col_value("state_enc", 0.0),
    }


def turkce_kucuk(metin):
    """Türkçe karakterleri doğru küçük harfe çevirir"""
    if not isinstance(metin, str):
        return str(metin)
    cevirme = {
        'İ': 'i', 'I': 'ı', 'Ğ': 'ğ',
        'Ü': 'ü', 'Ş': 'ş', 'Ö': 'ö', 'Ç': 'ç'
    }
    for buyuk, kucuk in cevirme.items():
        metin = metin.replace(buyuk, kucuk)
    return metin.lower()


def normalize_metin(metin: str) -> str:
    """Satıcı/konum vb. metinleri karşılaştırma ve eşleştirme için normalize eder."""
    if metin is None:
        return ""
    return turkce_kucuk(str(metin).strip())


MEGA_KATEGORI_ANAHTARLARI: dict[str, list[str]] = {
    "grocery_pos": [
        "migros", "bim", "şok", "sok", "a101", "carrefour", "macrocenter", "macro",
        "file", "hakmar", "çağrı", "onur market", "özdilek", "metro", "bizim toptan",
        "tansaş", "bakkal", "tekel", "büfe", "bufe", "kasap", "manav", "fırın",
        "firin", "market", "kuruyemiş", "şarküteri", "sarkuteri", "gross",
        "seç market", "peynirci", "gıda", "manavı", "pazarı",
    ],
    "food_dining": [
        "starbucks", "yemeksepeti", "getir", "trendyol yemek", "mcdonalds",
        "mcdonald", "burger king", "kfc", "popeyes", "dominos", "pizza hut",
        "little caesars", "subway", "arbys", "sbarro", "kahve dünyası",
        "espresso lab", "arabica", "mado", "pelit", "özsüt", "simit sarayı",
        "köfteci yusuf", "hd iskender", "baydöner", "tavuk dünyası", "midyeci",
        "çorbacı", "pastane", "kafe", "cafe", "kahve", "lokanta", "restoran",
        "restaurant", "dürüm", "lahmacun", "kebap", "tatlı", "baklava", "dondurma",
        "börek", "meyhane", "bar", "pub", "bistro", "steak", "pide", "çiğ köfte",
        "cig kofte",
    ],
    "gas_transport": [
        "shell", "opet", "petrol ofisi", "bp", "total", "aytemiz", "kadoil",
        "lukoil", "türkiye petrolleri", "thy", "turkish airlines", "pegasus",
        "sunexpress", "anadolu jet", "kamil koç", "pamukkale", "metro turizm",
        "obilet", "enuygun", "biletall", "taksi", "bitaksi", "uber", "martı",
        "binbin", "hop", "tiktak", "moov", "yolcu360", "enterprise", "avis",
        "budget", "rent a car", "izban", "ego", "iett", "metro", "marmaray",
        "vapur", "ido", "budo", "hgs", "ogs", "ispark", "otopark", "otogar",
        "kiralama",
    ],
    "shopping_pos": [
        "trendyol", "hepsiburada", "amazon", "n11", "çiçeksepeti", "zara", "lcw",
        "lc waikiki", "defacto", "koton", "mavi", "colins", "boyner", "beymen",
        "pull bear", "bershka", "stradivarius", "h&m", "mango", "massimo dutti",
        "teknosa", "vatan bilgisayar", "mediamarkt", "itopya", "incehesap", "ikea",
        "koçtaş", "tekzen", "bauhaus", "gratis", "watsons", "rossmann", "eve shop",
        "sephora", "ebebek", "d&r", "bkm kitap", "decathlon", "nike", "adidas",
        "puma", "under armour", "flo", "instreet", "derimod", "kemal tanca", "avm",
        "mağaza", "giyim", "kırtasiye", "oyuncak", "ayakkabı",
    ],
    "misc_pos": [
        "turkcell", "vodafone", "türk telekom", "superonline", "kablonet",
        "dsmart", "digiturk", "tivibu", "enerjisa", "gediz", "ck boğaziçi",
        "ayedaş", "izsu", "iski", "aski", "igdaş", "başkentgaz", "netflix",
        "spotify", "youtube", "apple", "google", "microsoft", "steam",
        "epic games", "playstation", "xbox", "exxen", "blutv", "mubi", "eczane",
        "hastane", "sağlık", "klinik", "diş", "veteriner", "kuaför", "berber",
        "güzellik", "spor", "macfit", "gym", "fitness", "sinema", "cinemaximum",
        "paribu", "biletix", "passo", "kargo", "aras", "yurtiçi", "mng", "sürat",
        "ptt", "ups", "noter", "sigorta", "vergi", "aidat", "bağış", "tema",
        "lösev", "afad", "ahbap", "fatura",
    ],
}


def kategori_bul(merchant_adi, merchant_map):
    """Satıcı adından kategori bulur"""
    normalized_merchant = normalize_metin(merchant_adi)

    # Tam eşleşme
    if normalized_merchant in merchant_map:
        return merchant_map[normalized_merchant]

    # Mega kategori anahtarları (kısmi eşleşme)
    for kategori, anahtarlar in MEGA_KATEGORI_ANAHTARLARI.items():
        if any(
            normalize_metin(anahtar) in normalized_merchant
            for anahtar in anahtarlar
        ):
            return kategori

    # merchant_map üzerinden kısmi eşleşme
    for satici, kategori in merchant_map.items():
        satici_norm = normalize_metin(satici)
        if (
            satici_norm in normalized_merchant
            or normalized_merchant in satici_norm
        ):
            return kategori

    return 'misc_pos'


def haversine(lat1, lon1, lat2, lon2):
    """İki koordinat arası mesafeyi km cinsinden hesaplar"""
    lat1, lon1 = normalize_coordinate(lat1, lon1)
    lat2, lon2 = normalize_coordinate(lat2, lon2)
    R = 6371
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat/2)**2 + np.cos(lat1)*np.cos(lat2)*np.sin(dlon/2)**2
    return R * 2 * np.arcsin(np.sqrt(a))


# ============================================================
# KATEGORİZASYON
# ============================================================

def islem_kategorize_et(merchant, merchant_map):
    """Yeni işlemi kategorize eder"""
    return kategori_bul(merchant, merchant_map)


# ============================================================
# FRAUD TESPİTİ
# ============================================================

def fraud_kontrol(
    user_id, tutar, kategori, saat,
    merch_lat, merch_long, veriler
):
    """İşlemin fraud olup olmadığını kontrol eder"""
    df = veriler['df']
    model_fraud = veriler['model_fraud']
    encoders = veriler['encoders']

    # Kullanıcı bilgilerini al
    kullanici = df[df['user_id'] == user_id]

    if len(kullanici) == 0:
        return {
            'fraud': False,
            'olasilik': 0.0,
            'mesaj': 'Kullanıcı bulunamadı'
        }

    stats = resolve_user_statistics(kullanici, tutar)
    kullanici_ort = stats["kullanici_ort"]
    kullanici_std = stats["kullanici_std"]
    kullanici_islem_sayisi = stats["kullanici_islem_sayisi"]
    city_pop = stats["city_pop"]
    gender_enc = stats["gender_enc"]
    state_enc = stats["state_enc"]
    tutar_safe = safe_numeric(tutar, 0.0)

    user_lat = kullanici['lat'].iloc[0] if 'lat' in kullanici.columns else None
    user_long = kullanici['long'].iloc[0] if 'long' in kullanici.columns else None
    user_lat, user_long = normalize_coordinate(user_lat, user_long)
    merch_lat, merch_long = normalize_coordinate(merch_lat, merch_long)

    # Mesafe hesapla
    mesafe_km = haversine(user_lat, user_long, merch_lat, merch_long)

    # Z-skoru hesapla
    harcama_zscore = (tutar_safe - kullanici_ort) / (kullanici_std + 1e-6)

    # Kategori encode et
    le_category = encoders['category']
    if kategori in le_category.classes_:
        category_enc = le_category.transform([kategori])[0]
    else:
        category_enc = 0

    # Model girdisi
    from datetime import datetime
    simdi = datetime.now()

    giris = pd.DataFrame([{
        'amt': tutar_safe,
        'category_enc': category_enc,
        'gender_enc': gender_enc,
        'state_enc': state_enc,
        'yil': simdi.year,
        'ay': simdi.month,
        'gun': simdi.day,
        'saat': saat,
        'hafta_sonu': 1 if simdi.weekday() >= 5 else 0,
        'mesafe_km': mesafe_km,
        'city_pop': city_pop,
        'kullanici_ort': kullanici_ort,
        'kullanici_islem_sayisi': kullanici_islem_sayisi,
        'harcama_zscore': harcama_zscore
    }])

    tahmin = model_fraud.predict(giris)[0]
    olasilik = model_fraud.predict_proba(giris)[0][1]

    return {
        'fraud': bool(tahmin == 1),
        'olasilik': round(float(olasilik) * 100, 1),
        'mesafe_km': round(mesafe_km, 1),
        'mesaj': '⚠ Şüpheli işlem!' if tahmin == 1 else '✓ Normal işlem'
    }


# ============================================================
# HARCAMA PANELİ
# ============================================================

def harcama_ozeti_getir(user_id, veriler):
    df = veriler['df']
    kullanici = df[df['user_id'] == user_id]

    if len(kullanici) == 0:
        return None

    def nan_temizle(deger):
        try:
            if pd.isna(deger) or deger != deger:
                return 0
        except:
            pass
        return deger

    aylik = kullanici.groupby('ay_periyot').agg(
        toplam_harcama=('amt', 'sum'),
        islem_sayisi=('amt', 'count'),
        ort_harcama=('amt', 'mean'),
        toplam_co2=('karbon_kgco2', 'sum')
    ).reset_index().sort_values('ay_periyot')

    aylik['degisim'] = aylik['toplam_harcama'].pct_change() * 100
    aylik['degisim'] = aylik['degisim'].fillna(0).replace(
        [float('inf'), float('-inf')], 0
    )

    kategori = kullanici.groupby('category').agg(
        toplam=('amt', 'sum'),
        islem=('amt', 'count')
    ).reset_index().sort_values('toplam', ascending=False)

    son_ay = aylik.iloc[-1]
    onceki_ay = aylik.iloc[-2] if len(aylik) > 1 else None

    return {
        'user_id': user_id,
        'son_ay': {
            'ay': str(son_ay['ay_periyot']),
            'toplam_harcama': round(float(nan_temizle(son_ay['toplam_harcama'])), 2),
            'islem_sayisi': int(son_ay['islem_sayisi']),
            'ort_harcama': round(float(nan_temizle(son_ay['ort_harcama'])), 2),
            'toplam_co2': round(float(nan_temizle(son_ay['toplam_co2'])), 2),
            'degisim_yuzde': round(float(nan_temizle(son_ay['degisim'])), 2)
        },
        'onceki_ay': {
            'ay': str(onceki_ay['ay_periyot']),
            'toplam_harcama': round(float(nan_temizle(onceki_ay['toplam_harcama'])), 2)
        } if onceki_ay is not None else None,
        'aylik_trend': [
            {
                'ay_periyot': str(r['ay_periyot']),
                'toplam_harcama': round(float(nan_temizle(r['toplam_harcama'])), 2),
                'degisim': round(float(nan_temizle(r['degisim'])), 2)
            }
            for r in aylik.to_dict('records')
        ],
        'kategori_dagilimi': [
            {
                'category': str(r['category']),
                'toplam': round(float(nan_temizle(r['toplam'])), 2),
                'islem': int(r['islem'])
            }
            for r in kategori.to_dict('records')
        ]
    }
# ============================================================
# GELECEK AY TAHMİNİ (ARIMA)
# ============================================================

def gelecek_ay_tahmini(user_id, veriler):
    """ARIMA ile kullanıcının gelecek ay harcamasını tahmin eder"""
    df = veriler['df']

    kullanici = df[df['user_id'] == user_id]

    if len(kullanici) == 0:
        return {
            'son_ay_toplam': 0.0,
            'gelecek_ay_tahmini': 0.0,
            'fark': 0.0,
            'yon': 'sabit',
            'mesaj': 'İşlem geçmişi bulunamadı; tahmin 0 TL olarak döndürüldü',
            'tahmin_yontemi': 'no_data_fallback'
        }

    aylik = kullanici.groupby('ay_periyot')['amt'].sum().reset_index()
    aylik = aylik.sort_values('ay_periyot')

    if len(aylik) == 0:
        return {
            'son_ay_toplam': 0.0,
            'gelecek_ay_tahmini': 0.0,
            'fark': 0.0,
            'yon': 'sabit',
            'mesaj': 'Aylık harcama verisi bulunamadı; tahmin 0 TL olarak döndürüldü',
            'tahmin_yontemi': 'no_data_fallback'
        }

    seri = aylik['amt'].values
    son_ay_toplam = float(seri[-1]) if len(seri) else 0.0

    def _deterministik_sapma(
        owner_id: str,
        islem_sayisi: int,
        son_ay_harcama: float,
    ) -> tuple[float, int]:
        # Aynı kullanıcı + aynı ay + aynı veri parmak izi için fallback tahmini sabit kalsın.
        ay_anahtari = pd.Timestamp.now().strftime("%Y-%m")
        son_ay_harcama_fmt = f"{son_ay_harcama:.2f}"
        seed_input = (
            f"{owner_id}|{ay_anahtari}|{islem_sayisi}|{son_ay_harcama_fmt}"
        ).encode("utf-8")
        digest = hashlib.sha256(seed_input).hexdigest()
        seed_int = int(digest[:8], 16)
        sapma_orani = 0.05 if (seed_int % 2 == 0) else 0.10
        yon_isareti = 1 if ((seed_int // 2) % 2 == 0) else -1
        return sapma_orani, yon_isareti

    def _fallback_tahmin(temel_tutar: float, neden: str) -> dict:
        if temel_tutar <= 0:
            return {
                'son_ay_toplam': 0.0,
                'gelecek_ay_tahmini': 0.0,
                'fark': 0.0,
                'yon': 'sabit',
                'mesaj': f'{neden}; güvenli fallback ile 0 TL döndürüldü',
                'tahmin_yontemi': 'zero_fallback'
            }

        sapma_orani, yon_isareti = _deterministik_sapma(
            owner_id=str(user_id),
            islem_sayisi=int(len(kullanici)),
            son_ay_harcama=float(son_ay_toplam),
        )
        tahmin = max(temel_tutar * (1 + yon_isareti * sapma_orani), 0.0)
        fark = tahmin - temel_tutar

        return {
            'son_ay_toplam': round(temel_tutar, 2),
            'gelecek_ay_tahmini': round(tahmin, 2),
            'fark': round(abs(fark), 2),
            'yon': 'artacak' if fark > 0 else 'azalacak',
            'mesaj': (
                f'{neden}; güvenli fallback ile '
                f'%{int(sapma_orani * 100)} sapmalı tahmin üretildi'
            ),
            'tahmin_yontemi': 'fallback_random_percent'
        }

    # ARIMA için minimum veri noktası kontrolü
    if len(aylik) < 3:
        return _fallback_tahmin(
            temel_tutar=son_ay_toplam,
            neden='Yeterli geçmiş veri yok (min 3 ay)'
        )

    try:
        model = ARIMA(seri, order=(1, 1, 0))
        model_fit = model.fit()
        tahmin = max(model_fit.forecast(steps=1)[0], 0)

        fark = tahmin - son_ay_toplam
        yon = 'artacak' if fark > 0 else 'azalacak'

        return {
            'son_ay_toplam': round(son_ay_toplam, 2),
            'gelecek_ay_tahmini': round(tahmin, 2),
            'fark': round(abs(fark), 2),
            'yon': yon,
            'mesaj': f"Gelecek ay harcamanızın {round(abs(fark), 2)} TL {yon} bekleniyor",
            'tahmin_yontemi': 'arima'
        }
    except Exception as e:
        return _fallback_tahmin(
            temel_tutar=son_ay_toplam,
            neden=f'ARIMA hatası ({str(e)})'
        )


# ============================================================
# TASARRUF ÖNERİSİ (LINEAR REGRESSION)
# ============================================================

def tasarruf_onerisi_getir(user_id, veriler):
    """Kategori bazlı tasarruf önerisi üretir"""
    df = veriler['df']

    kullanici = df[df['user_id'] == user_id]

    if len(kullanici) == 0:
        return None

    kullanici_kat = kullanici.groupby(
        ['ay_periyot', 'category']
    )['amt'].sum().reset_index()
    kullanici_kat.columns = ['ay_periyot', 'category', 'toplam']
    kullanici_kat = kullanici_kat.sort_values('ay_periyot')

    son_ay = kullanici_kat['ay_periyot'].max()
    kategoriler = kullanici_kat['category'].unique()
    sonuclar = []

    for kategori in kategoriler:
        kat_veri = kullanici_kat[
            kullanici_kat['category'] == kategori
        ].sort_values('ay_periyot')

        if len(kat_veri) < 4:
            continue

        son_n = kat_veri.tail(4)
        egitim = son_n.iloc[:-1]
        gercek_son_ay = son_n.iloc[-1]['toplam']
        gecmis_ort = egitim['toplam'].mean()

        X = np.arange(len(egitim)).reshape(-1, 1)
        y = egitim['toplam'].values

        model = LinearRegression()
        model.fit(X, y)

        r2 = model.score(X, y)
        egim = model.coef_[0]

        if r2 < 0.1:
            gelecek_tahmin = gecmis_ort
            tahmin_yontemi = 'ortalama'
        else:
            gelecek_tahmin = model.predict([[len(egitim)]])[0]
            tahmin_yontemi = 'linear_regression'

        if gelecek_tahmin <= 0:
            gelecek_tahmin = gecmis_ort
            tahmin_yontemi = 'ortalama'

        fark = gercek_son_ay - gecmis_ort
        fark_yuzde = (fark / gecmis_ort) * 100 if gecmis_ort > 0 else 0

        if r2 >= 0.1:
            trend = 'artiyor' if egim > 0 else 'azaliyor'
        else:
            trend = 'dalgali'

        if (fark_yuzde > 50 and trend == 'artiyor') or fark_yuzde > 200:
            uyari_seviye = 'kirmizi'
        elif fark_yuzde > 50:
            uyari_seviye = 'sari'
        else:
            uyari_seviye = 'normal'

        sonuclar.append({
            'kategori': kategori,
            'son_ay_harcama': round(gercek_son_ay, 2),
            'gecmis_ortalama': round(gecmis_ort, 2),
            'gelecek_ay_tahmini': round(gelecek_tahmin, 2),
            'trend': trend,
            'fark_yuzde': round(fark_yuzde, 2),
            'uyari_seviye': uyari_seviye,
            'tahmin_yontemi': tahmin_yontemi
        })

    sonuclar = sorted(
        sonuclar,
        key=lambda x: x['fark_yuzde'],
        reverse=True
    )

    kirmizi = [s for s in sonuclar if s['uyari_seviye'] == 'kirmizi']
    sari = [s for s in sonuclar if s['uyari_seviye'] == 'sari']
    normal = [s for s in sonuclar if s['uyari_seviye'] == 'normal']

    return {
        'user_id': user_id,
        'son_ay': son_ay,
        'ozet': {
            'kirmizi_uyari': len(kirmizi),
            'sari_uyari': len(sari),
            'normal': len(normal)
        },
        'kirmizi': kirmizi,
        'sari': sari,
        'normal': normal
    }


# ============================================================
# KARBON AYAK İZİ
# ============================================================

def karbon_ozeti_getir(user_id, veriler):
    """Kullanıcının karbon ayak izi özetini getirir"""
    df = veriler['df']

    kullanici = df[df['user_id'] == user_id]

    if len(kullanici) == 0:
        return None

    # Aylık CO2
    aylik_co2 = kullanici.groupby('ay_periyot')['karbon_kgco2'].sum().reset_index()
    aylik_co2 = aylik_co2.sort_values('ay_periyot')

    # Kategori bazlı CO2
    kategori_co2 = kullanici.groupby('category').agg(
        toplam_co2=('karbon_kgco2', 'sum'),
        ort_co2=('karbon_kgco2', 'mean')
    ).reset_index().sort_values('toplam_co2', ascending=False)

    son_ay_co2 = aylik_co2.iloc[-1]['karbon_kgco2']
    toplam_co2 = kullanici['karbon_kgco2'].sum()

    # CO2 seviyesi
    if son_ay_co2 > 500:
        seviye = 'yüksek'
        oneri = 'Bu ay karbon emisyonunuz yüksek. Ulaşım ve alışveriş harcamalarınızı azaltmayı deneyin.'
    elif son_ay_co2 > 200:
        seviye = 'orta'
        oneri = 'Karbon emisyonunuz orta seviyede. Biraz daha dikkatli olabilirsiniz.'
    else:
        seviye = 'düşük'
        oneri = 'Karbon emisyonunuz düşük seviyede, tebrikler!'

    return {
        'user_id': user_id,
        'son_ay_co2': round(son_ay_co2, 2),
        'toplam_co2': round(toplam_co2, 2),
        'seviye': seviye,
        'oneri': oneri,
        'aylik_trend': aylik_co2.to_dict('records'),
        'kategori_dagilimi': kategori_co2.to_dict('records')
    }
# ============================================================
# KONUM ANALİZİ
# ============================================================

def konum_analizi_getir(veriler, ilce=None, kategori=None):
    """
    Mahalle bazlı kategori analizi yapar.
    İlçe ve kategori filtresi uygulanabilir.
    """
    try:
        konum_df = pd.read_csv(_data_path('konum_kategori_tr.csv'))

        if ilce:
            konum_df = konum_df[konum_df['tr_ilce'] == ilce]
        if kategori:
            konum_df = konum_df[konum_df['category'] == kategori]

        if len(konum_df) == 0:
            return None

        # Mahalle bazlı özet
        mahalle_ozet = konum_df.groupby(
            ['tr_ilce', 'tr_mahalle', 'tr_lat', 'tr_long']
        ).agg(
            toplam_islem=('islem_sayisi', 'sum'),
            toplam_harcama=('toplam_harcama', 'sum'),
            en_cok_kategori=('category', lambda x: x.iloc[
                konum_df.loc[x.index, 'islem_sayisi'].argmax()
            ])
        ).reset_index()

        return {
            'toplam_mahalle': len(mahalle_ozet),
            'filtre': {
                'ilce': ilce,
                'kategori': kategori
            },
            'mahalle_listesi': mahalle_ozet.to_dict('records'),
            'kategori_dagilimi': konum_df.groupby(
                'category'
            )['islem_sayisi'].sum().sort_values(
                ascending=False
            ).to_dict()
        }
    except Exception as e:
        print(f"Konum analizi hatası: {e}")
        return None


# ============================================================
# MCC KOD ANALİZİ
# ============================================================

def mcc_analizi_getir(mcc_kodu, veriler):
    """
    Belirli bir MCC koduna ait işlem analizini getirir.
    """
    df = veriler['df']

    if 'mcc_kodu' not in df.columns:
        return None

    mcc_df = df[df['mcc_kodu'] == mcc_kodu]

    if len(mcc_df) == 0:
        return {
            'mcc_kodu': mcc_kodu,
            'mesaj': f'MCC kodu {mcc_kodu} bulunamadı'
        }

    return {
        'mcc_kodu': mcc_kodu,
        'mcc_aciklama': mcc_df['mcc_aciklama'].iloc[0],
        'toplam_islem': int(len(mcc_df)),
        'toplam_harcama': round(float(mcc_df['amt'].sum()), 2),
        'ort_harcama': round(float(mcc_df['amt'].mean()), 2),
        'kategoriler': mcc_df['category'].unique().tolist(),
        'mahalle_dagilimi': mcc_df.groupby(
            'tr_mahalle'
        )['amt'].sum().sort_values(
            ascending=False
        ).head(10).round(2).to_dict()
    }