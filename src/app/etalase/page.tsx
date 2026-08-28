import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ambilFaq, ambilProduk, ambilVideo, situsUrl } from '@/lib/wp';
import {
  faqHalaman,
  graf,
  produk as skemaProduk,
  remahRoti,
  serialisasi,
  videoObjek,
} from '@/lib/jsonld';
import FormKontak from './FormKontak';

/**
 * Etalase: sisi CMS yang tidak terlihat di daftar artikel.
 *
 * Tiga custom post type (produk, video, FAQ) ditarik dari WordPress lewat
 * REST API, lalu setiap blok structured data dibangun dari field yang sama
 * dengan yang tampil di layar. Kalau CMS-nya belum punya CPT tersebut,
 * dipakai contoh bawaan — dan halaman ini menyebutkan sumbernya apa adanya.
 */
export const revalidate = 3600;

const url = `${situsUrl()}/etalase`;

export const metadata: Metadata = {
  title: 'Etalase: custom post type, structured data, dan form tervalidasi',
  description:
    'Produk, video, dan FAQ dari custom post type WordPress — lengkap dengan JSON-LD Product, VideoObject, dan FAQPage, serta form kontak yang divalidasi di server.',
  alternates: { canonical: '/etalase', languages: { 'id-ID': '/etalase', 'x-default': '/etalase' } },
  openGraph: { type: 'website', url, locale: 'id_ID' },
};

const rupiah = (nilai: number, mataUang: string) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: mataUang,
    maximumFractionDigits: 0,
  }).format(nilai);

export default async function Etalase() {
  const [produk, video, faq] = await Promise.all([ambilProduk(), ambilVideo(), ambilFaq()]);

  const asal = (dariCms: boolean) =>
    dariCms ? 'custom post type di CMS' : 'contoh bawaan (CPT belum ada di CMS sumber)';

  const jsonLd = graf([
    ...produk.data.map((p) =>
      skemaProduk({
        nama: p.nama,
        deskripsi: p.deskripsi,
        url: `${url}#${p.slug}`,
        gambar: p.gambar,
        sku: p.sku,
        merek: p.merek,
        harga: p.harga,
        mataUang: p.mataUang,
        stok: p.stok,
        rating: p.rating,
      }),
    ),
    ...video.data.map((v) =>
      videoObjek({
        judul: v.judul,
        deskripsi: v.deskripsi,
        thumbnail: v.thumbnail,
        embedUrl: v.embedUrl,
        durasiIso: v.durasiIso,
        tanggalUnggah: v.tanggalUnggah,
      }),
    ),
    faqHalaman(faq.data),
    remahRoti([
      { nama: 'Beranda', url: situsUrl() },
      { nama: 'Etalase', url },
    ]),
  ]);

  return (
    <main className="bungkus">
      <p className="meta"><Link href="/">← Kembali</Link></p>
      <p className="label">Custom post type & structured data</p>
      <h1>Etalase</h1>

      <div className="catatan">
        Artikel bukan satu-satunya bentuk konten. Di sini WordPress dipakai
        sebagai CMS untuk tiga tipe konten lain — <b>produk</b>, <b>video</b>,
        dan <b>FAQ</b> — masing-masing dengan field khusus (ACF) sendiri. Setiap
        blok JSON-LD di halaman ini (<b>Product</b>, <b>VideoObject</b>,{' '}
        <b>FAQPage</b>) dibangun dari field yang sama dengan yang Anda baca di
        layar, jadi structured data tidak mungkin berbeda dari isinya.
        <br /><br />
        Kode PHP untuk mendaftarkan ketiga CPT beserta field-nya ada di{' '}
        <code>wordpress-setup.php</code> di repositori ini.
      </div>

      <h2 style={{ fontSize: 22, marginTop: 36 }}>Produk</h2>
      <p className="meta">Sumber: {asal(produk.dariCms)}</p>
      {produk.data.map((p) => (
        <article className="kartu" id={p.slug} key={p.slug}>
          {p.gambar && (
            <Image
              className="gambar-kecil"
              src={p.gambar}
              alt={p.nama}
              width={800}
              height={420}
              sizes="(max-width: 760px) 100vw, 720px"
            />
          )}
          <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{p.nama}</h3>
          <p className="harga">{rupiah(p.harga, p.mataUang)}</p>
          <p className="meta">
            <span className="lencana">SKU {p.sku}</span>
            <span className="lencana">
              {p.stok === 'InStock' ? 'Tersedia' : p.stok === 'PreOrder' ? 'Pra-pesan' : 'Habis'}
            </span>
            {p.rating && (
              <span className="lencana">★ {p.rating.nilai} · {p.rating.jumlah} ulasan</span>
            )}
          </p>
          <p className="ringkas">{p.deskripsi}</p>
        </article>
      ))}

      <h2 style={{ fontSize: 22, marginTop: 36 }}>Video</h2>
      <p className="meta">Sumber: {asal(video.dariCms)}</p>
      {video.data.map((v) => (
        <article className="kartu" id={v.slug} key={v.slug}>
          {v.thumbnail && (
            <Image
              className="gambar-kecil"
              src={v.thumbnail}
              alt={`Cuplikan video: ${v.judul}`}
              width={800}
              height={420}
              sizes="(max-width: 760px) 100vw, 720px"
            />
          )}
          <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{v.judul}</h3>
          <p className="meta">
            <span className="lencana">Durasi {v.durasiIso}</span>
            <span className="lencana">
              Diunggah{' '}
              {new Date(v.tanggalUnggah).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </span>
          </p>
          <p className="ringkas">{v.deskripsi}</p>
        </article>
      ))}

      <h2 style={{ fontSize: 22, marginTop: 36 }}>Pertanyaan yang sering muncul</h2>
      <p className="meta">Sumber: {asal(faq.dariCms)}</p>
      {faq.data.map((f) => (
        <div className="kartu" key={f.pertanyaan}>
          <p className="tanya">{f.pertanyaan}</p>
          <p className="jawab">{f.jawaban}</p>
        </div>
      ))}

      <h2 style={{ fontSize: 22, marginTop: 36 }}>Hubungi</h2>
      <div className="catatan">
        Form di bawah tidak menentukan sendiri apa yang sah: seluruh aturan
        dijalankan ulang di <code>/api/kontak</code>, karena bot mengirim POST
        langsung ke endpoint tanpa pernah membuka halaman ini. Saringan spam-nya
        memakai <b>honeypot</b> dan <b>pembatasan laju per IP</b> — tanpa captcha
        yang membebani pengunjung. Demo ini tidak menyimpan data apa pun.
      </div>
      <FormKontak />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialisasi(jsonLd) }}
      />

      <footer>
        <p>
          Periksa sendiri: buka <b>View page source</b> lalu cari{' '}
          <code>application/ld+json</code> — Product, VideoObject, dan FAQPage
          sudah ada di HTML sebelum JavaScript dijalankan.
        </p>
      </footer>
    </main>
  );
}
