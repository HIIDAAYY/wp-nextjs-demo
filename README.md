# Demo: Headless WordPress → Next.js

Demo teknis yang saya buat untuk penawaran proyek **Headless WordPress CMS +
Next.js Frontend**. Bukan potongan proyek lama — dibangun khusus supaya bisa
dibuka, diklik, dan diperiksa sendiri.

Sumber konten demo: **WordPress REST API publik** (`wordpress.org/news`).
Untuk produksi, cukup ganti satu variabel ke `cms.domain-anda.com`.

## Yang bisa diperiksa langsung

| Buka | Yang membuktikan |
|---|---|
| `/` lalu **View page source** | Judul, ringkasan, tautan, metadata sudah ada di HTML **sebelum** JavaScript jalan |
| `/artikel/<slug>` | `<link rel="canonical">`, Open Graph, Twitter Card, dan JSON-LD (Article + BreadcrumbList) — semuanya dari data CMS, bukan ditulis manual |
| `/sitemap.xml` | Dibangun dari CMS, ikut berubah saat konten terbit |
| `/robots.txt` | Terbuka di produksi, **terkunci** di staging/preview — penyebab kebocoran indeks yang paling sering |
| `POST /api/revalidate` | Webhook: hanya tag terkait yang disegarkan, tanpa build ulang |

Uji webhook-nya:

```bash
curl -X POST https://situs-anda.vercel.app/api/revalidate \
  -H 'content-type: application/json' \
  -d '{"secret":"ISI_SECRET","slug":"nama-slug-artikel"}'
```

Balasannya berisi daftar tag yang disegarkan beserta waktunya.

## Menjalankan di komputer sendiri

```bash
cp .env.example .env.local
npm install
npm run dev            # http://localhost:3000
```

## Deploy ke Vercel

1. Push folder ini ke repositori GitHub.
2. Vercel → **Add New Project** → pilih repositorinya.
3. Isi Environment Variables (Settings → Environment Variables):

   | Nama | Isi |
   |---|---|
   | `WP_API_URL` | `https://wordpress.org/news/wp-json/wp/v2` |
   | `NEXT_PUBLIC_SITE_URL` | URL Vercel yang diberikan setelah deploy pertama |
   | `REVALIDATE_SECRET` | string acak panjang |

4. Deploy. Setelah dapat URL, isi ulang `NEXT_PUBLIC_SITE_URL` dengan URL itu
   lalu **Redeploy** — supaya canonical dan sitemap memakai domain yang benar.

> Catatan: `robots.txt` sengaja memblokir semua crawler kecuali saat
> `VERCEL_ENV=production`. Jadi kalau dibuka dari URL preview, isinya memang
> `Disallow: /`. Itu perilaku yang diinginkan, bukan bug.

## Menghubungkan ke WordPress sendiri

1. Ganti `WP_API_URL` ke REST API WordPress Anda.
2. Pasang `wordpress-webhook-snippet.php` di WordPress (functions.php tema child
   atau plugin kecil), lalu isi dua konstanta di `wp-config.php`.
3. Terbitkan satu artikel — halaman, arsip, dan sitemap ikut ter-update
   tanpa deploy manual.

## Isi kode

```
src/lib/wp.ts                     satu-satunya pintu ke WordPress + definisi cache tag
src/app/page.tsx                  daftar artikel (static + ISR)
src/app/artikel/[slug]/page.tsx   halaman artikel: generateStaticParams,
                                  generateMetadata, JSON-LD dari data CMS
src/app/sitemap.ts                sitemap dinamis dari CMS
src/app/robots.ts                 robots per environment
src/app/api/revalidate/route.ts   webhook revalidasi bertanda tangan rahasia
wordpress-webhook-snippet.php     sisi WordPress-nya
```

Kode sengaja dibuat ringkas dan berkomentar bahasa Indonesia, supaya bisa
dibaca dalam 10 menit.

---

Muhammad Aditia · Jakarta · portfolio-adit-seven.vercel.app
