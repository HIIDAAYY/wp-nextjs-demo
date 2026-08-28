import type { MetadataRoute } from 'next';
import { ambilSlugUntukSitemap, situsUrl } from '@/lib/wp';

/**
 * Sitemap dibangun dari sumber yang sama dengan halaman.
 * Artikel baru terbit → tag disegarkan → sitemap ikut berubah sendiri.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const artikel = await ambilSlugUntukSitemap(100);
  const sekarang = new Date();
  return [
    {
      url: situsUrl(),
      lastModified: sekarang,
      changeFrequency: 'daily',
      priority: 1,
      // Versi bahasa lain dicantumkan di sitemap juga, bukan hanya di <head>.
      alternates: { languages: { id: situsUrl(), en: `${situsUrl()}/en` } },
    },
    {
      url: `${situsUrl()}/en`,
      lastModified: sekarang,
      changeFrequency: 'daily',
      priority: 0.8,
      alternates: { languages: { id: situsUrl(), en: `${situsUrl()}/en` } },
    },
    { url: `${situsUrl()}/etalase`, lastModified: sekarang, changeFrequency: 'weekly', priority: 0.8 },
    ...artikel.map((a) => ({
      url: `${situsUrl()}/artikel/${a.slug}`,
      lastModified: new Date(a.modified_gmt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
