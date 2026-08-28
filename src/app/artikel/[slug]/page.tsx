import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { draftMode } from 'next/headers';
import { notFound } from 'next/navigation';
import { ambilArtikel, ambilDaftarArtikel, situsUrl } from '@/lib/wp';
import { artikel as skemaArtikel, graf, orang, remahRoti, serialisasi } from '@/lib/jsonld';

export const revalidate = 3600;
/** Slug di luar daftar hasil build tetap dibangun saat pertama diminta (ISR). */
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

/** Halaman dibangun lebih dulu saat build — jadi crawler dapat HTML utuh. */
export async function generateStaticParams() {
  const artikel = await ambilDaftarArtikel(12);
  return artikel.map((a) => ({ slug: a.slug }));
}

/** Metadata diambil dari field CMS, bukan hardcode per halaman. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await ambilArtikel(slug);
  if (!a) return { title: 'Artikel tidak ditemukan', robots: { index: false } };

  const url = `${situsUrl()}/artikel/${a.slug}`;
  return {
    title: a.judul,
    description: a.ringkasan,
    alternates: {
      canonical: url,
      languages: { 'id-ID': url, 'x-default': url },
    },
    openGraph: {
      type: 'article',
      title: a.judul,
      description: a.ringkasan,
      url,
      locale: 'id_ID',
      publishedTime: a.tanggal,
      modifiedTime: a.diperbaruiPada,
      images: a.gambar ? [a.gambar] : undefined,
    },
    twitter: {
      card: a.gambar ? 'summary_large_image' : 'summary',
      title: a.judul,
      description: a.ringkasan,
    },
  };
}

export default async function HalamanArtikel({ params }: Props) {
  const { slug } = await params;

  /**
   * Modus pratinjau hanya aktif untuk browser yang membawa cookie draft —
   * hasil dari /api/draft dengan rahasia yang benar. Pengunjung biasa tidak
   * pernah menyentuh jalur ini dan tetap menerima halaman statis.
   */
  const { isEnabled: pratinjau } = await draftMode();
  const a = await ambilArtikel(slug, { draft: pratinjau });
  if (!a) notFound();

  const url = `${situsUrl()}/artikel/${a.slug}`;

  /**
   * JSON-LD dibangun dari field yang sama dengan yang tampil di layar,
   * sehingga structured data tidak mungkin berbeda dari visible content.
   */
  const jsonLd = graf([
    skemaArtikel({
      judul: a.judul,
      ringkasan: a.ringkasan,
      url,
      tanggal: a.tanggal,
      diperbaruiPada: a.diperbaruiPada,
      penulis: a.penulis,
      gambar: a.gambar,
    }),
    orang({ nama: a.penulis, jabatan: 'Penulis', bio: a.penulisBio, foto: a.penulisFoto }),
    remahRoti([
      { nama: 'Beranda', url: situsUrl() },
      { nama: a.judul, url },
    ]),
  ]);

  return (
    <main className="bungkus">
      {pratinjau && (
        <div className="pita-pratinjau" role="status">
          <span>
            <b>Modus pratinjau aktif.</b> Halaman ini menampilkan versi{' '}
            <b>{a.status === 'publish' ? 'terbaru dari editor' : a.status}</b> dan tidak
            terlihat oleh pengunjung.
          </span>
          <a className="tombol-pita" href={`/api/disable-draft?kembali=/artikel/${a.slug}`}>
            Keluar dari pratinjau
          </a>
        </div>
      )}

      <p className="meta">
        <Link href="/">← Kembali</Link>
      </p>
      <h1>{a.judul}</h1>
      <p className="meta">
        {new Date(a.tanggal).toLocaleDateString('id-ID', {
          day: 'numeric', month: 'long', year: 'numeric',
        })} · {a.penulis}
      </p>

      {/* next/image: ukuran responsif, format modern (AVIF/WebP) otomatis,
          dan ruang gambar sudah dipesan sebelum berkasnya sampai. */}
      {a.gambar && (
        <Image
          className="gambar-utama"
          src={a.gambar}
          alt={a.gambarAlt}
          width={1200}
          height={630}
          sizes="(max-width: 760px) 100vw, 760px"
          priority
        />
      )}

      <div className="catatan">
        Metadata, canonical, hreflang, Open Graph, dan JSON-LD di halaman ini
        seluruhnya dihasilkan dari data CMS saat halaman dibangun — tidak ada
        yang ditulis manual per artikel.
      </div>

      <div className="isi" dangerouslySetInnerHTML={{ __html: a.isiHtml }} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialisasi(jsonLd) }}
      />
    </main>
  );
}
