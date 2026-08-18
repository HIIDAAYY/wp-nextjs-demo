import type { MetadataRoute } from 'next';
import { ambilSlugUntukSitemap, situsUrl } from '@/lib/wp';

/**
 * Sitemap dibangun dari sumber yang sama dengan halaman.
 * Artikel baru terbit → tag disegarkan → sitemap ikut berubah sendiri.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const artikel = await ambilSlugUntukSitemap(100);
  return [
    { url: situsUrl(), lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...artikel.map((a) => ({
      url: `${situsUrl()}/artikel/${a.slug}`,
      lastModified: new Date(a.modified_gmt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
