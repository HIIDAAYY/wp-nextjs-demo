import type { Metadata } from 'next';
import { situsUrl } from '@/lib/wp';
import { graf, organisasi, serialisasi, situsWeb, orang } from '@/lib/jsonld';
import './globals.css';

/**
 * Identitas situs dideklarasikan sekali di sini: metadata dasar, hreflang
 * untuk versi bahasa, dan JSON-LD Organization + WebSite + Person yang
 * berlaku untuk seluruh halaman.
 */
export const metadata: Metadata = {
  metadataBase: new URL(situsUrl()),
  title: {
    default: 'Demo Headless WordPress + Next.js',
    template: '%s — Demo Headless WordPress + Next.js',
  },
  description:
    'Demo teknis: konten dari WordPress REST API, dirender statis oleh Next.js dengan ISR, metadata dinamis, JSON-LD, dan sitemap otomatis.',
  alternates: {
    canonical: '/',
    languages: {
      'id-ID': '/',
      'en-US': '/en',
      'x-default': '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    alternateLocale: ['en_US'],
    siteName: 'Demo Headless WordPress + Next.js',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const identitas = graf([organisasi(), situsWeb(), orang()]);

  return (
    <html lang="id">
      <body>
        {children}
        {/* Satu graf identitas untuk seluruh situs — halaman hanya menambah
            skema yang khas miliknya sendiri (Article, Product, FAQ, Video). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serialisasi(identitas) }}
        />
      </body>
    </html>
  );
}
