# Demo: Headless WordPress → Next.js

Demo teknis yang saya buat untuk penawaran proyek **Headless WordPress CMS +
Next.js Frontend**. Bukan potongan proyek lama — dibangun khusus supaya bisa
dibuka, diklik, dan diperiksa sendiri.

Sumber konten demo: **WordPress REST API publik** (`wordpress.org/news`).
Untuk produksi, cukup ganti satu variabel ke `cms.domain-anda.com`.

## Yang bisa diperiksa langsung

| Buka | Yang membuktikan |
|---|---|
| `/` lalu **View page source** | Judul, ringkasan, tautan, metadata, gambar `next/image`, dan JSON-LD sudah ada di HTML **sebelum** JavaScript jalan |
| `/artikel/<slug>` | `<link rel="canonical">`, hreflang, Open Graph, Twitter Card, dan JSON-LD (Article + Person + BreadcrumbList) — semuanya dari data CMS, bukan ditulis manual |
| `/etalase` | Custom post type (produk, video, FAQ) dengan JSON-LD **Product**, **VideoObject**, **FAQPage**, plus form yang divalidasi di server |
| `/en` | Versi bahasa Inggris yang ditunjuk hreflang — halamannya benar-benar ada, bukan sekadar tag di `<head>` |
| `/bukti` | Situs memeriksa dirinya sendiri: 14 pengujian dijalankan saat halaman dibuka |
| `/sitemap.xml` | Dibangun dari CMS, lengkap dengan `xhtml:link` alternate per bahasa |
| `/robots.txt` | Terbuka di produksi, **terkunci** di staging/preview — penyebab kebocoran indeks yang paling sering |
| `POST /api/revalidate` | Webhook: hanya tag terkait yang disegarkan, tanpa build ulang |
| `GET /api/draft` | Pratinjau draft bertanda tangan; tanpa rahasia yang benar → `401` |
| `POST /api/kontak` | Validasi di server + honeypot + pembatasan laju per IP |

Uji webhook-nya:

```bash
curl -X POST https://situs-anda.vercel.app/api/revalidate \
  -H 'content-type: application/json' \
  -d '{"secret":"ISI_SECRET","slug":"nama-slug-artikel","tipe":"post"}'
```

Balasannya berisi daftar tag yang disegarkan beserta waktunya. `tipe` adalah
`post_type` dari WordPress, sehingga produk/video/FAQ menyegarkan etalase-nya
sendiri tanpa menyentuh cache artikel.

Uji saringan spam form kontak — honeypot terisi harus ditolak:

```bash
# diterima
curl -X POST https://situs-anda.vercel.app/api/kontak \
  -H 'content-type: application/json' \
  -d '{"nama":"Adit","email":"halo@contoh.test","pesan":"Halo, saya ingin bertanya soal migrasi."}'

# ditolak (HTTP 422) — kolom jebakan terisi
curl -X POST https://situs-anda.vercel.app/api/kontak \
  -H 'content-type: application/json' \
  -d '{"nama":"Bot","email":"bot@contoh.test","pesan":"Kiriman otomatis.","situsWeb":"https://spam.test"}'
```

Pratinjau draft (butuh `WP_PREVIEW_SECRET`, dan `WP_USER`/`WP_APP_PASSWORD`
untuk benar-benar membaca isi draft):

```
/api/draft?secret=ISI_SECRET&slug=nama-slug     → menyalakan Draft Mode
/api/disable-draft                              → keluar dari Draft Mode
```

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
   | `WP_PREVIEW_SECRET` | string acak lain, untuk tautan pratinjau draft |
   | `WP_USER` / `WP_APP_PASSWORD` | opsional — Application Password akun editor, agar isi draft bisa dibaca |

4. Deploy. Setelah dapat URL, isi ulang `NEXT_PUBLIC_SITE_URL` dengan URL itu
   lalu **Redeploy** — supaya canonical dan sitemap memakai domain yang benar.

> Catatan: `robots.txt` sengaja memblokir semua crawler kecuali saat
> `VERCEL_ENV=production`. Jadi kalau dibuka dari URL preview, isinya memang
> `Disallow: /`. Itu perilaku yang diinginkan, bukan bug.

