import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ambilArtikel, ambilDaftarArtikel, situsUrl } from '@/lib/wp';

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
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: a.judul,
      description: a.ringkasan,
      url,
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
  const a = await ambilArtikel(slug);
  if (!a) notFound();

  const url = `${situsUrl()}/artikel/${a.slug}`;

  /**
   * JSON-LD dibangun dari field yang sama dengan yang tampil di layar,
   * sehingga structured data tidak mungkin berbeda dari visible content.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: a.judul,
        description: a.ringkasan,
        datePublished: a.tanggal,
        dateModified: a.diperbaruiPada,
        author: { '@type': 'Person', name: a.penulis },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        ...(a.gambar ? { image: a.gambar } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Beranda', item: situsUrl() },
          { '@type': 'ListItem', position: 2, name: a.judul, item: url },
        ],
      },
    ],
  };

  return (
    <main className="bungkus">
      <p className="meta">
        <Link href="/">← Kembali</Link>
      </p>
      <h1>{a.judul}</h1>
      <p className="meta">
        {new Date(a.tanggal).toLocaleDateString('id-ID', {
          day: 'numeric', month: 'long', year: 'numeric',
        })} · {a.penulis}
      </p>

      <div className="catatan">
        Metadata, canonical, Open Graph, dan JSON-LD di halaman ini seluruhnya
        dihasilkan dari data CMS saat halaman dibangun — tidak ada yang ditulis
        manual per artikel.
      </div>

      <div className="isi" dangerouslySetInnerHTML={{ __html: a.isiHtml }} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
