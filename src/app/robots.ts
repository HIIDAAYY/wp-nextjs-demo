import type { MetadataRoute } from 'next';
import { situsUrl } from '@/lib/wp';

/**
 * Produksi terbuka, staging/preview tertutup.
 * Ini penyebab kebocoran indeks yang paling sering terjadi pada proyek
 * yang punya lebih dari satu environment.
 */
export default function robots(): MetadataRoute.Robots {
  const produksi = process.env.VERCEL_ENV === 'production' || process.env.ENVIRONMENT === 'production';

  if (!produksi) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${situsUrl()}/sitemap.xml`,
    host: situsUrl(),
  };
}
