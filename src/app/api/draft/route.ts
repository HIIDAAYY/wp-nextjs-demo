import { timingSafeEqual } from 'node:crypto';
import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

/**
 * Pintu masuk modus pratinjau.
 *
 * Tombol "Preview" di WordPress mengarah ke sini dengan tanda tangan rahasia.
 * Kalau rahasianya cocok, Next.js menyalakan Draft Mode: cache dimatikan
 * khusus untuk browser editor, sehingga draft terbaca tanpa pernah tayang ke
 * publik dan tanpa membatalkan halaman statis untuk pengunjung lain.
 *
 *   /api/draft?secret=...&slug=judul-artikel
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rahasia = searchParams.get('secret') ?? '';
  const slug = searchParams.get('slug') ?? '';

  const dikonfigurasi = process.env.WP_PREVIEW_SECRET ?? '';
  if (!dikonfigurasi || !samaAman(rahasia, dikonfigurasi)) {
    return NextResponse.json({ pesan: 'Tidak diizinkan' }, { status: 401 });
  }

  // Hanya slug — supaya parameter ini tidak bisa dipakai sebagai open redirect.
  if (!/^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$/i.test(slug)) {
    return NextResponse.json({ pesan: 'Slug tidak valid' }, { status: 400 });
  }

  const draft = await draftMode();
  draft.enable();

  redirect(`/artikel/${slug}`);
}

/** Perbandingan waktu-tetap: panjang string rahasia tidak ikut bocor. */
function samaAman(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
