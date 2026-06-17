from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client
import json
import pandas as pd
import re
import sys
import os
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models import IslemGirisi, BudgetGirisi, ButceAyarlaGirisi, IslemEkleGirisi
from app.budget_service import (
    budget_record_to_dict,
    category_spending_map,
    current_month_period,
    spending_for_month,
)
from app.csv_upload import dataframe_to_transaction_rows, read_csv_dataframe
from app.transaction_insert import (
    build_transaction_row,
    butce_etkisi_hesapla,
    fraud_analizi,
    karbon_hesapla,
    konum_koordinatlari,
)
from app.utils import (
    modelleri_yukle,
    islem_kategorize_et,
    fraud_kontrol,
    normalize_coordinate,
    normalize_metin,
    sanitize_dataframe_coordinates,
    sanitize_dataframe_numeric_features,
    harcama_ozeti_getir,
    gelecek_ay_tahmini,
    tasarruf_onerisi_getir,
    karbon_ozeti_getir,
)
from app.empty_responses import (
    empty_fraud_ozet,
    empty_karbon_veri,
    empty_kullanici_veri,
    empty_oneri_veri,
    empty_ozet_veri,
    empty_tahmin_veri,
)

# ============================================================
# UYGULAMA BAŞLAT
# ============================================================

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL ve SUPABASE_KEY .env dosyasında tanımlı olmalıdır.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Dev: profiles/kullanıcı tablosu kontrolü yok; transactions'tan doğrudan oku, boşsa 404 atma.
DEV_RELAX_USER_CHECK = os.getenv("DEV_RELAX_USER_CHECK", "true").lower() in (
    "1",
    "true",
    "yes",
)


class AuthRequest(BaseModel):
    email: str
    password: str


