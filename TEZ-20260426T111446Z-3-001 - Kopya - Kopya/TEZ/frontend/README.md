# TEZ Frontend

React + Vite + TypeScript + Tailwind CSS ile kurulmuş modern dashboard iskeleti.

## Teknolojiler

- **Vite 8** — React + TypeScript
- **Tailwind CSS 4** — `@tailwindcss/vite` eklentisi
- **Lucide React** — ikonlar
- **Recharts** — grafikler

## Kurulum

```bash
cd frontend
npm install
npm run dev
```

Uygulama varsayılan olarak `http://localhost:5173` adresinde açılır.

## Proje yapısı

```
src/
├── app/           # Ana uygulama bileşenleri
├── components/    # Yeniden kullanılabilir UI
│   └── ui/
├── lib/           # Yardımcı fonksiyonlar
└── main.tsx       # Giriş noktası
```

## Özel renkler

`tailwind.config.js` içinde tanımlı:

| Token      | Değer   |
|------------|---------|
| `primary`  | #7c3aed |
| `bg-dark`  | #0f172a |
| `card-dark`| #1e293b |

Kullanım: `bg-bg-dark`, `bg-card-dark`, `text-primary`, `bg-primary/20`

## Komutlar

| Komut           | Açıklama              |
|-----------------|-----------------------|
| `npm run dev`   | Geliştirme sunucusu   |
| `npm run build` | Production derlemesi  |
| `npm run preview` | Build önizlemesi    |
| `npm run lint`  | ESLint kontrolü       |
