/**
 * Satu-satunya pintu ke WordPress.
 *
 * Frontend tidak pernah tahu bentuk mentah WordPress: semua respons
 * diterjemahkan dulu ke tipe milik kita sendiri (Artikel, Produk, Video, Faq).
 * Kalau nanti CMS-nya diganti atau strukturnya berubah, yang diubah cuma
 * file ini.
 */

const API = process.env.WP_API_URL ?? 'https://wordpress.org/news/wp-json/wp/v2';

/** Cache tag: dipakai webhook revalidasi untuk menyegarkan konten terkait saja. */
export const TAG_DAFTAR = 'wp-daftar-artikel';
export const TAG_PRODUK = 'wp-produk';
export const TAG_VIDEO = 'wp-video';
export const TAG_FAQ = 'wp-faq';
export const tagArtikel = (slug: string) => `wp-artikel-${slug}`;

/** Tag CPT dipetakan dari `post_type` yang dikirim webhook WordPress. */
export const tagTipe = (tipe: string): string | null =>
  ({ produk: TAG_PRODUK, video: TAG_VIDEO, faq: TAG_FAQ } as Record<string, string>)[tipe] ?? null;

export type Artikel = {
  slug: string;
  judul: string;
  ringkasan: string;
  isiHtml: string;
  tanggal: string;
  diperbaruiPada: string;
  penulis: string;
  penulisBio: string;
  penulisFoto: string | null;
  gambar: string | null;
  gambarAlt: string;
  status: string;
};

export type Produk = {
  slug: string;
  nama: string;
  deskripsi: string;
  gambar: string | null;
  sku: string;
  merek: string;
  harga: number;
  mataUang: string;
  stok: 'InStock' | 'OutOfStock' | 'PreOrder';
  rating: { nilai: number; jumlah: number } | null;
};

export type Video = {
  slug: string;
  judul: string;
  deskripsi: string;
  thumbnail: string;
  embedUrl: string;
  durasiIso: string;
  tanggalUnggah: string;
};

export type Faq = { pertanyaan: string; jawaban: string };

/**
 * Hasil pengambilan CPT beserta asal datanya.
 *
 * Sumber demo (`wordpress.org/news`) tidak punya custom post type, jadi
 * pengambilan CPT selalu dicoba dulu ke CMS; kalau endpoint-nya belum ada,
 * dipakai contoh bawaan — dan halaman /bukti melaporkan sumbernya apa adanya.
 */
export type HasilCpt<T> = { data: T[]; dariCms: boolean };

type WpPost = {
  id?: number;
  slug: string;
  status?: string;
  date_gmt: string;
  modified_gmt: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  acf?: Record<string, unknown>;
  _embedded?: {
    author?: { name?: string; description?: string; avatar_urls?: Record<string, string> }[];
    'wp:featuredmedia'?: { source_url?: string; alt_text?: string }[];
  };
};

const bersihkan = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&hellip;/g, '…').replace(/&#8217;/g, '’')
      .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Perbaikan aksesibilitas: memastikan semua tautan <a> dan tombol <button>
 * memiliki aria-label jika tidak mempunyai teks/alt. (Mencegah masalah Lighthouse 5 -> 0)
 */
function perbaikiAriaLabel(html: string): string {
  if (!html) return html;

  let hasil = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs, inner) => {
    if (/aria-label\s*=|aria-labelledby\s*=|title\s*=/i.test(attrs)) {
      return match;
    }
    const textContent = inner.replace(/<[^>]*>/g, '').trim();
    if (textContent.length > 0) {
      return match;
    }
    const imgAltMatch = inner.match(/<img\b[^>]*alt=["']([^"']+)["']/i);
    if (imgAltMatch && imgAltMatch[1].trim().length > 0) {
      return match;
    }

    let label = 'Tautan';
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    if (hrefMatch) {
      const href = hrefMatch[1];
      if (href.includes('chromewebstore') || href.includes('chrome')) label = 'Chrome Web Store';
      else if (href.includes('apps.apple.com') || href.includes('apple')) label = 'App Store';
      else if (href.includes('github.com')) label = 'GitHub';
      else if (href.includes('youtube.com')) label = 'YouTube';
      else {
        try {
          const parsed = new URL(href);
          label = `Tautan ke ${parsed.hostname}`;
        } catch {
          label = 'Tautan';
        }
      }
    } else if (/prev|previous/i.test(attrs)) {
      label = 'Sebelumnya';
    } else if (/next/i.test(attrs)) {
      label = 'Berikutnya';
    }

    return `<a aria-label="${label}"${attrs}>${inner}</a>`;
  });

  hasil = hasil.replace(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi, (match, attrs, inner) => {
    if (/aria-label\s*=|aria-labelledby\s*=|title\s*=/i.test(attrs)) {
      return match;
    }
    const textContent = inner.replace(/<[^>]*>/g, '').trim();
    if (textContent.length > 0) {
      return match;
    }
    return `<button aria-label="Tombol"${attrs}>${inner}</button>`;
  });

  return hasil;
}

