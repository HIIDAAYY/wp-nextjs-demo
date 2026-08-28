import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ambilDaftarArtikel, situsUrl } from '@/lib/wp';

/**
 * Versi bahasa Inggris dari beranda.
 *
 * Hreflang hanya berguna kalau halaman yang ditunjuknya benar-benar ada dan
 * saling menunjuk balik. Karena itu versi ini dirender sungguhan, bukan
 * sekadar tag di <head>.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Headless WordPress → Next.js (English)',
  description:
    'Technical demo: content from the WordPress REST API, statically rendered by Next.js with ISR, dynamic metadata, JSON-LD, and an automatic sitemap.',
  alternates: {
    canonical: '/en',
    languages: {
      'id-ID': '/',
      'en-US': '/en',
      'x-default': '/',
    },
  },
  openGraph: { type: 'website', locale: 'en_US', alternateLocale: ['id_ID'] },
};

export default async function Home() {
  const artikel = await ambilDaftarArtikel();

  return (
    <main className="bungkus" lang="en">
      <p className="label">Technical demo</p>
      <h1>Headless WordPress → Next.js</h1>

      <div className="catatan">
        This page is <b>rendered on the server</b>, not in the browser. View the
        page source: every headline, excerpt, link, meta tag, and JSON-LD block
        is already in the HTML before a single line of JavaScript runs.
        <br /><br />
        Content is pulled from the WordPress REST API, rendered statically, and
        refreshed through <b>ISR + a revalidation webhook</b> — no redeploy.
        <br /><br />
        Versi bahasa Indonesia: <Link href="/"><b>/</b></Link> · self-check page:{' '}
        <Link href="/bukti"><b>/bukti</b></Link>
      </div>

      {artikel.map((a) => (
        <article className="kartu" key={a.slug}>
          <Link href={`/artikel/${a.slug}`}>
            {a.gambar && (
              <Image
                className="gambar-kecil"
                src={a.gambar}
                alt={a.gambarAlt}
                width={800}
                height={420}
                sizes="(max-width: 760px) 100vw, 720px"
              />
            )}
            <h2>{a.judul}</h2>
            <p className="meta">
              {new Date(a.tanggal).toLocaleDateString('en-US', {
                day: 'numeric', month: 'long', year: 'numeric',
              })} · {a.penulis}
            </p>
            <p className="ringkas">{a.ringkasan}…</p>
          </Link>
        </article>
      ))}

      <footer>
        <p>
          Content source: WordPress REST API · <a href="/sitemap.xml">sitemap.xml</a> ·{' '}
          <a href="/robots.txt">robots.txt</a>
        </p>
        <p>Built by Muhammad Aditia · {situsUrl().replace('https://', '')}</p>
      </footer>
    </main>
  );
}