## Menghubungkan ke WordPress sendiri

1. Ganti `WP_API_URL` ke REST API WordPress Anda.
2. Salin `wordpress-setup.php` ke `wp-content/plugins/headless-setup/headless-setup.php`
   lalu aktifkan dari menu **Plugins**.
3. Isi konstanta berikut di `wp-config.php`:

   ```php
   define('NEXTJS_SITE_URL',          'https://situs-anda.com');
   define('NEXTJS_REVALIDATE_SECRET', 'sama dengan REVALIDATE_SECRET');
   define('NEXTJS_PREVIEW_SECRET',    'sama dengan WP_PREVIEW_SECRET');
   ```

4. Terbitkan satu artikel — halaman, arsip, dan sitemap ikut ter-update
   tanpa deploy manual. Tekan **Preview** pada sebuah draft — WordPress
   membuka Next.js lewat tautan bertanda tangan.

### Isi `wordpress-setup.php`

| Bagian | Isinya |
|---|---|
| Custom Post Type | `produk`, `video`, `faq` — semuanya `show_in_rest` |
| Taxonomy | `kategori_produk` (hierarkis) dan `topik_faq` |
| Field ACF | harga, mata uang, stok, SKU, rating; embed URL, durasi ISO; jawaban FAQ; profil penulis untuk schema `Person` |
| Cadangan tanpa ACF | `register_rest_field` yang menghasilkan bentuk respons `acf: {…}` yang sama |
| Pratinjau draft | `preview_post_link` diarahkan ke `/api/draft` dengan rahasia |
| Webhook | `wp_after_insert_post` + `trashed_post` → `/api/revalidate` beserta `tipe` |
| Keamanan | versi WordPress disembunyikan, XML-RPC dimatikan, enumerasi pengguna ditutup, REST hanya boleh dibaca publik, header keamanan HTTP, editor berkas dimatikan, MIME berbahaya diblokir |

`wordpress-webhook-snippet.php` adalah versi minimal yang hanya berisi
webhook-nya saja — cukup kalau Anda belum butuh CPT dan pratinjau draft.

## Isi kode

```
src/lib/wp.ts                       satu-satunya pintu ke WordPress: artikel, CPT,
                                    draft/revisi, dan definisi cache tag
src/lib/jsonld.ts                   pembangun JSON-LD: Organization, WebSite, Person,
                                    Article, BreadcrumbList, Product, VideoObject, FAQPage
src/app/layout.tsx                  metadata dasar, hreflang, dan identitas JSON-LD global
src/app/page.tsx                    daftar artikel (static + ISR) dengan next/image
src/app/en/page.tsx                 versi bahasa Inggris yang ditunjuk hreflang
src/app/artikel/[slug]/page.tsx     halaman artikel: generateStaticParams,
                                    generateMetadata, JSON-LD, pita pratinjau draft
src/app/etalase/page.tsx            custom post type + Product/VideoObject/FAQPage
src/app/etalase/FormKontak.tsx      form kontak (client component)
src/app/bukti/page.tsx              14 pengujian yang dijalankan situs atas dirinya sendiri
src/app/sitemap.ts                  sitemap dinamis dari CMS + alternate per bahasa
src/app/robots.ts                   robots per environment
src/app/api/revalidate/route.ts     webhook revalidasi bertanda tangan rahasia
src/app/api/draft/route.ts          menyalakan Draft Mode setelah rahasia dicocokkan
src/app/api/disable-draft/route.ts  keluar dari Draft Mode
src/app/api/kontak/route.ts         validasi server + honeypot + pembatasan laju
wordpress-setup.php                 sisi WordPress: CPT, ACF, pratinjau, webhook, keamanan
wordpress-webhook-snippet.php       versi minimal: webhook revalidasi saja
```

Kode sengaja dibuat ringkas dan berkomentar bahasa Indonesia, supaya bisa
dibaca dalam 10 menit.

---

Muhammad Aditia · Jakarta · portfolio-adit-seven.vercel.app
