import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { TAG_DAFTAR, tagArtikel } from '@/lib/wp';

/**
 * Endpoint yang dipanggil WordPress lewat webhook setiap kali konten terbit.
 *
 * Yang disegarkan hanya tag terkait: halaman artikelnya, daftar artikel, dan
 * sitemap yang memakai tag yang sama. Tidak ada build ulang, tidak ada deploy.
 *
 * Contoh dari sisi WordPress:
 *   POST https://situs-anda.com/api/revalidate
 *   { "secret": "...", "slug": "judul-artikel-baru" }
 */
export async function POST(request: Request) {
  const { secret, slug } = await request.json().catch(() => ({} as Record<string, string>));

  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ pesan: 'Tidak diizinkan' }, { status: 401 });
  }

  // Next 16: argumen kedua = profil cache life ('max' = segarkan seluruh entri bertag ini).
  revalidateTag(TAG_DAFTAR, 'max');
  if (slug) revalidateTag(tagArtikel(slug), 'max');

  return NextResponse.json({
    disegarkan: true,
    tag: slug ? [TAG_DAFTAR, tagArtikel(slug)] : [TAG_DAFTAR],
    waktu: new Date().toISOString(),
  });
}