function petakan(p: WpPost): Artikel {
  const penulis = p._embedded?.author?.[0];
  const media = p._embedded?.['wp:featuredmedia']?.[0];
  return {
    slug: p.slug,
    judul: bersihkan(p.title.rendered),
    ringkasan: bersihkan(p.excerpt.rendered).slice(0, 300),
    isiHtml: perbaikiAriaLabel(p.content.rendered),
    tanggal: p.date_gmt,
    diperbaruiPada: p.modified_gmt,
    penulis: penulis?.name ?? 'Redaksi',
    penulisBio: bersihkan(penulis?.description ?? ''),
    penulisFoto: penulis?.avatar_urls?.['96'] ?? null,
    gambar: media?.source_url ?? null,
    gambarAlt: media?.alt_text?.trim() || bersihkan(p.title.rendered),
    status: p.status ?? 'publish',
  };
}

/**
 * Kredensial Application Password WordPress — hanya dipakai untuk membaca
 * draft. Tanpa kredensial, jalur draft menolak dengan sopan dan situs tetap
 * menampilkan versi yang sudah terbit.
 */
function otorisasiWp(): Record<string, string> {
  const pengguna = process.env.WP_USER;
  const sandi = process.env.WP_APP_PASSWORD;
  if (!pengguna || !sandi) return {};
  return {
    Authorization: `Basic ${Buffer.from(`${pengguna}:${sandi}`).toString('base64')}`,
  };
}

export const dukunganDraftAktif = () =>
  Boolean(process.env.WP_USER && process.env.WP_APP_PASSWORD);

/**
 * revalidate 3600 = jaring pengaman kalau webhook gagal.
 * tags = jalur cepatnya: begitu editor menekan Publish, hanya tag terkait
 * yang disegarkan, tanpa build ulang dan tanpa deploy manual.
 */
export async function ambilDaftarArtikel(jumlah = 12): Promise<Artikel[]> {
  const res = await fetch(`${API}/posts?per_page=${jumlah}&_embed=1`, {
    next: { revalidate: 3600, tags: [TAG_DAFTAR] },
  });
  if (!res.ok) throw new Error(`WordPress API ${res.status}`);
  return (await res.json() as WpPost[]).map(petakan);
}

export async function ambilArtikel(
  slug: string,
  opsi: { draft?: boolean } = {},
): Promise<Artikel | null> {
  // Modus pratinjau: draft tidak pernah masuk cache, dan butuh kredensial.
  if (opsi.draft) {
    const draft = await ambilDraft(slug);
    if (draft) return draft;
  }

  const res = await fetch(`${API}/posts?slug=${encodeURIComponent(slug)}&_embed=1`, {
    next: { revalidate: 3600, tags: [TAG_DAFTAR, tagArtikel(slug)] },
  });
  if (!res.ok) return null;
  const data = await res.json() as WpPost[];
  return data.length ? petakan(data[0]) : null;
}

/**
 * Draft dan revisi terakhir hanya bisa dibaca dengan kredensial, dan tidak
 * pernah disimpan di cache — begitu editor menyimpan ulang, pratinjau ikut
 * berubah tanpa perlu menunggu revalidasi.
 */
