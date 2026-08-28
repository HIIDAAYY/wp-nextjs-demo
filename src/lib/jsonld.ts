/**
 * Pembangun JSON-LD (schema.org).
 *
 * Semua structured data situs ini lahir dari satu berkas, dari field yang sama
 * dengan yang tampil di layar. Tidak ada blok JSON yang ditulis manual per
 * halaman — kalau data CMS berubah, skemanya ikut berubah sendiri.
 */

import { situsUrl } from './wp';

export type Simpul = Record<string, unknown>;

const KONTEKS = 'https://schema.org';

/** Nama organisasi & situs dipakai berulang, jadi disimpan di satu tempat. */
export const IDENTITAS = {
  nama: 'Demo Headless WordPress + Next.js',
  namaSingkat: 'Headless WP Demo',
  pemilik: 'Muhammad Aditia',
  jabatan: 'Web Developer — Headless CMS & SEO Teknis',
  lokasi: 'Jakarta, Indonesia',
  email: 'aditmuhammad10.ma@gmail.com',
  sameAs: [
    'https://portfolio-adit-seven.vercel.app',
    'https://github.com/HIIDAAYY',
  ],
};

/** Bungkus beberapa simpul jadi satu graf agar cukup satu <script> per halaman. */
export function graf(simpul: (Simpul | null | undefined)[]): Simpul {
  return {
    '@context': KONTEKS,
    '@graph': simpul.filter(Boolean) as Simpul[],
  };
}

/**
 * `<` diloloskan supaya isi konten tidak pernah bisa menutup tag <script>.
 * Ini satu-satunya tempat JSON-LD diserialisasi, jadi cukup dijaga di sini.
 */
export function serialisasi(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\u003c');
}

/* ── Identitas global ───────────────────────────────────────────── */

export function organisasi(): Simpul {
  const dasar = situsUrl();
  return {
    '@type': 'Organization',
    '@id': `${dasar}/#organisasi`,
    name: IDENTITAS.nama,
    alternateName: IDENTITAS.namaSingkat,
    url: dasar,
    email: IDENTITAS.email,
    founder: { '@id': `${dasar}/#pemilik` },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Jakarta',
      addressCountry: 'ID',
    },
    sameAs: IDENTITAS.sameAs,
  };
}

export function situsWeb(): Simpul {
  const dasar = situsUrl();
  return {
    '@type': 'WebSite',
    '@id': `${dasar}/#situs`,
    url: dasar,
    name: IDENTITAS.nama,
    inLanguage: 'id-ID',
    publisher: { '@id': `${dasar}/#organisasi` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${dasar}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function orang(opsi?: {
  nama?: string;
  jabatan?: string;
  bio?: string;
  foto?: string | null;
  sameAs?: string[];
}): Simpul {
  const dasar = situsUrl();
  return {
    '@type': 'Person',
    '@id': opsi?.nama ? `${dasar}/#penulis-${slugAman(opsi.nama)}` : `${dasar}/#pemilik`,
    name: opsi?.nama ?? IDENTITAS.pemilik,
    jobTitle: opsi?.jabatan ?? IDENTITAS.jabatan,
    ...(opsi?.bio ? { description: opsi.bio } : {}),
    ...(opsi?.foto ? { image: opsi.foto } : {}),
    url: dasar,
    sameAs: opsi?.sameAs ?? IDENTITAS.sameAs,
  };
}

/* ── Konten ─────────────────────────────────────────────────────── */

export function artikel(a: {
  judul: string;
  ringkasan: string;
  url: string;
  tanggal: string;
  diperbaruiPada: string;
  penulis: string;
  gambar?: string | null;
}): Simpul {
  const dasar = situsUrl();
  return {
    '@type': 'Article',
    '@id': `${a.url}#artikel`,
    headline: a.judul,
    description: a.ringkasan,
    datePublished: a.tanggal,
    dateModified: a.diperbaruiPada,
    author: { '@type': 'Person', name: a.penulis },
    publisher: { '@id': `${dasar}/#organisasi` },
    isPartOf: { '@id': `${dasar}/#situs` },
    inLanguage: 'id-ID',
    mainEntityOfPage: { '@type': 'WebPage', '@id': a.url },
    ...(a.gambar ? { image: a.gambar } : {}),
  };
}

export function remahRoti(jejak: { nama: string; url: string }[]): Simpul {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: jejak.map((j, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: j.nama,
      item: j.url,
    })),
  };
}

export function produk(p: {
  nama: string;
  deskripsi: string;
  url: string;
  gambar?: string | null;
  sku?: string;
  merek?: string;
  harga: number;
  mataUang: string;
  stok: 'InStock' | 'OutOfStock' | 'PreOrder';
  rating?: { nilai: number; jumlah: number } | null;
}): Simpul {
  return {
    '@type': 'Product',
    '@id': `${p.url}#produk`,
    name: p.nama,
    description: p.deskripsi,
    ...(p.gambar ? { image: p.gambar } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    brand: { '@type': 'Brand', name: p.merek ?? IDENTITAS.namaSingkat },
    offers: {
      '@type': 'Offer',
      url: p.url,
      price: p.harga.toFixed(2),
      priceCurrency: p.mataUang,
      availability: `https://schema.org/${p.stok}`,
      priceValidUntil: akhirTahunDepan(),
      seller: { '@id': `${situsUrl()}/#organisasi` },
    },
    ...(p.rating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: p.rating.nilai.toFixed(1),
            reviewCount: p.rating.jumlah,
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {}),
  };
}

export function videoObjek(v: {
  judul: string;
  deskripsi: string;
  thumbnail: string;
  embedUrl: string;
  durasiIso: string;
  tanggalUnggah: string;
  url?: string;
}): Simpul {
  return {
    '@type': 'VideoObject',
    name: v.judul,
    description: v.deskripsi,
    thumbnailUrl: [v.thumbnail],
    embedUrl: v.embedUrl,
    duration: v.durasiIso,
    uploadDate: v.tanggalUnggah,
    ...(v.url ? { contentUrl: v.url } : {}),
    publisher: { '@id': `${situsUrl()}/#organisasi` },
  };
}

export function faqHalaman(daftar: { pertanyaan: string; jawaban: string }[]): Simpul | null {
  if (!daftar.length) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: daftar.map((f) => ({
      '@type': 'Question',
      name: f.pertanyaan,
      acceptedAnswer: { '@type': 'Answer', text: f.jawaban },
    })),
  };
}

/* ── Pembantu kecil ─────────────────────────────────────────────── */

const slugAman = (teks: string) =>
  teks.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function akhirTahunDepan(): string {
  const t = new Date();
  return `${t.getUTCFullYear() + 1}-12-31`;
}
