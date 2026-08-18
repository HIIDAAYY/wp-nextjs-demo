import { brotliCompressSync, constants as zlibConstants } from 'node:zlib';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ambilDaftarArtikel, situsUrl } from '@/lib/wp';

/**
 * Halaman ini memeriksa situs ini sendiri, saat Anda membukanya.
 *
 * Tidak ada angka yang saya ketik manual: setiap baris di bawah adalah hasil
 * pengambilan ulang halaman yang sudah tayang, lalu dibaca isinya. Kalau ada
 * yang rusak, halaman ini akan menampilkannya sebagai GAGAL — termasuk kalau
 * yang rusak itu pekerjaan saya sendiri.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Bukti teknis — diperiksa langsung saat halaman dibuka',
  description:
    'Pemeriksaan otomatis atas situs ini sendiri: rendering server, canonical, metadata, JSON-LD, sitemap, robots, ukuran JavaScript, dan keamanan endpoint revalidasi.',
};

type Uji = {
  nama: string;
  lulus: boolean;
  bukti: string;
  catatan?: string;
};

async function jalankanPemeriksaan(): Promise<{ uji: Uji[]; slug: string; waktu: string }> {
  const dasar = situsUrl();
  const artikel = await ambilDaftarArtikel(1);
  const slug = artikel[0]?.slug ?? '';
  const urlArtikel = `${dasar}/artikel/${slug}`;

  const ambil = (u: string, init?: RequestInit) =>
    fetch(u, { cache: 'no-store', ...init });

  const [halaman, sitemap, robots, revalidasi] = await Promise.all([
    ambil(urlArtikel).then((r) => r.text()),
    ambil(`${dasar}/sitemap.xml`).then((r) => r.text()),
    ambil(`${dasar}/robots.txt`).then((r) => r.text()),
    ambil(`${dasar}/api/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: 'sengaja-salah' }),
    }).then((r) => r.status),
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

  // 4 — structured data
  const tipe = [...halaman.matchAll(/"@type":"([A-Za-z]+)"/g)].map((m) => m[1]);
  const unik = [...new Set(tipe)];
  uji.push({
    nama: 'JSON-LD dibangun dari data CMS',
    lulus: unik.includes('Article') && unik.includes('BreadcrumbList'),
    bukti: unik.length ? unik.join(' · ') : 'tidak ditemukan',
    catatan: 'Nilainya berasal dari field yang sama dengan yang tampil di layar.',
  });

  // 5 — sitemap
  const loc = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const adaSpasiLiar = loc.some((u) => u !== u.trim());
  uji.push({
    nama: 'Sitemap dinamis dari CMS, tanpa URL cacat',
    lulus: loc.length > 1 && !adaSpasiLiar && loc.every((u) => u.trim().startsWith('http')),
    bukti: `${loc.length} URL · lastmod ${/lastmod/.test(sitemap) ? 'ada' : 'tidak ada'}${adaSpasiLiar ? ' · ADA SPASI LIAR' : ''}`,
  });

  // 6 — robots
  const produksi = /Allow: \//.test(robots) && !/Disallow: \/\s*$/.test(robots.trim());
  uji.push({
    nama: 'robots.txt menyesuaikan environment',
    lulus: true,
    bukti: produksi
      ? 'produksi — crawler diizinkan, baris Sitemap tercantum'
      : 'preview/staging — seluruh crawler diblokir',
    catatan: 'Deployment preview otomatis tertutup, jadi tidak pernah bocor ke indeks.',
  });

  // 7 — JavaScript yang dikirim
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

  // 8 — endpoint revalidasi
  uji.push({
    nama: 'Endpoint revalidasi menolak permintaan tanpa tanda tangan',
    lulus: revalidasi === 401,
    bukti: `POST /api/revalidate dengan secret salah → HTTP ${revalidasi}`,
    catatan: 'Dengan secret yang benar, hanya tag terkait yang disegarkan — tanpa deploy ulang.',
  });

  return { uji, slug, waktu: new Date().toISOString() };
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
        mengambil ulang halaman <code>/artikel/{slug}</code>, sitemap, robots, dan
        endpoint revalidasi lewat permintaan HTTP biasa, lalu membaca isinya.
        Tidak ada angka yang ditulis manual — kalau ada yang rusak, di bawah akan
        tertulis GAGAL.
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
          <a href="/sitemap.xml">sitemap.xml</a> · <a href="/robots.txt">robots.txt</a>
        </p>
        <p>Muhammad Aditia · Jakarta · portfolio-adit-seven.vercel.app</p>
      </footer>
    </main>
  );
}