export async function ambilDraft(slug: string): Promise<Artikel | null> {
  const kepala = otorisasiWp();
  if (!Object.keys(kepala).length) return null;

  const url =
    `${API}/posts?slug=${encodeURIComponent(slug)}` +
    `&status=draft,pending,future,private,publish&_embed=1`;

  const res = await fetch(url, { headers: kepala, cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) return null;

  const data = (await res.json().catch(() => [])) as WpPost[];
  if (!data.length) return null;

  const artikel = petakan(data[0]);
  const revisi = await ambilRevisiTerbaru(data[0], kepala);
  return revisi ? { ...artikel, ...revisi } : artikel;
}

/** Revisi terbaru dipakai kalau editor menekan "Preview" tanpa menerbitkan. */
async function ambilRevisiTerbaru(
  post: WpPost,
  kepala: Record<string, string>,
): Promise<Partial<Artikel> | null> {
  if (!post.id) return null;
  const res = await fetch(`${API}/posts/${post.id}/revisions?per_page=1`, {
    headers: kepala,
    cache: 'no-store',
  }).catch(() => null);
  if (!res || !res.ok) return null;

  const revisi = (await res.json().catch(() => [])) as WpPost[];
  if (!revisi.length) return null;

  return {
    judul: bersihkan(revisi[0].title.rendered),
    isiHtml: perbaikiAriaLabel(revisi[0].content.rendered),
    diperbaruiPada: revisi[0].modified_gmt,
  };
}

/**
 * Khusus sitemap: hanya field yang dipakai, supaya payload-nya kecil dan
 * tetap masuk cache. Menarik seluruh isi artikel untuk sitemap itu pemborosan.
 */
export async function ambilSlugUntukSitemap(jumlah = 100) {
  const res = await fetch(
    `${API}/posts?per_page=${jumlah}&_fields=slug,modified_gmt`,
    { next: { revalidate: 3600, tags: [TAG_DAFTAR] } },
  );
  if (!res.ok) throw new Error(`WordPress API ${res.status}`);
  return (await res.json()) as { slug: string; modified_gmt: string }[];
}

/* ── Custom Post Type ───────────────────────────────────────────── */

/** Pengambil CPT generik: gagal diam-diam, supaya CMS tanpa CPT tidak merusak halaman. */
async function ambilCpt(tipe: string, tag: string, jumlah: number): Promise<WpPost[] | null> {
  const res = await fetch(`${API}/${tipe}?per_page=${jumlah}&_embed=1`, {
    next: { revalidate: 3600, tags: [tag] },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  return Array.isArray(data) && data.length ? (data as WpPost[]) : null;
}

const angka = (v: unknown, bawaan: number) => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : bawaan;
};
const teks = (v: unknown, bawaan = '') => (typeof v === 'string' && v.trim() ? v.trim() : bawaan);

export async function ambilProduk(jumlah = 6): Promise<HasilCpt<Produk>> {
  const mentah = await ambilCpt('produk', TAG_PRODUK, jumlah);
  if (!mentah) return { data: PRODUK_CONTOH, dariCms: false };

  return {
    dariCms: true,
    data: mentah.map((p) => {
      const f = p.acf ?? {};
      return {
        slug: p.slug,
        nama: bersihkan(p.title.rendered),
        deskripsi: bersihkan(p.excerpt.rendered).slice(0, 300),
        gambar: p._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null,
        sku: teks(f.sku, p.slug.toUpperCase()),
        merek: teks(f.merek, 'Headless WP Demo'),
        harga: angka(f.harga, 0),
        mataUang: teks(f.mata_uang, 'IDR'),
        stok: teks(f.stok, 'InStock') as Produk['stok'],
        rating: f.rating_nilai
          ? { nilai: angka(f.rating_nilai, 5), jumlah: angka(f.rating_jumlah, 1) }
          : null,
      };
    }),
  };
}

export async function ambilVideo(jumlah = 4): Promise<HasilCpt<Video>> {
  const mentah = await ambilCpt('video', TAG_VIDEO, jumlah);
  if (!mentah) return { data: VIDEO_CONTOH, dariCms: false };

  return {
    dariCms: true,
    data: mentah.map((v) => {
      const f = v.acf ?? {};
      return {
        slug: v.slug,
        judul: bersihkan(v.title.rendered),
        deskripsi: bersihkan(v.excerpt.rendered).slice(0, 300),
        thumbnail: teks(f.thumbnail, v._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? ''),
        embedUrl: teks(f.embed_url),
        durasiIso: teks(f.durasi_iso, 'PT0M0S'),
        tanggalUnggah: teks(f.tanggal_unggah, v.date_gmt),
      };
    }),
  };
}

export async function ambilFaq(jumlah = 10): Promise<HasilCpt<Faq>> {
  const mentah = await ambilCpt('faq', TAG_FAQ, jumlah);
  if (!mentah) return { data: FAQ_CONTOH, dariCms: false };

  return {
    dariCms: true,
    data: mentah.map((f) => ({
      pertanyaan: bersihkan(f.title.rendered),
      jawaban: bersihkan(teks(f.acf?.jawaban, f.content.rendered)).slice(0, 600),
    })),
  };
}

/* ── Contoh bawaan (dipakai hanya bila CMS belum punya CPT-nya) ──── */

const PRODUK_CONTOH: Produk[] = [
  {
    slug: 'paket-headless-starter',
    nama: 'Paket Headless Starter',
    deskripsi:
      'WordPress sebagai CMS, Next.js sebagai frontend: lima halaman, ISR + webhook revalidasi, SEO teknis, dan sitemap otomatis.',
    gambar: null,
    sku: 'HWP-STARTER',
    merek: 'Headless WP Demo',
    harga: 7500000,
    mataUang: 'IDR',
    stok: 'InStock',
    rating: { nilai: 4.9, jumlah: 17 },
  },
  {
    slug: 'paket-headless-bisnis',
    nama: 'Paket Headless Bisnis',
    deskripsi:
      'Custom post type, ACF, multibahasa dengan hreflang, draft preview untuk editor, dan structured data lengkap.',
    gambar: null,
    sku: 'HWP-BISNIS',
    merek: 'Headless WP Demo',
    harga: 18500000,
    mataUang: 'IDR',
    stok: 'InStock',
    rating: { nilai: 5, jumlah: 8 },
  },
];

const VIDEO_CONTOH: Video[] = [
  {
    slug: 'alur-kerja-headless',
    judul: 'Alur kerja headless: dari Publish di WordPress sampai tayang di Next.js',
    deskripsi:
      'Rekaman singkat: editor menekan Publish, webhook memanggil endpoint revalidasi, lalu halaman statis berubah tanpa deploy ulang.',
    thumbnail: 'https://s.w.org/images/home/screen-themes.png?3',
    embedUrl: 'https://videopress.com/embed/contoh-alur-kerja-headless',
    durasiIso: 'PT3M42S',
    tanggalUnggah: '2026-01-15T09:00:00Z',
  },
];

const FAQ_CONTOH: Faq[] = [
  {
    pertanyaan: 'Apakah editor tetap memakai WordPress seperti biasa?',
    jawaban:
      'Ya. Editor tetap menulis di WordPress, lengkap dengan media library, revisi, dan hak akses. Yang berubah hanya cara halaman ditampilkan ke pengunjung.',
  },
  {
    pertanyaan: 'Bagaimana konten baru bisa tayang tanpa deploy ulang?',
    jawaban:
      'WordPress mengirim webhook ke endpoint revalidasi Next.js setiap kali konten terbit. Hanya cache tag terkait yang disegarkan, jadi halaman lain tidak ikut dibangun ulang.',
  },
  {
    pertanyaan: 'Bisakah editor melihat pratinjau draft sebelum terbit?',
    jawaban:
      'Bisa. Tombol Preview di WordPress membuka Next.js lewat tautan bertanda tangan, lalu Draft Mode mematikan cache khusus untuk sesi itu sehingga draft terbaca tanpa pernah bocor ke publik.',
  },
  {
    pertanyaan: 'Apakah SEO-nya tidak kalah dibanding WordPress biasa?',
    jawaban:
      'Seluruh konten, metadata, canonical, hreflang, dan JSON-LD sudah ada di HTML sebelum JavaScript dijalankan, sehingga crawler membaca halaman utuh pada permintaan pertama.',
  },
];

export const situsUrl = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    const host = process.env.VERCEL_URL.trim().replace(/\/$/, '');
    return host.startsWith('http') ? host : `https://${host}`;
  }
  return 'http://localhost:3000';
};
