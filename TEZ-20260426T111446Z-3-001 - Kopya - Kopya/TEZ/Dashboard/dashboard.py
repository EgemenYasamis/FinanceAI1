import html
import warnings

import folium
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import requests
import streamlit as st
from streamlit_folium import st_folium

warnings.filterwarnings("ignore")

API_URL = "http://127.0.0.1:8000"

NAV_OPTIONS = ["Ana Panel", "İşlemler", "Konum Analizi", "Karbon Ayak İzi"]

NAV_ICONS = {
    "Ana Panel": "fa-solid fa-chart-line",
    "İşlemler": "fa-solid fa-exchange-alt",
    "Konum Analizi": "fa-solid fa-map-marked-alt",
    "Karbon Ayak İzi": "fa-solid fa-leaf",
}

NAV_TO_PAGE = {
    "Ana Panel": "Harcama Paneli",
    "İşlemler": "Islem Sorgula",
    "Konum Analizi": "Konum Analizi",
    "Karbon Ayak İzi": "Karbon Ayak Izi",
}

KATEGORI_TR = {
    "grocery_pos": "Market (Fiziksel)",
    "grocery_net": "Market (Online)",
    "gas_transport": "Akaryakit / Ulasim",
    "food_dining": "Yeme Ime",
    "shopping_pos": "Alisveris (Fiziksel)",
    "shopping_net": "Alisveris (Online)",
    "entertainment": "Eglence",
    "health_fitness": "Saglik / Spor",
    "personal_care": "Kisisel Bakim",
    "home": "Ev Urunleri",
    "kids_pets": "Cocuk / Evcil Hayvan",
    "travel": "Seyahat",
    "misc_pos": "Diger (Fiziksel)",
    "misc_net": "Diger (Online)",
}


def kat_tr(kategori: str) -> str:
    return KATEGORI_TR.get(kategori, kategori)


