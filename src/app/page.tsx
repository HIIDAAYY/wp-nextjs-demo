import Link from 'next/link';
import { ambilDaftarArtikel, situsUrl } from '@/lib/wp';

export const revalidate = 3600;

export default async function Beranda() {
  const artikel = await ambilDaftarArtikel();
  const dibangunPada = new Date().toISOString();

  return (
    <main className="bungkus">
      <p className="label">Demo teknis</p>
      <h1>Headless WordPress → Next.js</h1>

      <div className="catatan">
        Halaman ini <b>dibangun di server</b>, bukan di browser. Klik kanan →
        “View page source”: seluruh judul, ringkasan, tautan, metadata, dan
        JSON-LD sudah ada di HTML sebelum satu baris JavaScript dijalankan —
        persis yang dibutuhkan crawler Google dan mesin AI search.
        <br /><br />
        Konten ditarik dari WordPress REST API, dirender statis, lalu
        disegarkan lewat <b>ISR + webhook revalidasi</b> tanpa deploy ulang.
        <br />
        HTML ini dibangun pada <b>{dibangunPada}</b> (UTC).
        <br /><br />
        Tidak ingin memeriksa manual? Halaman{' '}
        <Link href="/bukti"><b>/bukti</b></Link> memeriksa situs ini sendiri
        secara langsung — rendering, canonical, metadata, JSON-LD, sitemap,
        robots, ukuran JavaScript, dan keamanan endpoint revalidasi.
      </div>

      {artikel.map((a) => (
        <article className="kartu" key={a.slug}>
          <Link href={`/artikel/${a.slug}`}>
            <h2>{a.judul}</h2>
            <p className="meta">
              {new Date(a.tanggal).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric',
              })} · {a.penulis}
            </p>
            <p className="ringkas">{a.ringkasan}…</p>
          </Link>
        </article>
      ))}

      <footer>
        <p>
          Sumber konten: WordPress REST API. Sitemap otomatis:{' '}
          <a href="/sitemap.xml">/sitemap.xml</a> · robots:{' '}
          <a href="/robots.txt">/robots.txt</a>
        </p>
        <p>Dibuat oleh Muhammad Aditia · {situsUrl().replace('https://', '')}</p>
      </footer>
    </main>
  );
}
