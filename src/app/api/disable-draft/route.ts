import { draftMode } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Keluar dari modus pratinjau.
 *
 * Dipanggil oleh tombol "Keluar dari pratinjau" pada banner draft. Setelah
 * cookie draft dihapus, browser kembali menerima halaman statis yang sama
 * persis dengan yang dilihat pengunjung biasa.
 */
export async function GET(request: Request) {
  const draft = await draftMode();
  draft.disable();

  const { searchParams } = new URL(request.url);
  const kembali = searchParams.get('kembali');
  const tujuan = kembali && /^\/[^/\\]/.test(kembali) ? kembali : '/';

  // Redirect manual (bukan redirect() dari next/navigation) supaya cookie
  // penghapus draft ikut terkirim bersama respons pengalihan ini.
  return NextResponse.redirect(new URL(tujuan, request.url), { status: 307 });
}