app = FastAPI(
    title="Kişisel Finans Yönetim API",
    description="AI destekli kişisel finans yönetim sistemi",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Geliştirme aşaması için her şeye izin ver
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelleri yükle
print("Modeller yükleniyor...")
veriler = modelleri_yukle()
print("API hazır!")

TRANSACTION_SELECT_COLUMNS = (
    "id,owner_id,trans_date_trans_time,merchant,category,amt,gender,city,state,lat,long,"
    "city_pop,job,merch_lat,merch_long,is_fraud,merch_zipcode,source_user_id,yil,ay,gun,saat,"
    "haftanin_gunu,hafta_sonu,ay_periyot,mesafe_km,kullanici_ort,kullanici_std,kullanici_toplam,"
    "kullanici_islem_sayisi,harcama_zscore,aylik_toplam,karbon_katsayisi,karbon_kgco2,category_enc,"
    "gender_enc,state_enc,yas,mcc_kodu,mcc_aciklama,tr_sehir,tr_ilce,tr_mahalle,tr_lat,tr_long,created_at"
)

# Supabase transactions: owner_id = uuid (auth kullanıcısı), source_user_id = bigint (eski CSV id)
OWNER_ID_COLUMN = "owner_id"
SOURCE_USER_ID_COLUMN = "source_user_id"
ALLOWED_TRANSACTION_FILTERS = frozenset({OWNER_ID_COLUMN, SOURCE_USER_ID_COLUMN})

UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _is_uuid(value: str) -> bool:
    return bool(UUID_PATTERN.match(str(value).strip()))


def _normalize_user_id(user_id: str) -> str:
    """Path/query parametresini her zaman string UUID veya sayısal legacy id olarak tutar."""
    return str(user_id).strip()


def _paginate_transactions(filter_column: str, filter_value):
    if filter_column not in ALLOWED_TRANSACTION_FILTERS:
        raise ValueError(
            f"Geçersiz filtre sütunu: {filter_column}. "
            f"İzin verilenler: {', '.join(sorted(ALLOWED_TRANSACTION_FILTERS))}"
        )

    tum_kayitlar = []
    sayfa_boyutu = 1000
    baslangic = 0

    while True:
        bitis = baslangic + sayfa_boyutu - 1
        sonuc = (
            supabase.table("transactions")
            .select(TRANSACTION_SELECT_COLUMNS)
            .eq(filter_column, filter_value)
            .range(baslangic, bitis)
            .execute()
        )
        veri = sonuc.data or []
        if not veri:
            break
        tum_kayitlar.extend(veri)
        if len(veri) < sayfa_boyutu:
            break
        baslangic += sayfa_boyutu

    return tum_kayitlar


def _records_to_df(tum_kayitlar, owner_id: str) -> pd.DataFrame:
    if not tum_kayitlar:
        return pd.DataFrame()

    df = pd.DataFrame(tum_kayitlar)
    if "ay_periyot" in df.columns:
        df["ay_periyot"] = df["ay_periyot"].astype(str)
    df["user_id"] = owner_id
    df = sanitize_dataframe_coordinates(df)
    return sanitize_dataframe_numeric_features(df)


def _fetch_transactions_df(user_id: str) -> pd.DataFrame:
    """
    transactions tablosundan kayıt çeker.
    - Auth UUID → yalnızca owner_id (uuid) sütunu (.eq('owner_id', ...))
    - Eski sayısal id → yalnızca source_user_id (bigint) sütunu
    id (PK) veya bigint sütunlara UUID string gönderilmez.
    """
    owner_key = _normalize_user_id(user_id)
    kayitlar = []

    if _is_uuid(owner_key):
        kayitlar = _paginate_transactions(OWNER_ID_COLUMN, owner_key)
    elif owner_key.isdigit():
        kayitlar = _paginate_transactions(SOURCE_USER_ID_COLUMN, int(owner_key))
    else:
        kayitlar = _paginate_transactions(OWNER_ID_COLUMN, owner_key)

    return _records_to_df(kayitlar, owner_key)


def _build_veriler_with_db_df(user_id: str):
    """Boş DataFrame ile de bağlam döner; 404 için None kullanılmaz."""
    df = _fetch_transactions_df(user_id)
    baglam = dict(veriler)
    baglam["df"] = df
    return baglam


# ============================================================
# ANA SAYFA
# ============================================================

@app.get("/")
async def ana_sayfa():
    return {
        "mesaj": "Kişisel Finans Yönetim API'ye Hoş Geldiniz!",
        "versiyon": "1.0.0",
        "endpointler": {
            "POST /register"           : "E-posta + şifre ile kayıt",
            "POST /login"              : "E-posta + şifre ile giriş",
            "POST /islem-analiz"       : "Yeni işlem analizi",
            "POST /islem-ekle"         : "İşlem kaydet + analiz",
            "POST /upload-csv"         : "CSV ile toplu işlem yükle",
            "GET  /ozet/{user_id}"     : "Aylık harcama özeti",
            "GET  /tahmin/{user_id}"   : "Gelecek ay tahmini",
            "GET  /oneri/{user_id}"    : "Tasarruf önerisi",
            "GET  /karbon/{user_id}"   : "Karbon ayak izi",
            "GET  /kullanici/{user_id}": "Kullanıcı bilgileri",
            "POST /butce-kontrol"      : "Bütçe limit kontrolü",
            "POST /butce-ayarla"       : "Bütçe hedefi kaydet",
            "GET  /butce/{user_id}"    : "Kullanıcı bütçe hedefleri",
        }
    }


# ============================================================
# AUTH ENDPOINTLERİ
# ============================================================

@app.post("/register")
async def register(auth: AuthRequest):
    try:
        sonuc = supabase.auth.sign_up({
            "email": auth.email,
            "password": auth.password
        })
        return {
            "basarili": True,
            "kullanici": sonuc.user.model_dump() if sonuc.user else None,
            "session": sonuc.session.model_dump() if sonuc.session else None
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/login")
async def login(auth: AuthRequest):
    try:
        sonuc = supabase.auth.sign_in_with_password({
            "email": auth.email,
            "password": auth.password
        })

        if sonuc.session is None:
            raise HTTPException(status_code=401, detail="Giriş başarısız.")

        return {
            "basarili": True,
            "session": sonuc.session.model_dump(),
            "access_token": sonuc.session.access_token
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


# ============================================================
# ENDPOINT 1 — YENİ İŞLEM ANALİZİ
# ============================================================

@app.post("/islem-analiz")
async def islem_analiz(islem: IslemGirisi):
    try:
        veriler_db = _build_veriler_with_db_df(islem.user_id)
        if veriler_db["df"].empty and not DEV_RELAX_USER_CHECK:
            raise HTTPException(
                status_code=404,
                detail=f"Kullanıcı {islem.user_id} için işlem verisi bulunamadı",
            )
        if veriler_db["df"].empty:
            raise HTTPException(
                status_code=400,
                detail="İşlem analizi için bu kullanıcıya ait kayıt bulunamadı.",
            )

        merchant_display = islem.merchant.strip()
        konum_display = islem.konum.strip()
        if not merchant_display:
            raise HTTPException(status_code=400, detail="Satıcı adı boş olamaz.")
        if not konum_display:
            raise HTTPException(status_code=400, detail="Alışveriş bölgesi boş olamaz.")

        merchant_norm = normalize_metin(merchant_display)

        kategori = islem_kategorize_et(
            merchant_norm,
            veriler['merchant_map']
        )

        if islem.merch_lat is not None and islem.merch_long is not None:
            merch_lat, merch_long = normalize_coordinate(
                islem.merch_lat, islem.merch_long
            )
        else:
            merch_lat, merch_long = konum_koordinatlari(konum_display)

        fraud_sonuc = fraud_kontrol(
            user_id=islem.user_id,
            tutar=islem.tutar,
            kategori=kategori,
            saat=islem.saat,
            merch_lat=merch_lat,
            merch_long=merch_long,
            veriler=veriler_db
        )

        karbon_katsayilari = {
            'grocery_pos': 0.37, 'grocery_net': 0.32,
            'gas_transport': 2.24, 'food_dining': 0.82,
            'shopping_pos': 0.58, 'shopping_net': 0.51,
            'entertainment': 0.31, 'health_fitness': 0.25,
            'personal_care': 0.41, 'home': 0.48,
            'kids_pets': 0.44, 'travel': 1.78,
            'misc_pos': 0.46, 'misc_net': 0.39,
        }
        katsayi = karbon_katsayilari.get(kategori, 0.46)
        karbon = round(islem.tutar * katsayi, 2)

        yanit = {
            'basarili': True,
            'merchant': merchant_display,
            'konum': konum_display,
            'tutar': islem.tutar,
            'kategori': kategori,
            'fraud': fraud_sonuc['fraud'],
            'fraud_olasilik': fraud_sonuc['olasilik'],
            'fraud_mesaj': fraud_sonuc['mesaj'],
            'karbon_kgco2': karbon,
            'mesafe_km': fraud_sonuc['mesafe_km']
        }
        supabase.table("anomaly_results").insert(
            {
                "owner_id": islem.user_id,
                "merchant": merchant_display,
                "analyzed_amount": islem.tutar,
                "analyzed_hour": islem.saat,
                "analyzed_merch_lat": merch_lat,
                "analyzed_merch_long": merch_long,
                "predicted_category": kategori,
                "predicted_is_fraud": fraud_sonuc["fraud"],
                "fraud_probability_pct": fraud_sonuc["olasilik"],
                "fraud_message": fraud_sonuc["mesaj"],
                "distance_km": fraud_sonuc["mesafe_km"],
                "karbon_kgco2": karbon,
            }
        ).execute()
        return yanit

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 1b — TEKLİ İŞLEM KAYDI (Supabase transactions)
# ============================================================

@app.post("/islem-ekle")
async def islem_ekle(giris: IslemEkleGirisi):
    """
    Yeni işlem: basit karbon/fraud/bütçe simülasyonu → transactions tablosuna insert.
    """
    try:
        owner_id = _normalize_user_id(giris.owner_id)
        if not _is_uuid(owner_id):
            raise HTTPException(
                status_code=400,
                detail="owner_id geçerli bir UUID olmalıdır.",
            )

        satici_display = giris.satici.strip()
        konum_display = giris.konum.strip()
        if not satici_display:
            raise HTTPException(status_code=400, detail="Satıcı adı boş olamaz.")
        if not konum_display:
            raise HTTPException(status_code=400, detail="Konum boş olamaz.")

        kategori = normalize_metin(giris.kategori.strip()) or "misc_pos"
        karbon_kgco2, karbon_katsayisi = karbon_hesapla(kategori, giris.tutar)
        fraud_sonuc = fraud_analizi(giris.tutar, giris.tarih.hour)

        df = _fetch_transactions_df(owner_id)
        mevcut_aylik = 0.0
        if not df.empty and "ay_periyot" in df.columns and "amt" in df.columns:
            ay_periyot = f"{giris.tarih.year}-{giris.tarih.month:02d}-01"
            ay_df = df[df["ay_periyot"].astype(str) == ay_periyot]
            if not ay_df.empty:
                mevcut_aylik = float(ay_df["amt"].sum())

        butce_sonuc = butce_etkisi_hesapla(giris.tutar, mevcut_aylik)

        row = build_transaction_row(
            owner_id=owner_id,
            satici=satici_display,
            tutar=giris.tutar,
            tarih=giris.tarih,
            kategori=kategori,
            konum=konum_display,
            karbon_kgco2=karbon_kgco2,
            karbon_katsayisi=karbon_katsayisi,
            is_fraud=fraud_sonuc["fraud"],
        )

        insert_sonuc = supabase.table("transactions").insert(row).execute()
        kayit = (insert_sonuc.data or [{}])[0]
        islem_id = kayit.get("id")

        return {
            "basarili": True,
            "islem_id": islem_id,
            "merchant": giris.satici.strip(),
            "tutar": round(giris.tutar, 2),
            "kategori": kategori,
            "karbon_kgco2": karbon_kgco2,
            "karbon_metin": f"{karbon_kgco2:,.2f} kg CO₂",
            "fraud": fraud_sonuc["fraud"],
            "risk_skoru": fraud_sonuc["risk_skoru"],
            "fraud_durum": fraud_sonuc["fraud_durum"],
            "fraud_mesaj": fraud_sonuc["fraud_mesaj"],
            "butce_etki_yuzde": butce_sonuc["butce_etki_yuzde"],
            "butce_mesaj": butce_sonuc["butce_mesaj"],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 1c — CSV TOPLU YÜKLEME
# ============================================================

BULK_INSERT_CHUNK = 500


@app.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    owner_id: str = Form(...),
):
    """
    CSV dosyasından toplu işlem yükler.
    Beklenen sütunlar: tarih, satici, tutar, kategori, konum (eksikse varsayılan atanır).
    """
    try:
        owner_key = _normalize_user_id(owner_id)
        if not _is_uuid(owner_key):
            raise HTTPException(
                status_code=400,
                detail="owner_id geçerli bir UUID olmalıdır.",
            )

        if not file.filename or not file.filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=400,
                detail="Yalnızca .csv dosyası yükleyebilirsiniz.",
            )

        content = await file.read()
        if not content or not content.strip():
            raise HTTPException(status_code=400, detail="CSV dosyası boş.")

        df = read_csv_dataframe(content)
        if df.empty:
            raise HTTPException(
                status_code=400,
                detail="CSV dosyasında işlenecek satır bulunamadı.",
            )

        rows, skipped = dataframe_to_transaction_rows(owner_key, df)
        if not rows:
            raise HTTPException(
                status_code=400,
                detail="Geçerli tutar içeren satır bulunamadı. 'tutar' sütununu kontrol edin.",
            )

        kaydedilen = 0
        for i in range(0, len(rows), BULK_INSERT_CHUNK):
            chunk = rows[i : i + BULK_INSERT_CHUNK]
            sonuc = supabase.table("transactions").insert(chunk).execute()
            kaydedilen += len(sonuc.data or chunk)

        return {
            "basarili": True,
            "kaydedilen_sayisi": kaydedilen,
            "atlanan_sayisi": skipped,
            "toplam_satir": int(len(df)),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 2 — HARCAMA ÖZETİ
# ============================================================

@app.get("/ozet/{user_id}")
async def harcama_ozeti(user_id: str):
    try:
        veriler_db = _build_veriler_with_db_df(user_id)
        if veriler_db["df"].empty:
            return {"basarili": True, "veri": empty_ozet_veri(user_id)}
        ozet = harcama_ozeti_getir(user_id, veriler_db)
        if ozet is None:
            return {"basarili": True, "veri": empty_ozet_veri(user_id)}
        return {"basarili": True, "veri": ozet}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 3 — GELECEK AY TAHMİNİ
# ============================================================

@app.get("/tahmin/{user_id}")
async def butce_tahmini(user_id: str):
    try:
        veriler_db = _build_veriler_with_db_df(user_id)
        tahmin = gelecek_ay_tahmini(user_id, veriler_db)
        if tahmin and tahmin.get("gelecek_ay_tahmini") is not None:
            ay_periyot = pd.Timestamp.now().to_period("M").to_timestamp().date().isoformat()
            supabase.table("forecast_results").upsert(
                {
                    "owner_id": user_id,
                    "forecast_month": ay_periyot,
                    "son_ay_toplam": tahmin.get("son_ay_toplam"),
                    "gelecek_ay_tahmini": tahmin.get("gelecek_ay_tahmini"),
                    "fark": tahmin.get("fark"),
                    "yon": tahmin.get("yon"),
                    "mesaj": tahmin.get("mesaj"),
                },
                on_conflict="owner_id,forecast_month",
            ).execute()
        if tahmin is None:
            return {"basarili": True, "veri": empty_tahmin_veri()}
        return {"basarili": True, "veri": tahmin}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 4 — TASARRUF ÖNERİSİ
# ============================================================

@app.get("/oneri/{user_id}")
async def tasarruf_onerisi(user_id: str):
    try:
        veriler_db = _build_veriler_with_db_df(user_id)
        if veriler_db["df"].empty:
            return {"basarili": True, "veri": empty_oneri_veri(user_id)}
        oneri = tasarruf_onerisi_getir(user_id, veriler_db)
        if oneri is None:
            return {"basarili": True, "veri": empty_oneri_veri(user_id)}
        return {"basarili": True, "veri": oneri}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 5 — KARBON AYAK İZİ
# ============================================================

@app.get("/karbon/{user_id}")
async def karbon_ayak_izi(user_id: str):
    try:
        veriler_db = _build_veriler_with_db_df(user_id)
        if veriler_db["df"].empty:
            return {"basarili": True, "veri": empty_karbon_veri(user_id)}
        karbon = karbon_ozeti_getir(user_id, veriler_db)
        if karbon is None:
            return {"basarili": True, "veri": empty_karbon_veri(user_id)}
        return {"basarili": True, "veri": karbon}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 6 — KULLANICI BİLGİLERİ
# ============================================================

@app.get("/kullanici/{user_id}")
async def kullanici_bilgileri(user_id: str):
    try:
        df = _fetch_transactions_df(user_id)

        if df.empty:
            return {"basarili": True, "veri": empty_kullanici_veri(user_id)}

        en_cok_kategori = df.groupby("category")["amt"].sum().idxmax()

        return {
            "basarili": True,
            "veri": {
                "user_id": user_id,
                "toplam_islem": int(len(df)),
                "toplam_harcama": round(df["amt"].sum(), 2),
                "ort_harcama": round(df["amt"].mean(), 2),
                "en_cok_kategori": en_cok_kategori,
                "ilk_islem": df["ay_periyot"].min(),
                "son_islem": df["ay_periyot"].max(),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 6b — PANEL VERİLERİ (Son işlemler, MCC, Fraud özeti)
# ============================================================

@app.get("/son-islemler/{user_id}")
async def son_islemler(user_id: str, limit: int = 20):
    try:
        df = _fetch_transactions_df(user_id)
        if df.empty:
            return {"basarili": True, "veri": []}

        sort_col = (
            "trans_date_trans_time"
            if "trans_date_trans_time" in df.columns
            else "created_at"
        )
        son = df.sort_values(sort_col, ascending=False).head(limit)
        cols = [
            "id",
            "trans_date_trans_time",
            "created_at",
            "merchant",
            "amt",
            "category",
            "mcc_aciklama",
            "tr_ilce",
            "is_fraud",
            "karbon_kgco2",
        ]
        available = [c for c in cols if c in son.columns]
        kayitlar = son[available].copy()
        if "trans_date_trans_time" in kayitlar.columns:
            kayitlar["trans_date_trans_time"] = kayitlar[
                "trans_date_trans_time"
            ].astype(str)
        if "created_at" in kayitlar.columns:
            kayitlar["created_at"] = kayitlar["created_at"].astype(str)
        if "is_fraud" in kayitlar.columns:
            kayitlar["is_fraud"] = kayitlar["is_fraud"].fillna(False).astype(bool)

        # NaN/NaT değerleri JSON uyumlu null'a çevir
        records = json.loads(kayitlar.to_json(orient="records", date_format="iso"))
        return {"basarili": True, "veri": records}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/mcc-dagilim/{user_id}")
async def mcc_dagilim(user_id: str):
    try:
        df = _fetch_transactions_df(user_id)
        if df.empty:
            return {"basarili": True, "veri": []}

        mcc_col = (
            "mcc_aciklama"
            if "mcc_aciklama" in df.columns and df["mcc_aciklama"].notna().any()
            else "category"
        )
        grouped = (
            df.groupby(mcc_col)["amt"]
            .sum()
            .reset_index()
            .sort_values("amt", ascending=False)
        )
        grouped.columns = ["mcc", "toplam"]
        grouped["mcc"] = grouped["mcc"].fillna("Bilinmiyor").astype(str)
        grouped["toplam"] = grouped["toplam"].round(2)

        return {
            "basarili": True,
            "veri": grouped.to_dict("records"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/fraud-ozet/{user_id}")
async def fraud_ozet(user_id: str):
    try:
        df = _fetch_transactions_df(user_id)
        if df.empty:
            return {"basarili": True, "veri": empty_fraud_ozet()}

        if "is_fraud" not in df.columns:
            return {
                "basarili": True,
                "veri": {
                    "riskli_islem": 0,
                    "degisim_yuzde": 0.0,
                    "toplam_islem": int(len(df)),
                },
            }

        fraud_df = df.copy()
        fraud_df["is_fraud"] = fraud_df["is_fraud"].fillna(False).astype(bool)
        riskli_toplam = int(fraud_df["is_fraud"].sum())

        degisim = 0.0
        if "ay_periyot" in fraud_df.columns:
            aylar = sorted(fraud_df["ay_periyot"].dropna().unique())
            if len(aylar) >= 2:
                son_ay, onceki_ay = aylar[-1], aylar[-2]
                son_risk = int(
                    fraud_df[
                        (fraud_df["ay_periyot"] == son_ay) & fraud_df["is_fraud"]
                    ].shape[0]
                )
                onceki_risk = int(
                    fraud_df[
                        (fraud_df["ay_periyot"] == onceki_ay) & fraud_df["is_fraud"]
                    ].shape[0]
                )
                if onceki_risk > 0:
                    degisim = round(
                        ((son_risk - onceki_risk) / onceki_risk) * 100, 1
                    )
                elif son_risk > 0:
                    degisim = 100.0

        return {
            "basarili": True,
            "veri": {
                "riskli_islem": riskli_toplam,
                "degisim_yuzde": degisim,
                "toplam_islem": int(len(df)),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 7 — BÜTÇE LİMİT KONTROLÜ
# ============================================================

@app.post("/butce-kontrol")
async def butce_kontrol(giris: BudgetGirisi):
    try:
        df = _fetch_transactions_df(giris.user_id)
        kullanici = df

        if kullanici.empty:
            return {
                "basarili": True,
                "veri": {
                    "user_id": giris.user_id,
                    "kategori": giris.kategori,
                    "limit": giris.limit,
                    "harcanan": 0.0,
                    "asim": 0,
                    "asim_yuzde": 0,
                    "uyari": False,
                    "mesaj": "Bu kullanıcı için işlem kaydı bulunamadı.",
                },
            }

        son_ay = kullanici['ay_periyot'].max()
        son_ay_kat = kullanici[
            (kullanici['ay_periyot'] == son_ay) &
            (kullanici['category'] == giris.kategori)
        ]['amt'].sum()

        asim = son_ay_kat - giris.limit
        asim_yuzde = (asim / giris.limit) * 100

        return {
            'basarili': True,
            'veri': {
                'user_id': giris.user_id,
                'kategori': giris.kategori,
                'limit': giris.limit,
                'harcanan': round(son_ay_kat, 2),
                'asim': round(asim, 2) if asim > 0 else 0,
                'asim_yuzde': round(asim_yuzde, 2) if asim > 0 else 0,
                'uyari': asim > 0,
                'mesaj': (
                    f"{giris.kategori} kategorisinde limitinizi {round(asim, 2)} TL aştınız!"
                    if asim > 0 else
                    f"{giris.kategori} kategorisinde limitiniz dahilindekisiniz."
                )
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 7b — BÜTÇE HEDEFİ (budget_goals)
# ============================================================

@app.post("/butce-ayarla")
async def butce_ayarla(giris: ButceAyarlaGirisi):
    """Kullanıcı bütçe limitini budget_goals tablosuna kaydeder (upsert)."""
    try:
        owner_id = _normalize_user_id(giris.owner_id)
        if not _is_uuid(owner_id):
            raise HTTPException(
                status_code=400,
                detail="owner_id geçerli bir UUID olmalıdır.",
            )

        kategori = giris.kategori.strip()
        ay_periyot = current_month_period()

        payload = {
            "owner_id": owner_id,
            "category": kategori,
            "month_period": ay_periyot,
            "monthly_limit": round(giris.limit_tutar, 2),
            "warning_threshold_pct": 80,
            "updated_at": datetime.utcnow().isoformat(),
        }

        sonuc = (
            supabase.table("budget_goals")
            .upsert(payload, on_conflict="owner_id,category,month_period")
            .execute()
        )
        kayit = (sonuc.data or [{}])[0]

        return {
            "basarili": True,
            "mesaj": (
                f"{kategori} kategorisi için "
                f"{giris.limit_tutar:,.0f} ₺ aylık bütçe kaydedildi."
            ),
            "veri": budget_record_to_dict(kayit),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/butce/{user_id}")
async def butce_getir(user_id: str):
    """Kullanıcının bu aya ait bütçe hedeflerini ve harcama özetini döner."""
    try:
        owner_id = _normalize_user_id(user_id)
        ay_periyot = current_month_period()

        butce_sonuc = (
            supabase.table("budget_goals")
            .select(
                "id,owner_id,category,month_period,monthly_limit,warning_threshold_pct"
            )
            .eq("owner_id", owner_id)
            .eq("month_period", ay_periyot)
            .execute()
        )
        butceler = [
            budget_record_to_dict(row) for row in (butce_sonuc.data or [])
        ]

        df = _fetch_transactions_df(owner_id)
        bu_ay_toplam = spending_for_month(df, ay_periyot, category="genel")
        kategori_harcamalari = category_spending_map(df, ay_periyot)

        return {
            "basarili": True,
            "veri": {
                "owner_id": owner_id,
                "ay_periyot": ay_periyot,
                "butceler": butceler,
                "bu_ay_toplam_harcama": bu_ay_toplam,
                "kategori_harcamalari": kategori_harcamalari,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 8 — KONUM ANALİZİ
# ============================================================

@app.get("/konum-analizi")
async def konum_analizi(user_id: str, ilce: str = None, kategori: str = None):
    """
    Mahalle bazlı kategori analizi.
    İlçe ve kategori filtresi uygulanabilir.
    Örnek: /konum-analizi?ilce=Çiğli&kategori=grocery_pos
    """
    try:
        df = _fetch_transactions_df(user_id)
        if df.empty:
            return {
                "basarili": True,
                "veri": {
                    "toplam_mahalle": 0,
                    "filtre": {"ilce": ilce, "kategori": kategori},
                    "mahalle_listesi": [],
                    "kategori_dagilimi": {},
                },
            }

        konum_df = df.copy()
        if ilce:
            konum_df = konum_df[konum_df['tr_ilce'] == ilce]
        if kategori:
            konum_df = konum_df[konum_df['category'] == kategori]

        if len(konum_df) == 0:
            return {
                "basarili": True,
                "veri": {
                    "toplam_mahalle": 0,
                    "filtre": {"ilce": ilce, "kategori": kategori},
                    "mahalle_listesi": [],
                    "kategori_dagilimi": {},
                },
            }

        mahalle_ozet = konum_df.groupby(
            ['tr_ilce', 'tr_mahalle', 'tr_lat', 'tr_long']
        ).agg(
            toplam_islem=('id', 'count'),
            toplam_harcama=('amt', 'sum'),
            en_cok_kategori=('category', lambda x: x.mode().iloc[0] if not x.mode().empty else None)
        ).reset_index()

        sonuc = {
            'toplam_mahalle': len(mahalle_ozet),
            'filtre': {
                'ilce': ilce,
                'kategori': kategori
            },
            'mahalle_listesi': mahalle_ozet.to_dict('records'),
            'kategori_dagilimi': konum_df.groupby(
                'category'
            )['id'].count().sort_values(
                ascending=False
            ).to_dict()
        }

        return {'basarili': True, 'veri': sonuc}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 9 — MCC KOD ANALİZİ
# ============================================================

@app.get("/mcc/{mcc_kodu}")
async def mcc_analizi(mcc_kodu: int, user_id: str):
    """
    MCC koduna göre işlem analizi.
    Örnek: /mcc/5411 → Market işlemleri
    """
    try:
        from app.utils import mcc_analizi_getir
        veriler_db = _build_veriler_with_db_df(user_id)
        if veriler_db["df"].empty:
            return {
                "basarili": True,
                "veri": {"mesaj": f"Kullanıcı {user_id} için işlem verisi yok."},
            }
        sonuc = mcc_analizi_getir(mcc_kodu, veriler_db)

        if sonuc is None:
            return {
                "basarili": True,
                "veri": {"mesaj": f"MCC kodu {mcc_kodu} bulunamadı"},
            }

        return {"basarili": True, "veri": sonuc}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))