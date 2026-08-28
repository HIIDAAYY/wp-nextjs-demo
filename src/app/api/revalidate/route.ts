import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { TAG_DAFTAR, tagArtikel, tagTipe } from '@/lib/wp';

/**
 * Endpoint yang dipanggil WordPress lewat webhook setiap kali konten terbit.
 *
 * Yang disegarkan hanya tag terkait: halaman artikelnya, daftar artikel, dan
 * sitemap yang memakai tag yang sama. Tidak ada build ulang, tidak ada deploy.
 *
 * `tipe` = post_type dari WordPress, sehingga produk/video/FAQ menyegarkan
 * etalase-nya sendiri tanpa menyentuh cache artikel.
 *
 * Contoh dari sisi WordPress:
 *   POST https://situs-anda.com/api/revalidate
 *   { "secret": "...", "slug": "judul-artikel-baru", "tipe": "post" }
 */
export async function POST(request: Request) {
  const { secret, slug, tipe } = await request.json().catch(() => ({} as Record<string, string>));

  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ pesan: 'Tidak diizinkan' }, { status: 401 });
  }

  const tagCpt = typeof tipe === 'string' ? tagTipe(tipe) : null;
  const tag = tagCpt
    ? [tagCpt]
    : slug
      ? [TAG_DAFTAR, tagArtikel(slug)]
      : [TAG_DAFTAR];

  // Next 16: argumen kedua = profil cache life ('max' = segarkan seluruh entri bertag ini).
  for (const t of tag) revalidateTag(t, 'max');

  return NextResponse.json({
    disegarkan: true,
    tag,
    waktu: new Date().toISOString(),
  });
}