def inject_theme_css(is_dark: bool):
    if is_dark:
        bg, card, text = "#0f172a", "#1e293b", "#f8fafc"
        border = "#334155"
        sidebar_bg = "#0b1220"
        input_bg = "#1e293b"
        input_border = "rgba(124, 58, 237, 0.3)"
        input_text = "#f8fafc"
    else:
        bg, card, text = "#f1f5f9", "#ffffff", "#0f172a"
        border = "#e2e8f0"
        sidebar_bg = "#ffffff"
        input_bg = "#ffffff"
        input_border = "#e2e8f0"
        input_text = "#0f172a"
    accent = "#7c3aed"

    st.markdown(
        """
        <link rel="stylesheet"
              href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
              crossorigin="anonymous"
              referrerpolicy="no-referrer" />
        """,
        unsafe_allow_html=True,
    )

    st.markdown(
        f"""
        <style>
        :root {{
            --bg-primary: {bg};
            --bg-card: {card};
            --text-primary: {text};
            --accent: {accent};
            --border: {border};
            --sidebar-bg: {sidebar_bg};
            --input-bg: {input_bg};
            --input-border: {input_border};
            --input-text: {input_text};
        }}

        #MainMenu {{ display: none !important; }}
        header {{ display: none !important; }}
        footer {{ display: none !important; }}
        .stDeployButton {{ display: none !important; }}

        .stApp {{
            background-color: var(--bg-primary);
            color: var(--text-primary);
        }}

        [data-testid="stAppViewContainer"] > .main {{
            background-color: var(--bg-primary);
        }}

        [data-testid="stAppViewContainer"] > .main .block-container {{
            padding-top: 0 !important;
            padding-bottom: 2rem;
            max-width: 100%;
        }}

        [data-testid="stSidebar"] {{
            background-color: var(--sidebar-bg) !important;
            border-right: 1px solid var(--border);
        }}

        [data-testid="stSidebar"] [data-testid="stMarkdownContainer"] h1,
        [data-testid="stSidebar"] [data-testid="stMarkdownContainer"] h2,
        [data-testid="stSidebar"] [data-testid="stMarkdownContainer"] h3,
        [data-testid="stSidebar"] label,
        [data-testid="stSidebar"] p,
        [data-testid="stSidebar"] span {{
            color: var(--text-primary) !important;
        }}

        h1, h2, h3, h4, h5, h6, p, label, span, div {{
            color: var(--text-primary);
        }}

        [data-testid="stMetric"] {{
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1rem 1.25rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }}

        [data-testid="stMetric"] label {{
            color: var(--text-primary) !important;
            opacity: 0.75;
        }}

        [data-testid="stMetric"] [data-testid="stMetricValue"] {{
            color: var(--accent) !important;
        }}

        div[data-testid="stVerticalBlock"] > div[data-testid="stVerticalBlockBorderWrapper"] {{
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 0.5rem;
        }}

        .stButton > button,
        .stFormSubmitButton > button,
        button[kind="primary"],
        button[data-testid="baseButton-primary"] {{
            background-color: var(--accent) !important;
            color: #ffffff !important;
            border: none !important;
            border-radius: 10px !important;
            font-weight: 600 !important;
        }}

        .stButton > button:hover,
        .stFormSubmitButton > button:hover,
        button[kind="primary"]:hover {{
            background-color: #6d28d9 !important;
            color: #ffffff !important;
            box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4) !important;
        }}

        button[data-testid="baseButton-primary"] {{
            min-height: 3rem !important;
            font-size: 1.05rem !important;
            letter-spacing: 0.02em !important;
        }}

        [data-testid="stTextInput"] [data-baseweb="input"],
        [data-testid="stNumberInput"] [data-baseweb="input"],
        [data-testid="stSelectbox"] [data-baseweb="select"] {{
            background-color: var(--input-bg) !important;
        }}

        /* Sidebar — interaktif navigasyon (st.radio) */
        [data-testid="stSidebar"] div[data-baseweb="radio"] {{
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            gap: 0.35rem !important;
        }}

        [data-testid="stSidebar"] div[data-baseweb="radio"] > div {{
            display: flex !important;
            flex-direction: column !important;
            gap: 0.4rem !important;
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
        }}

        [data-testid="stSidebar"] div[data-baseweb="radio"] label {{
            display: flex !important;
            align-items: center !important;
            gap: 0.75rem !important;
            margin: 0 !important;
            padding: 0.72rem 0.85rem 0.72rem 1rem !important;
            border-radius: 10px !important;
            border: 1px solid transparent !important;
            border-left: 3px solid transparent !important;
            background: transparent !important;
            color: var(--text-primary) !important;
            font-weight: 500 !important;
            font-size: 0.95rem !important;
            cursor: pointer !important;
            position: relative !important;
            transition: all 0.3s ease !important;
            transform-origin: left center !important;
        }}

        [data-testid="stSidebar"] div[data-baseweb="radio"] label:hover {{
            transform: scale(1.05) !important;
            background: rgba(124, 58, 237, 0.1) !important;
            border-color: rgba(124, 58, 237, 0.12) !important;
        }}

        [data-testid="stSidebar"] div[data-baseweb="radio"] label:has(input:checked) {{
            transform: scale(1.02) !important;
            background: rgba(124, 58, 237, 0.14) !important;
            border-left-color: var(--accent) !important;
            border-color: rgba(124, 58, 237, 0.22) !important;
            font-weight: 600 !important;
            box-shadow: 0 2px 12px rgba(124, 58, 237, 0.15) !important;
        }}

        [data-testid="stSidebar"] div[data-baseweb="radio"] label input[type="radio"],
        [data-testid="stSidebar"] div[data-baseweb="radio"] label [data-baseweb="radio"],
        [data-testid="stSidebar"] div[data-baseweb="radio"] label > div:first-child {{
            display: none !important;
        }}

        [data-testid="stSidebar"] div[data-baseweb="radio"] label > div:last-child {{
            display: flex !important;
            align-items: center !important;
            gap: 0.75rem !important;
            padding: 0 !important;
            margin: 0 !important;
        }}

        [data-testid="stSidebar"] div[data-baseweb="radio"] label > div:last-child::before {{
            font-family: "Font Awesome 6 Free" !important;
            font-weight: 900 !important;
            font-size: 1.05rem !important;
            width: 1.35rem !important;
            text-align: center !important;
            color: var(--text-primary) !important;
            opacity: 0.72 !important;
            transition: all 0.3s ease !important;
        }}

        [data-testid="stSidebar"] div[data-baseweb="radio"] label:hover > div:last-child::before {{
            opacity: 0.95 !important;
            color: var(--accent) !important;
        }}

        [data-testid="stSidebar"] div[data-baseweb="radio"] label:has(input:checked) > div:last-child::before {{
            color: var(--accent) !important;
            opacity: 1 !important;
            transform: scale(1.12) !important;
        }}

        [data-testid="stSidebar"] div[data-baseweb="radio"] > div > label:nth-child(1) > div:last-child::before {{
            content: "\\f201" !important;
        }}

        [data-testid="stSidebar"] div[data-baseweb="radio"] > div > label:nth-child(2) > div:last-child::before {{
            content: "\\f362" !important;
        }}

        [data-testid="stSidebar"] div[data-baseweb="radio"] > div > label:nth-child(3) > div:last-child::before {{
            content: "\\f5a0" !important;
        }}

        [data-testid="stSidebar"] div[data-baseweb="radio"] > div > label:nth-child(4) > div:last-child::before {{
            content: "\\f06c" !important;
        }}

        [data-testid="stSidebar"] div[data-baseweb="radio"] label:has(input:checked) > div:last-child {{
            color: var(--accent) !important;
        }}

        .sidebar-nav-heading {{
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--text-primary);
            opacity: 0.45;
            margin: 0.25rem 0 0.65rem 0.35rem;
        }}

        .stTabs [data-baseweb="tab-list"] {{
            gap: 8px;
        }}

        .stTabs [data-baseweb="tab"] {{
            color: var(--text-primary);
            border-radius: 8px 8px 0 0;
        }}

        .stTabs [aria-selected="true"] {{
            color: var(--accent) !important;
            border-bottom-color: var(--accent) !important;
        }}

        .stDataFrame, [data-testid="stDataFrame"] {{
            border-radius: 12px;
            overflow: hidden;
        }}

        .financeai-brand {{
            font-size: 1.5rem;
            font-weight: 800;
            color: var(--accent);
            letter-spacing: -0.02em;
            margin-bottom: 0.25rem;
        }}

        .financeai-sub {{
            font-size: 0.8rem;
            color: var(--text-primary);
            opacity: 0.65;
            margin-bottom: 1rem;
        }}

        .sidebar-footer {{
            margin-top: auto;
            padding-top: 1rem;
            border-top: 1px solid var(--border);
        }}

        /* Form elemanlari — tema duyarli */
        [data-baseweb="input"] > div,
        [data-baseweb="input"] > div > div {{
            background-color: var(--input-bg) !important;
            border-color: var(--input-border) !important;
            border-radius: 8px !important;
        }}

        [data-baseweb="input"] input,
        [data-baseweb="textarea"] textarea {{
            color: var(--input-text) !important;
            background-color: transparent !important;
            -webkit-text-fill-color: var(--input-text) !important;
        }}

        [data-baseweb="select"] > div,
        [data-baseweb="select"] > div > div {{
            background-color: var(--input-bg) !important;
            border-color: var(--input-border) !important;
            border-radius: 8px !important;
        }}

        [data-baseweb="select"] span,
        [data-baseweb="select"] div[value] {{
            color: var(--input-text) !important;
        }}

        [data-baseweb="popover"] [role="listbox"],
        [data-baseweb="popover"] ul {{
            background-color: var(--input-bg) !important;
            border-color: var(--input-border) !important;
        }}

        [data-baseweb="popover"] li {{
            color: var(--input-text) !important;
        }}

        [data-baseweb="popover"] li:hover,
        [data-baseweb="popover"] li[aria-selected="true"] {{
            background-color: rgba(124, 58, 237, 0.15) !important;
            color: var(--accent) !important;
        }}

        .stNumberInput [data-baseweb="input"] > div {{
            background-color: var(--input-bg) !important;
            border-color: var(--input-border) !important;
        }}

        .stTextInput label,
        .stNumberInput label,
        .stSelectbox label,
        .stSlider label {{
            color: var(--text-primary) !important;
        }}

        [data-baseweb="input"]:focus-within,
        [data-baseweb="select"]:focus-within,
        [data-baseweb="input"]:hover,
        [data-baseweb="select"]:hover {{
            border-color: var(--accent) !important;
            box-shadow: 0 0 0 1px var(--accent) !important;
        }}

        /* Slider — mor aksan */
        .stSlider [data-baseweb="slider"] div[data-testid="stThumbValue"] {{
            color: var(--accent) !important;
        }}

        .stSlider [data-baseweb="slider"] > div > div:nth-child(2) > div {{
            background: var(--accent) !important;
        }}

        .stSlider [data-baseweb="slider"] [role="slider"] {{
            background: var(--accent) !important;
            border-color: var(--accent) !important;
        }}

        .stSlider [data-baseweb="slider"] > div > div:first-child > div {{
            background: var(--input-border) !important;
        }}

        /* Checkbox / toggle odak */
        .stCheckbox [data-baseweb="checkbox"] svg,
        [data-baseweb="toggle"] [aria-checked="true"] {{
            background-color: var(--accent) !important;
        }}

        /* Streamlit kirmizi aksanlari ez */
        a {{
            color: var(--accent) !important;
        }}

        .stAlert [data-testid="stMarkdownContainer"] {{
            color: var(--text-primary);
        }}

        /* Islem sonuc kartlari */
        .islem-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-bottom: 1rem;
        }}

        .islem-card {{
            background: {"rgba(30, 41, 59, 0.55)" if is_dark else "rgba(255, 255, 255, 0.85)"};
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1.25rem 1rem;
            min-height: 100px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            box-shadow: 0 4px 14px rgba(0, 0, 0, {"0.25" if is_dark else "0.06"});
        }}

        .islem-card-label {{
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--accent);
            margin-bottom: 0.5rem;
            opacity: 0.9;
        }}

        .islem-card-value {{
            font-size: 1.15rem;
            font-weight: 700;
            color: var(--text-primary);
            line-height: 1.3;
        }}

        .islem-status-box {{
            border-radius: 12px;
            padding: 1rem 1.25rem;
            font-size: 0.95rem;
            font-weight: 600;
            text-align: center;
            width: 100%;
            box-sizing: border-box;
        }}

        .islem-status-normal {{
            background: rgba(16, 185, 129, 0.18);
            border: 1px solid rgba(16, 185, 129, 0.45);
            color: #10b981;
        }}

        .islem-status-risk {{
            background: rgba(239, 68, 68, 0.18);
            border: 1px solid rgba(239, 68, 68, 0.45);
            color: #ef4444;
        }}

        .islem-status-pending {{
            background: {"rgba(124, 58, 237, 0.12)" if is_dark else "rgba(124, 58, 237, 0.08)"};
            border: 1px solid var(--input-border);
            color: var(--text-primary);
            opacity: 0.85;
        }}

        .islem-panel-title {{
            font-size: 1.1rem;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 1rem;
        }}

        /* Ana Panel metrik kartlari */
        .dash-metric-card {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 1.25rem 1.35rem;
            min-height: 148px;
            position: relative;
            box-shadow: 0 8px 24px rgba(0, 0, 0, {"0.28" if is_dark else "0.07"});
            display: flex;
            flex-direction: column;
        }}

        .dash-metric-title {{
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--text-primary);
            opacity: 0.72;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-bottom: 0.5rem;
        }}

        .dash-metric-value {{
            font-size: clamp(1.5rem, 2.4vw, 2.1rem);
            font-weight: 800;
            color: var(--text-primary);
            line-height: 1.15;
            flex: 1;
            display: flex;
            align-items: center;
            margin: 0.35rem 0 1.75rem 0;
        }}

        .dash-metric-trend {{
            position: absolute;
            right: 1.1rem;
            bottom: 1rem;
            font-size: 0.82rem;
            font-weight: 700;
            padding: 0.2rem 0.55rem;
            border-radius: 6px;
        }}

        .dash-trend-up {{
            color: #10b981;
            background: rgba(16, 185, 129, 0.14);
        }}

        .dash-trend-down {{
            color: #ef4444;
            background: rgba(239, 68, 68, 0.14);
        }}

        .dash-trend-neutral {{
            color: var(--text-primary);
            opacity: 0.6;
            background: transparent;
        }}

        .dash-section-title {{
            font-size: 1.05rem;
            font-weight: 700;
            color: var(--text-primary);
            margin: 1.5rem 0 0.75rem 0;
        }}

        [data-testid="stDataFrame"] div[data-testid="stDataFrameResizable"] {{
            background: var(--bg-card) !important;
            border: 1px solid var(--border);
            border-radius: 12px;
        }}

        [data-testid="stDataFrame"] th {{
            background: {"#1e293b" if is_dark else "#f8fafc"} !important;
            color: var(--text-primary) !important;
        }}

        [data-testid="stDataFrame"] td {{
            color: var(--text-primary) !important;
        }}
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_analiz_sonuc_panel(sonuc: dict | None, bolge: str):
    if sonuc:
        kategori = html.escape(kat_tr(sonuc.get("kategori", "-")))
        karbon = html.escape(f"{sonuc.get('karbon_kgco2', 0):.2f} kg")
        bolge_val = html.escape(str(bolge))
        fraud_val = html.escape(f"%{sonuc.get('fraud_olasilik', 0):.1f}")
        is_fraud = bool(sonuc.get("fraud"))
        mesaj = html.escape(
            sonuc.get("fraud_mesaj", "Şüpheli İşlem" if is_fraud else "Normal İşlem")
        )
        status_class = "islem-status-risk" if is_fraud else "islem-status-normal"
        status_text = f"⚠ {mesaj}" if is_fraud else f"✓ {mesaj}"
    else:
        kategori = karbon = bolge_val = fraud_val = "—"
        status_class = "islem-status-pending"
        status_text = html.escape(
            "Sol taraftan işlem bilgilerini girip Analiz Et'e basın."
        )

    st.markdown(
        f"""
        <p class="islem-panel-title">Analiz Sonuçları</p>
        <div class="islem-grid">
            <div class="islem-card">
                <div class="islem-card-label">Kategori</div>
                <div class="islem-card-value">{kategori}</div>
            </div>
            <div class="islem-card">
                <div class="islem-card-label">Karbon</div>
                <div class="islem-card-value">{karbon}</div>
            </div>
            <div class="islem-card">
                <div class="islem-card-label">Bölge</div>
                <div class="islem-card-value">{bolge_val}</div>
            </div>
            <div class="islem-card">
                <div class="islem-card-label">Fraud Olasılığı</div>
                <div class="islem-card-value">{fraud_val}</div>
            </div>
        </div>
        <div class="islem-status-box {status_class}">{status_text}</div>
        """,
        unsafe_allow_html=True,
    )


def render_islemler_sayfasi(user_id):
    st.title("İşlemler")
    st.caption("Fraud, kategori ve karbon etkisi analizi")

    col_form, col_sonuc = st.columns([1, 1])

    with col_form:
        merchant = st.text_input("Satıcı Adı", key="islem_merchant", placeholder="Örn: Migros")
        col_tutar, col_saat = st.columns(2)
        with col_tutar:
            tutar = st.number_input("Tutar (TL)", min_value=1.0, value=100.0, key="islem_tutar")
        with col_saat:
            saat = st.number_input("İşlem Saati", min_value=0, max_value=23, value=14, key="islem_saat")
        bolge = st.text_input(
            "Alışveriş Bölgesi",
            key="islem_bolge",
            placeholder="Örn: Halkapınar, Buca Merkez",
        )
        analiz_tiklandi = st.button(
            "Analiz Et",
            use_container_width=True,
            type="primary",
            key="islem_analiz_btn",
        )

        if analiz_tiklandi:
            if not merchant or not merchant.strip():
                st.warning("Lütfen satıcı adı girin.")
            elif not bolge or not bolge.strip():
                st.warning("Lütfen alışveriş bölgesi girin.")
            else:
                sonuc = fraud_kontrol_et(
                    user_id, merchant.strip(), tutar, saat, bolge.strip()
                )
                if sonuc:
                    st.session_state.islem_sonuc = sonuc
                    st.session_state.islem_sonuc_bolge = bolge

    with col_sonuc:
        sonuc = st.session_state.get("islem_sonuc")
        bolge_goster = st.session_state.get("islem_sonuc_bolge", "—")
        render_analiz_sonuc_panel(sonuc, bolge_goster)


def render_sidebar_shell(user_email: str, user_id) -> str:
    with st.sidebar:
        st.markdown(
            '<p class="financeai-brand">💜 FinanceAI</p>',
            unsafe_allow_html=True,
        )
        st.markdown(
            '<p class="financeai-sub">Kişisel Finans Asistanı</p>',
            unsafe_allow_html=True,
        )
        st.markdown("---")
        st.markdown(
            '<p class="sidebar-nav-heading">Menü</p>',
            unsafe_allow_html=True,
        )

        sayfa_label = st.radio(
            "Navigasyon",
            NAV_OPTIONS,
            label_visibility="collapsed",
            key="nav_page",
        )

        st.markdown("---")
        st.caption(f"Giriş: {user_email}")
        st.caption(f"Kullanıcı ID: {user_id}")

        if st.button("Çıkış Yap", use_container_width=True):
            for key in [
                "is_authenticated",
                "access_token",
                "auth_session",
                "auth_user",
                "user_id",
                "auth_error",
                "islem_sonuc",
                "islem_sonuc_bolge",
            ]:
                if key == "is_authenticated":
                    st.session_state[key] = False
                else:
                    st.session_state[key] = None
            st.cache_data.clear()
            st.rerun()

        st.markdown('<div class="sidebar-footer"></div>', unsafe_allow_html=True)
        st.toggle(
            "Gece Modu",
            value=st.session_state.get("dark_mode", True),
            key="dark_mode",
        )

    return NAV_TO_PAGE[sayfa_label]


def init_state():
    defaults = {
        "is_authenticated": False,
        "access_token": None,
        "auth_session": None,
        "auth_user": None,
        "user_id": None,
        "auth_error": None,
        "dark_mode": True,
        "islem_sonuc": None,
        "islem_sonuc_bolge": None,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def _format_http_error(resp: requests.Response) -> str:
    try:
        payload = resp.json()
        detail = payload.get("detail", payload)
    except Exception:
        detail = resp.text or "Bilinmeyen hata"
    return f"HTTP {resp.status_code}: {detail}"


def _auth_post(url: str, email: str, password: str):
    try:
        resp = requests.post(
            url,
            json={"email": email, "password": password},
            timeout=10,
        )
    except requests.RequestException as exc:
        return False, None, f"Baglanti hatasi: {exc}"

    if not resp.ok:
        return False, None, _format_http_error(resp)

    try:
        return True, resp.json(), None
    except Exception:
        return False, None, "API JSON donmuyor."


def register_user(email: str, password: str):
    return _auth_post("http://127.0.0.1:8000/register", email, password)


def login_user(email: str, password: str):
    return _auth_post("http://127.0.0.1:8000/login", email, password)


def extract_user_id(auth_payload: dict):
    session = auth_payload.get("session") or {}
    user = session.get("user") or auth_payload.get("user") or {}

    # Oncelik: user_metadata icinde uygulama user id varsa onu kullan.
    metadata = user.get("user_metadata") or {}
    candidate = metadata.get("user_id", user.get("id"))

    if candidate is None:
        return None

    # Auth UUID string olarak kalmalı (backend owner_id uuid sütununda arar).
    if isinstance(candidate, int):
        return str(candidate)
    if isinstance(candidate, str):
        return candidate.strip()
    return str(candidate)


def auth_headers():
    token = st.session_state.get("access_token")
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


def _api_get_veri(path: str, params: dict | None = None):
    url = f"{API_URL.rstrip('/')}/{path.lstrip('/')}"
    resp = requests.get(
        url,
        params=params,
        headers=auth_headers(),
        timeout=10,
    )
    if not resp.ok:
        raise RuntimeError(_format_http_error(resp))

    body = resp.json()
    if not isinstance(body, dict) or "veri" not in body:
        raise RuntimeError(f"Beklenmeyen API yaniti: {path}")
    return body["veri"]


@st.cache_data(ttl=300, show_spinner=False)
def kullanici_bilgisi_getir(user_id):
    return _api_get_veri(f"/kullanici/{user_id}")


@st.cache_data(ttl=300, show_spinner=False)
def ozet_getir(user_id):
    return _api_get_veri(f"/ozet/{user_id}")


@st.cache_data(ttl=300, show_spinner=False)
def tahmin_getir(user_id):
    return _api_get_veri(f"/tahmin/{user_id}")


@st.cache_data(ttl=300, show_spinner=False)
def oneri_getir(user_id):
    return _api_get_veri(f"/oneri/{user_id}")


@st.cache_data(ttl=300, show_spinner=False)
def karbon_getir(user_id):
    return _api_get_veri(f"/karbon/{user_id}")


@st.cache_data(ttl=300, show_spinner=False)
def son_islemler_getir(user_id, limit: int = 20):
    return _api_get_veri(f"/son-islemler/{user_id}", params={"limit": limit})


@st.cache_data(ttl=300, show_spinner=False)
def mcc_dagilim_getir(user_id):
    return _api_get_veri(f"/mcc-dagilim/{user_id}")


@st.cache_data(ttl=300, show_spinner=False)
def fraud_ozet_getir(user_id):
    return _api_get_veri(f"/fraud-ozet/{user_id}")


@st.cache_data(ttl=300, show_spinner=False)
def konum_getir(user_id, ilce=None, kategori=None):
    params = {}
    if user_id:
        params["user_id"] = user_id
    if ilce:
        params["ilce"] = ilce
    if kategori:
        params["kategori"] = kategori
    return _api_get_veri("/konum-analizi", params=params)


def fraud_kontrol_et(user_id, merchant, tutar, saat, konum, merch_lat=None, merch_long=None):
    try:
        payload = {
            "user_id": user_id,
            "merchant": merchant,
            "tutar": tutar,
            "saat": saat,
            "konum": konum,
        }
        if merch_lat is not None and merch_long is not None:
            payload["merch_lat"] = merch_lat
            payload["merch_long"] = merch_long
        resp = requests.post(
            f"{API_URL}/islem-analiz",
            json=payload,
            headers=auth_headers(),
            timeout=10,
        )
        if not resp.ok:
            raise RuntimeError(_format_http_error(resp))
        return resp.json()
    except Exception as exc:
        st.error(f"Islem analizi hatasi: {exc}")
        return None


def _trend_html(pct: float | None, invert: bool = False) -> str:
    if pct is None:
        return '<span class="dash-metric-trend dash-trend-neutral">—</span>'
    if invert:
        cls = "dash-trend-down" if pct >= 0 else "dash-trend-up"
    else:
        cls = "dash-trend-up" if pct >= 0 else "dash-trend-down"
    sign = "+" if pct >= 0 else ""
    return (
        f'<span class="dash-metric-trend {cls}">'
        f'{html.escape(f"{sign}{pct:.1f}%")}</span>'
    )


def render_dash_metric_card(
    title: str, value: str, trend_pct: float | None, invert_trend: bool = False
):
    st.markdown(
        f"""
        <div class="dash-metric-card">
            <div class="dash-metric-title">{html.escape(title)}</div>
            <div class="dash-metric-value">{html.escape(value)}</div>
            {_trend_html(trend_pct, invert=invert_trend)}
        </div>
        """,
        unsafe_allow_html=True,
    )


def _plotly_theme_layout(fig, is_dark: bool):
    text = "#f8fafc" if is_dark else "#0f172a"
    grid = "rgba(148, 163, 184, 0.2)" if is_dark else "rgba(148, 163, 184, 0.35)"
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=text, family="Segoe UI, sans-serif"),
        margin=dict(l=8, r=8, t=36, b=8),
        legend=dict(bgcolor="rgba(0,0,0,0)", font=dict(color=text)),
        xaxis=dict(gridcolor=grid, linecolor=grid, tickfont=dict(color=text)),
        yaxis=dict(gridcolor=grid, linecolor=grid, tickfont=dict(color=text)),
    )
    return fig


def build_arima_trend_chart(ozet: dict, tahmin: dict, is_dark: bool):
    trend_data = ozet.get("aylik_trend", [])
    if not trend_data:
        return None

    trend_df = pd.DataFrame(trend_data)
    x_vals = trend_df["ay_periyot"].astype(str).tolist()
    y_vals = trend_df["toplam_harcama"].tolist()

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=x_vals,
            y=y_vals,
            mode="lines+markers",
            name="Gerçekleşen",
            line=dict(color="#7c3aed", width=3),
            marker=dict(size=7, color="#7c3aed"),
        )
    )

    gelecek = tahmin.get("gelecek_ay_tahmini")
    if gelecek is not None:
        fig.add_trace(
            go.Scatter(
                x=[x_vals[-1], "ARIMA Tahmin"],
                y=[y_vals[-1], gelecek],
                mode="lines+markers",
                name="ARIMA Tahmini",
                line=dict(color="#a78bfa", width=2, dash="dash"),
                marker=dict(size=8, color="#a78bfa", symbol="diamond"),
            )
        )

    fig.update_layout(
        title=dict(text="Aylık Harcama Trendi ve ARIMA Tahmini", x=0, font=dict(size=15)),
        xaxis_title="Ay",
        yaxis_title="Harcama (TL)",
        hovermode="x unified",
    )
    return _plotly_theme_layout(fig, is_dark)


def build_mcc_donut_chart(mcc_data: list, is_dark: bool):
    if not mcc_data:
        return None

    mcc_df = pd.DataFrame(mcc_data)
    palette = ["#7c3aed", "#4c1d95", "#64748b", "#94a3b8", "#c4b5fd", "#475569", "#6d28d9"]

    fig = go.Figure(
        data=[
            go.Pie(
                labels=mcc_df["mcc"],
                values=mcc_df["toplam"],
                hole=0.52,
                marker=dict(colors=palette[: len(mcc_df)]),
                textinfo="percent",
                textposition="inside",
                hovertemplate="%{label}<br>%{value:,.0f} TL<br>%{percent}<extra></extra>",
            )
        ]
    )
    fig.update_layout(
        title=dict(text="Harcama Dağılımı (MCC)", x=0, font=dict(size=15)),
        showlegend=True,
        legend=dict(orientation="v", yanchor="middle", y=0.5),
    )
    return _plotly_theme_layout(fig, is_dark)


def render_uyarilar_expander(user_id):
    with st.expander("Uyarılar ve Öneriler", expanded=False):
        try:
            oneri = oneri_getir(user_id)
        except Exception as exc:
            st.error(f"Veri alınamadı: {exc}")
            return

        ozet_data = oneri.get("ozet", {})
        c1, c2, c3 = st.columns(3)
        c1.error(f"Kritik: {ozet_data.get('kirmizi_uyari', 0)}")
        c2.warning(f"Dikkat: {ozet_data.get('sari_uyari', 0)}")
        c3.success(f"Normal: {ozet_data.get('normal', 0)}")

        for seviye in ["kirmizi", "sari", "normal"]:
            liste = oneri.get(seviye, [])
            if not liste:
                continue
            st.subheader(seviye.capitalize())
            df = pd.DataFrame(liste)
            if "kategori" in df.columns:
                df["kategori"] = df["kategori"].apply(kat_tr)
            st.dataframe(df, use_container_width=True, hide_index=True)


def render_harcama_paneli(user_id):
    st.title("Ana Panel")
    is_dark = st.session_state.get("dark_mode", True)

    try:
        kullanici = kullanici_bilgisi_getir(user_id)
        ozet = ozet_getir(user_id)
        tahmin = tahmin_getir(user_id)
        karbon = karbon_getir(user_id)
        fraud_ozet = fraud_ozet_getir(user_id)
        mcc_data = mcc_dagilim_getir(user_id)
        son_islemler = son_islemler_getir(user_id, limit=20)
    except Exception as exc:
        st.error(f"Veri alınamadı: {exc}")
        return

    son_ay = ozet.get("son_ay", {})
    harcama_trend = son_ay.get("degisim_yuzde", 0.0)

    son_ay_toplam = tahmin.get("son_ay_toplam") or 0
    gelecek_tahmin = tahmin.get("gelecek_ay_tahmini")
    if son_ay_toplam and gelecek_tahmin is not None:
        tahmin_trend = round(
            ((gelecek_tahmin - son_ay_toplam) / son_ay_toplam) * 100, 1
        )
    else:
        tahmin_trend = None

    karbon_trend = 0.0
    k_trend = karbon.get("aylik_trend", [])
    if len(k_trend) >= 2:
        son_co2 = k_trend[-1].get("karbon_kgco2", 0)
        onceki_co2 = k_trend[-2].get("karbon_kgco2", 0)
        if onceki_co2:
            karbon_trend = round(((son_co2 - onceki_co2) / onceki_co2) * 100, 1)

    fraud_trend = fraud_ozet.get("degisim_yuzde", 0.0)

    m1, m2, m3, m4 = st.columns(4)
    with m1:
        render_dash_metric_card(
            "Toplam Harcama",
            f"₺{kullanici.get('toplam_harcama', 0):,.0f}",
            harcama_trend,
        )
    with m2:
        tahmin_val = (
            f"₺{gelecek_tahmin:,.0f}"
            if gelecek_tahmin is not None
            else "—"
        )
        render_dash_metric_card(
            "Gelecek Ay Tahmini (ARIMA)",
            tahmin_val,
            tahmin_trend,
        )
    with m3:
        render_dash_metric_card(
            "Karbon Ayak İzi",
            f"{karbon.get('son_ay_co2', 0):,.0f} kg",
            karbon_trend,
        )
    with m4:
        render_dash_metric_card(
            "Yüksek Riskli İşlemler (Fraud)",
            f"{fraud_ozet.get('riskli_islem', 0):,}",
            fraud_trend,
            invert_trend=True,
        )

    st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)
    col_grafik, col_pasta = st.columns([6, 4])

    with col_grafik:
        fig_trend = build_arima_trend_chart(ozet, tahmin, is_dark)
        if fig_trend:
            st.plotly_chart(fig_trend, use_container_width=True)
        else:
            st.info("Trend verisi bulunamadı.")

    with col_pasta:
        fig_mcc = build_mcc_donut_chart(mcc_data, is_dark)
        if fig_mcc:
            st.plotly_chart(fig_mcc, use_container_width=True)
        else:
            st.info("MCC dağılım verisi bulunamadı.")

    st.markdown(
        '<p class="dash-section-title">Son İşlemler</p>',
        unsafe_allow_html=True,
    )

    if son_islemler:
        islem_df = pd.DataFrame(son_islemler)
        rename_map = {
            "trans_date_trans_time": "Tarih",
            "merchant": "Satıcı",
            "amt": "Tutar (TL)",
            "category": "Kategori",
            "mcc_aciklama": "MCC",
            "tr_ilce": "İlçe",
            "is_fraud": "Fraud",
            "karbon_kgco2": "Karbon (kg)",
        }
        islem_df = islem_df.rename(
            columns={k: v for k, v in rename_map.items() if k in islem_df.columns}
        )
        if "Kategori" in islem_df.columns:
            islem_df["Kategori"] = islem_df["Kategori"].apply(kat_tr)
        if "Fraud" in islem_df.columns:
            islem_df["Fraud"] = islem_df["Fraud"].map(
                {True: "Riskli", False: "Normal"}
            )
        if "Tutar (TL)" in islem_df.columns:
            islem_df["Tutar (TL)"] = islem_df["Tutar (TL)"].apply(
                lambda x: f"₺{float(x):,.2f}"
            )
        if "Karbon (kg)" in islem_df.columns:
            islem_df["Karbon (kg)"] = islem_df["Karbon (kg)"].apply(
                lambda x: f"{float(x):.2f}"
            )

        st.dataframe(
            islem_df,
            use_container_width=True,
            hide_index=True,
            height=360,
        )
    else:
        st.info("Henüz işlem kaydı bulunamadı.")

    render_uyarilar_expander(user_id)


def render_auth_screen():
    col1, col2, col3 = st.columns([1, 2, 1])

    with col2:
        st.title("FinanceAI")
        st.caption("Hesabina giris yap veya yeni hesap olustur")
        tab_login, tab_register = st.tabs(["Giriş Yap", "Kayıt Ol"])

        with tab_login:
            with st.form("login_form", clear_on_submit=False):
                email = st.text_input("E-posta")
                password = st.text_input("Sifre", type="password")
                submitted = st.form_submit_button("Giriş Yap", use_container_width=True)

            if submitted:
                ok, payload, err = login_user(email, password)
                if not ok:
                    st.error(err)
                else:
                    user_id = extract_user_id(payload)
                    st.session_state.is_authenticated = True
                    st.session_state.access_token = payload.get("access_token")
                    st.session_state.auth_session = payload.get("session")
                    st.session_state.auth_user = (payload.get("session") or {}).get("user")
                    st.session_state.user_id = user_id
                    st.session_state.auth_error = None
                    st.success("Giris basarili.")
                    st.rerun()

        with tab_register:
            with st.form("register_form", clear_on_submit=False):
                reg_email = st.text_input("E-posta", key="register_email")
                reg_password = st.text_input("Sifre", type="password", key="register_password")
                register_submitted = st.form_submit_button("Kayıt Ol", use_container_width=True)

            if register_submitted:
                ok, payload, err = register_user(reg_email, reg_password)
                if not ok:
                    st.error(err)
                else:
                    st.success("Kayit basarili. E-posta dogrulamasi gerekebilir.")
                    st.json(payload)


def render_dashboard():
    user_id = st.session_state.get("user_id")
    auth_user = st.session_state.get("auth_user") or {}
    user_email = auth_user.get("email", "Bilinmiyor")

    sayfa = render_sidebar_shell(user_email, user_id)

    if user_id is None:
        st.error(
            "Giris basarili ancak API'den kullanici kimligi alinamadi. "
            "Lutfen backend'de login cevabinda user_id dondugunu dogrula."
        )
        return

    if sayfa == "Harcama Paneli":
        render_harcama_paneli(user_id)

    elif sayfa == "Karbon Ayak Izi":
        st.title("Karbon Ayak İzi")
        try:
            karbon = karbon_getir(user_id)
        except Exception as exc:
            st.error(f"Veri alinamadi: {exc}")
            return

        c1, c2 = st.columns(2)
        c1.metric("Bu Ay CO2", f"{karbon.get('son_ay_co2', 0):,.1f} kg")
        c2.metric("Toplam CO2", f"{karbon.get('toplam_co2', 0):,.1f} kg")

        trend = karbon.get("aylik_trend", [])
        if trend:
            trend_df = pd.DataFrame(trend)
            fig = px.area(trend_df, x="ay_periyot", y="karbon_kgco2")
            st.plotly_chart(fig, use_container_width=True)

    elif sayfa == "Konum Analizi":
        st.title("Konum Analizi")
        ilce = st.selectbox("Ilce", ["Tumu", "Cigli", "Karsiyaka", "Bornova", "Buca", "Konak"])
        ilce_param = None if ilce == "Tumu" else ilce
        try:
            konum_data = konum_getir(user_id=user_id, ilce=ilce_param, kategori=None)
        except Exception as exc:
            st.error(f"Veri alinamadi: {exc}")
            return

        harita = folium.Map(location=[38.47, 27.12], zoom_start=11, tiles="OpenStreetMap")
        for mahalle in konum_data.get("mahalle_listesi", []):
            if not mahalle.get("tr_lat") or not mahalle.get("tr_long"):
                continue
            folium.CircleMarker(
                location=[mahalle["tr_lat"], mahalle["tr_long"]],
                radius=8,
                color="blue",
                fill=True,
                fill_opacity=0.6,
                popup=f"{mahalle.get('tr_ilce', '')} - {mahalle.get('tr_mahalle', '')}",
            ).add_to(harita)
        st_folium(harita, width=None, height=500)

    elif sayfa == "Islem Sorgula":
        render_islemler_sayfasi(user_id)


def main():
    st.set_page_config(
        page_title="FinanceAI",
        page_icon="💜",
        layout="wide",
    )
    init_state()
    inject_theme_css(st.session_state.get("dark_mode", True))

    if not st.session_state.is_authenticated:
        render_auth_screen()
        return

    render_dashboard()


if __name__ == "__main__":
    main()
