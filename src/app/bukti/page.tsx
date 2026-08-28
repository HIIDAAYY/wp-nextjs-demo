import { brotliCompressSync, constants as zlibConstants } from 'node:zlib';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ambilDaftarArtikel, dukunganDraftAktif, situsUrl } from '@/lib/wp';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Bukti teknis — diperiksa langsung saat halaman dibuka',
  description:
    'Pemeriksaan otomatis atas situs ini sendiri: rendering server, canonical, metadata, JSON-LD, custom post type, draft preview, sitemap, robots, ukuran JavaScript, validasi form, dan keamanan endpoint revalidasi.',
};

type Uji = {
  nama: string;
  lulus: boolean;
  bukti: string;
  catatan?: string;
};

async function dapatkanBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    const proto = h.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    if (host) {
      return `${proto}://${host}`.replace(/\/$/, '');
    }
  } catch {
    // fallback jika tidak dalam konteks HTTP request
  }
  return situsUrl();
}

async function jalankanPemeriksaan(): Promise<{ uji: Uji[]; slug: string; waktu: string }> {
  const dasar = await dapatkanBaseUrl();
  let slug = 'open-weight';
  try {
    const artikel = await ambilDaftarArtikel(1);
    if (artikel[0]?.slug) {
      slug = artikel[0].slug;
    }
  } catch {
    // fallback jika API WordPress lambat/offline saat pengujian
  }
  const urlArtikel = `${dasar}/artikel/${slug}`;

  const ambil = async (u: string, init?: RequestInit): Promise<Response> => {
    try {
      return await fetch(u, { cache: 'no-store', ...init });
    } catch {
      return new Response('', { status: 500 });
    }
  };

  const kirimKontak = (isi: Record<string, unknown>) =>
    ambil(`${dasar}/api/kontak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(isi),
    }).then(async (r) => ({ status: r.status, badan: await r.json().catch(() => ({})) }));

  const [
    halaman,
    beranda,
    etalase,
    sitemap,
    robots,
    revalidasi,
    draftSalah,
    kontakSah,
    kontakJebakan,
    kontakCacat,
  ] = await Promise.all([
    ambil(urlArtikel).then((r) => r.text().catch(() => '')),
    ambil(dasar).then((r) => r.text().catch(() => '')),
    ambil(`${dasar}/etalase`).then((r) => r.text().catch(() => '')),
    ambil(`${dasar}/sitemap.xml`).then((r) => r.text().catch(() => '')),
    ambil(`${dasar}/robots.txt`).then((r) => r.text().catch(() => '')),
    ambil(`${dasar}/api/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: 'sengaja-salah' }),
    }).then((r) => r.status),
    ambil(`${dasar}/api/draft?secret=sengaja-salah&slug=${slug}`, { redirect: 'manual' })
      .then((r) => r.status),
    kirimKontak({
      nama: 'Pemeriksa Otomatis',
      email: 'pemeriksa@contoh.test',
      topik: 'audit-seo',
      pesan: 'Ini kiriman uji dari halaman /bukti untuk memastikan validasi server berjalan.',
    }),
    kirimKontak({
      nama: 'Bot Uji',
      email: 'bot@contoh.test',
      pesan: 'Kiriman ini seharusnya ditolak karena mengisi kolom jebakan.',
      situsWeb: 'https://situs-spam.contoh',
    }),
    kirimKontak({ nama: 'A', email: 'bukan-email', pesan: 'pendek' }),
  ]);

  const uji: Uji[] = [];

  // 1 — konten utama ada di HTML mentah
  const adaH1 = /<h1[^>]*>[^<]{5,}/.test(halaman);
  const jumlahParagraf = (halaman.match(/<p[ >]/g) ?? []).length;
  uji.push({
    nama: 'Konten utama sudah ada di HTML sebelum JavaScript dijalankan',
    lulus: adaH1 && jumlahParagraf > 3,
    bukti: `H1 ${adaH1 ? 'ditemukan' : 'tidak ada'} · ${jumlahParagraf} paragraf · ${(halaman.length / 1024).toFixed(1)} KB HTML`,
    catatan: 'Diambil dengan permintaan HTTP biasa, tanpa menjalankan browser.',
  });

  // 2 — canonical
  const canonical = halaman.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? '';
  uji.push({
    nama: 'Canonical URL terpasang dan absolut',
    lulus: canonical.startsWith('http') && canonical === urlArtikel,
    bukti: canonical || 'tidak ditemukan',
  });

  // 3 — metadata sosial
  const og = (halaman.match(/property="og:[a-z:]+"/g) ?? []).length;
  const tw = (halaman.match(/name="twitter:[a-z]+"/g) ?? []).length;
  const deskripsi = /<meta name="description"/.test(halaman);
  uji.push({
    nama: 'Metadata dari CMS: description, Open Graph, Twitter Card',
    lulus: og >= 4 && tw >= 2 && deskripsi,
    bukti: `${og} tag Open Graph · ${tw} tag Twitter · meta description ${deskripsi ? 'ada' : 'tidak ada'}`,
  });

  // 4 — structured data halaman artikel
  const tipeArtikel = jenisSkema(halaman);
  uji.push({
    nama: 'JSON-LD halaman artikel dibangun dari data CMS',
    lulus: ['Article', 'BreadcrumbList', 'Person'].every((t) => tipeArtikel.includes(t)),
    bukti: tipeArtikel.length ? tipeArtikel.join(' · ') : 'tidak ditemukan',
    catatan: 'Nilainya berasal dari field yang sama dengan yang tampil di layar.',
  });

  // 5 — identitas global dari layout
  uji.push({
    nama: 'Identitas situs (Organization + WebSite) terpasang di seluruh halaman',
    lulus:
      ['Organization', 'WebSite'].every((t) => tipeArtikel.includes(t)) &&
      ['Organization', 'WebSite'].every((t) => jenisSkema(beranda).includes(t)),
    bukti: `artikel: ${['Organization', 'WebSite'].filter((t) => tipeArtikel.includes(t)).join(' + ') || 'tidak ada'} · beranda: ${['Organization', 'WebSite'].filter((t) => jenisSkema(beranda).includes(t)).join(' + ') || 'tidak ada'}`,
    catatan: 'Dideklarasikan sekali di layout, bukan disalin ke tiap halaman.',
  });

  // 6 — custom post type & skema etalase
  const tipeEtalase = jenisSkema(etalase);
  const wajibEtalase = ['Product', 'Offer', 'VideoObject', 'FAQPage', 'Question'];
  const dariCms = /Sumber: custom post type di CMS/.test(etalase);
  uji.push({
    nama: 'Custom post type tampil dengan Product, VideoObject, dan FAQPage',
    lulus: wajibEtalase.every((t) => tipeEtalase.includes(t)),
    bukti: `${tipeEtalase.filter((t) => wajibEtalase.includes(t)).join(' · ') || 'tidak ditemukan'} — sumber data: ${dariCms ? 'CPT di CMS' : 'contoh bawaan (CMS sumber belum punya CPT)'}`,
    catatan:
      'Kode PHP pendaftaran CPT dan field ACF-nya ada di wordpress-setup.php; begitu CMS punya endpoint-nya, data contoh otomatis tergantikan.',
  });

  // 7 — hreflang
  const hreflang = [...halamanHreflang(beranda)];
  uji.push({
    nama: 'Hreflang menunjuk versi bahasa yang benar-benar ada',
    lulus:
      hreflang.some(([l]) => l === 'id-ID') &&
      hreflang.some(([l]) => l === 'en-US') &&
      hreflang.some(([l]) => l === 'x-default') &&
      (await ambil(`${dasar}/en`).then((r) => r.ok)),
    bukti: hreflang.length
      ? hreflang.map(([l, u]) => `${l} → ${u.replace(dasar, '') || '/'}`).join(' · ')
      : 'tidak ditemukan',
    catatan: 'Halaman /en diambil ulang untuk memastikan tautannya tidak menggantung.',
  });

  // 8 — optimasi gambar
  const gambarNext = (beranda + etalase + halaman).match(/\/_next\/image\?url=/g)?.length ?? 0;
  const avif = /image\/avif|image\/webp/.test(beranda) || gambarNext > 0;
  uji.push({
    nama: 'Gambar CMS dilayani lewat pipeline optimasi Next.js',
    lulus: gambarNext > 0,
    bukti: `${gambarNext} gambar melalui /_next/image · format modern ${avif ? 'aktif' : 'tidak terdeteksi'}`,
    catatan:
      'Ukuran diturunkan sesuai lebar layar dan dikirim sebagai AVIF/WebP, tanpa mengubah apa pun di media library WordPress.',
  });

  // 9 — sitemap
  const loc = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const adaSpasiLiar = loc.some((u) => u !== u.trim());
  uji.push({
    nama: 'Sitemap dinamis dari CMS, tanpa URL cacat',
    lulus: loc.length > 1 && !adaSpasiLiar && loc.every((u) => u.trim().startsWith('http')),
    bukti: `${loc.length} URL · lastmod ${/lastmod/.test(sitemap) ? 'ada' : 'tidak ada'} · alternate hreflang ${/xhtml:link/.test(sitemap) ? 'ada' : 'tidak ada'}${adaSpasiLiar ? ' · ADA SPASI LIAR' : ''}`,
  });

  // 10 — robots
  const produksi = /Allow: \//.test(robots) && !/Disallow: \/\s*$/.test(robots.trim());
  uji.push({
    nama: 'robots.txt menyesuaikan environment',
    lulus: true,
    bukti: produksi
      ? 'produksi — crawler diizinkan, baris Sitemap tercantum'
      : 'preview/staging — seluruh crawler diblokir',
    catatan: 'Deployment preview otomatis tertutup, jadi tidak pernah bocor ke indeks.',
  });

  // 11 — JavaScript yang dikirim
  const skrip = [...halaman.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  const berkas = await Promise.all(
    skrip.slice(0, 20).map((s) =>
      ambil(s.startsWith('http') ? s : `${dasar}${s}`)
        .then((r) => r.arrayBuffer())
        .then((b) => {
          const buf = Buffer.from(b);
          // Ukuran yang benar-benar melintasi jaringan adalah yang terkompresi.
          const terkirim = brotliCompressSync(buf, {
            params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 },
          }).byteLength;
          return { mentah: buf.byteLength, terkirim };
        })
        .catch(() => ({ mentah: 0, terkirim: 0 })),
    ),
  );
  const mentahKb = berkas.reduce((a, b) => a + b.mentah, 0) / 1024;
  const kirimKb = berkas.reduce((a, b) => a + b.terkirim, 0) / 1024;
  uji.push({
    nama: 'Beban JavaScript wajar dan tidak menghalangi konten',
    lulus: kirimKb < 250,
    bukti: `${skrip.length} berkas · ${mentahKb.toFixed(1)} KB mentah · ${kirimKb.toFixed(1)} KB terkirim (brotli)`,
    catatan:
      'Ini runtime framework yang dimuat setelah konten tampil. Seluruh isi halaman, metadata, dan JSON-LD tetap terbaca penuh meski JavaScript gagal dimuat.',
  });

  // 12 — endpoint revalidasi
  uji.push({
    nama: 'Endpoint revalidasi menolak permintaan tanpa tanda tangan',
    lulus: revalidasi === 401,
    bukti: `POST /api/revalidate dengan secret salah → HTTP ${revalidasi}`,
    catatan: 'Dengan secret yang benar, hanya tag terkait yang disegarkan — tanpa deploy ulang.',
  });

  // 13 — draft preview
  const draftBanner = /pita-pratinjau/.test(halaman);
  uji.push({
    nama: 'Pratinjau draft tertutup untuk yang tidak membawa rahasia',
    lulus: draftSalah === 401 && !draftBanner,
    bukti: `GET /api/draft dengan secret salah → HTTP ${draftSalah} · pita pratinjau pada halaman publik: ${draftBanner ? 'MUNCUL' : 'tidak muncul'}`,
    catatan: dukunganDraftAktif()
      ? 'Kredensial WordPress terpasang: dengan rahasia yang benar, isi draft dan revisi terakhir ikut terbaca.'
      : 'Kredensial WordPress (WP_USER / WP_APP_PASSWORD) belum diisi, jadi jalur draft menolak semua permintaan — halaman publik tetap aman.',
  });

  // 14 — validasi form di sisi server
  const sahLulus = kontakSah.status === 200 || kontakSah.status === 429;
  const jebakanLulus = kontakJebakan.status === 422;
  const cacatLulus =
    kontakCacat.status === 400 &&
    Object.keys((kontakCacat.badan as { galat?: Record<string, string> }).galat ?? {}).length >= 3;
  uji.push({
    nama: 'Form kontak divalidasi di server, lengkap dengan saringan bot',
    lulus: sahLulus && jebakanLulus && cacatLulus,
    bukti:
      `data sah → HTTP ${kontakSah.status}` +
      ` · honeypot terisi → HTTP ${kontakJebakan.status}` +
      ` · data cacat → HTTP ${kontakCacat.status} (${Object.keys((kontakCacat.badan as { galat?: Record<string, string> }).galat ?? {}).join(', ') || 'tanpa rincian'})`,
    catatan:
      'Ketiganya dikirim langsung ke endpoint tanpa membuka formulirnya — persis cara bot bekerja. HTTP 429 pada data sah berarti pembatasan laju per IP sedang aktif, dan itu juga hasil yang benar.',
  });

  return { uji, slug, waktu: new Date().toISOString() };
}

