import argparse
import math
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client


def parse_args():
    parser = argparse.ArgumentParser(description="temiz_veri.csv dosyasini Supabase transactions tablosuna aktarir.")
    parser.add_argument("--owner-id", required=True, help="Auth kullanici UUID degeri")
    parser.add_argument(
        "--csv-path",
        default=str(Path(__file__).resolve().parents[1] / "temiz_veri.csv"),
        help="Aktarilacak CSV dosya yolu",
    )
    parser.add_argument("--chunk-size", type=int, default=5000, help="CSV okuma chunk boyutu")
    parser.add_argument("--batch-size", type=int, default=500, help="Supabase insert batch boyutu")
    parser.add_argument(
        "--truncate-first",
        action="store_true",
        help="Import oncesi owner_id'ye ait tum transactions satirlarini siler",
    )
    return parser.parse_args()


def normalize_value(value):
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if pd.isna(value):
        return None
    return value


def row_to_payload(row, owner_id: str):
    ay_periyot_raw = normalize_value(row.get("ay_periyot"))
    ay_periyot = None
    if ay_periyot_raw:
        ay_periyot = f"{str(ay_periyot_raw)}-01"

    return {
        "owner_id": owner_id,
        "trans_date_trans_time": normalize_value(row.get("trans_date_trans_time")),
        "merchant": normalize_value(row.get("merchant")),
        "category": normalize_value(row.get("category")),
        "amt": normalize_value(row.get("amt")),
        "gender": normalize_value(row.get("gender")),
        "city": normalize_value(row.get("city")),
        "state": normalize_value(row.get("state")),
        "lat": normalize_value(row.get("lat")),
        "long": normalize_value(row.get("long")),
        "city_pop": normalize_value(row.get("city_pop")),
        "job": normalize_value(row.get("job")),
        "merch_lat": normalize_value(row.get("merch_lat")),
        "merch_long": normalize_value(row.get("merch_long")),
        "is_fraud": bool(row.get("is_fraud")) if normalize_value(row.get("is_fraud")) is not None else None,
        "merch_zipcode": str(row.get("merch_zipcode")) if normalize_value(row.get("merch_zipcode")) is not None else None,
        "source_user_id": normalize_value(row.get("user_id")),
        "yil": normalize_value(row.get("yil")),
        "ay": normalize_value(row.get("ay")),
        "gun": normalize_value(row.get("gun")),
        "saat": normalize_value(row.get("saat")),
        "haftanin_gunu": normalize_value(row.get("haftanin_gunu")),
        "hafta_sonu": bool(row.get("hafta_sonu")) if normalize_value(row.get("hafta_sonu")) is not None else None,
        "ay_periyot": ay_periyot,
        "mesafe_km": normalize_value(row.get("mesafe_km")),
        "kullanici_ort": normalize_value(row.get("kullanici_ort")),
        "kullanici_std": normalize_value(row.get("kullanici_std")),
        "kullanici_toplam": normalize_value(row.get("kullanici_toplam")),
        "kullanici_islem_sayisi": normalize_value(row.get("kullanici_islem_sayisi")),
        "harcama_zscore": normalize_value(row.get("harcama_zscore")),
        "aylik_toplam": normalize_value(row.get("aylik_toplam")),
        "karbon_katsayisi": normalize_value(row.get("karbon_katsayisi")),
        "karbon_kgco2": normalize_value(row.get("karbon_kgco2")),
        "category_enc": normalize_value(row.get("category_enc")),
        "gender_enc": normalize_value(row.get("gender_enc")),
        "state_enc": normalize_value(row.get("state_enc")),
        "yas": normalize_value(row.get("yas")),
        "mcc_kodu": normalize_value(row.get("mcc_kodu")),
        "mcc_aciklama": normalize_value(row.get("mcc_aciklama")),
        "tr_sehir": normalize_value(row.get("tr_sehir")),
        "tr_ilce": normalize_value(row.get("tr_ilce")),
        "tr_mahalle": normalize_value(row.get("tr_mahalle")),
        "tr_lat": normalize_value(row.get("tr_lat")),
        "tr_long": normalize_value(row.get("tr_long")),
    }


def main():
    args = parse_args()
    load_dotenv()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL ve SUPABASE_SERVICE_KEY (veya SUPABASE_KEY) tanimli olmali.")

    csv_path = Path(args.csv_path)
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV dosyasi bulunamadi: {csv_path}")

    client = create_client(supabase_url, supabase_key)

    if args.truncate_first:
        client.table("transactions").delete().eq("owner_id", args.owner_id).execute()
        print(f"Temizlendi: owner_id={args.owner_id}")

    toplam = 0
    for chunk in pd.read_csv(csv_path, chunksize=args.chunk_size, nrows=3000):
        kayitlar = [row_to_payload(row, args.owner_id) for row in chunk.to_dict(orient="records")]
        for i in range(0, len(kayitlar), args.batch_size):
            batch = kayitlar[i:i + args.batch_size]
            client.table("transactions").insert(batch).execute()
            toplam += len(batch)
            print(f"Yuklenen satir: {toplam}")

    print(f"Import tamamlandi. Toplam satir: {toplam}")


if __name__ == "__main__":
    main()
