/**
 * Satu-satunya pintu ke WordPress.
 *
 * Frontend tidak pernah tahu bentuk mentah WordPress: semua respons
 * diterjemahkan dulu ke tipe milik kita sendiri (Artikel). Kalau nanti
 * CMS-nya diganti atau strukturnya berubah, yang diubah cuma file ini.
 */

const API = process.env.WP_API_URL ?? 'https://wordpress.org/news/wp-json/wp/v2';

/** Cache tag: dipakai webhook revalidasi untuk menyegarkan konten terkait saja. */
export const TAG_DAFTAR = 'wp-daftar-artikel';
export const tagArtikel = (slug: string) => `wp-artikel-${slug}`;

export type Artikel = {
  slug: string;
  judul: string;
  ringkasan: string;
  isiHtml: string;
  tanggal: string;
  diperbaruiPada: string;
  penulis: string;
  gambar: string | null;
};

type WpPost = {
  slug: string;
  date_gmt: string;
  modified_gmt: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  _embedded?: {
    author?: { name?: string }[];
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
  return {
    slug: p.slug,
    judul: bersihkan(p.title.rendered),
    ringkasan: bersihkan(p.excerpt.rendered).slice(0, 300),
    isiHtml: perbaikiAriaLabel(p.content.rendered),
    tanggal: p.date_gmt,
    diperbaruiPada: p.modified_gmt,
    penulis: p._embedded?.author?.[0]?.name ?? 'Redaksi',
    gambar: p._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null,
  };
}

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

export async function ambilArtikel(slug: string): Promise<Artikel | null> {
  const res = await fetch(`${API}/posts?slug=${encodeURIComponent(slug)}&_embed=1`, {
    next: { revalidate: 3600, tags: [TAG_DAFTAR, tagArtikel(slug)] },
  });
  if (!res.ok) return null;
  const data = await res.json() as WpPost[];
  return data.length ? petakan(data[0]) : null;
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

export const situsUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')
    .trim()               // environment variable sering terbawa spasi saat disalin
    .replace(/\/$/, '');