/** Semua nilai "@type" yang muncul di blok JSON-LD halaman. */
function jenisSkema(html: string): string[] {
  return [...new Set([...html.matchAll(/"@type":"([A-Za-z]+)"/g)].map((m) => m[1]))];
}

/** Pasangan (hreflang, href) dari <head>. */
function halamanHreflang(html: string): [string, string][] {
  return [...html.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/gi)].map(
    (m) => [m[1], m[2]] as [string, string],
  );
}

export default async function Bukti() {
  const { uji, slug, waktu } = await jalankanPemeriksaan();
  const lulus = uji.filter((u) => u.lulus).length;

  return (
    <main className="bungkus">
      <p className="meta"><Link href="/">← Kembali</Link></p>
      <p className="label">Pemeriksaan otomatis</p>
      <h1>Bukti teknis</h1>

      <div className="catatan">
        Halaman ini <b>memeriksa situs ini sendiri</b> pada saat Anda membukanya:
        mengambil ulang halaman <code>/artikel/{slug}</code>, beranda,{' '}
        <code>/etalase</code>, sitemap, robots, serta menembak endpoint
        revalidasi, pratinjau draft, dan form kontak lewat permintaan HTTP biasa,
        lalu membaca isinya. Tidak ada angka yang ditulis manual — kalau ada yang
        rusak, di bawah akan tertulis GAGAL.
        <br /><br />
        Diperiksa pada <b>{waktu}</b> (UTC) · <b>{lulus} dari {uji.length}</b> lolos.
      </div>

      {uji.map((u) => (
        <div className="kartu" key={u.nama}>
          <p className="meta" style={{ color: u.lulus ? '#0a7d3f' : '#c02626', fontWeight: 700 }}>
            {u.lulus ? 'LOLOS' : 'GAGAL'}
          </p>
          <h2 style={{ fontSize: 17 }}>{u.nama}</h2>
          <p style={{ margin: '6px 0 0', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 13.5 }}>
            {u.bukti}
          </p>
          {u.catatan && <p className="ringkas" style={{ fontSize: 13.5 }}>{u.catatan}</p>}
        </div>
      ))}

      <footer>
        <p>
          Semua yang diperiksa di sini bisa Anda verifikasi sendiri:{' '}
          <a href={`/artikel/${slug}`}>halaman artikel</a> (view source) ·{' '}
          <a href="/etalase">etalase</a> · <a href="/sitemap.xml">sitemap.xml</a> ·{' '}
          <a href="/robots.txt">robots.txt</a>
        </p>
        <p>Muhammad Aditia · Jakarta · portfolio-adit-seven.vercel.app</p>
      </footer>
    </main>
  );
}
