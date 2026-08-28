import { NextResponse } from 'next/server';

/**
 * Form kontak: seluruh validasi terjadi di server.
 *
 * Validasi di browser itu untuk kenyamanan pengguna, bukan pengamanan — bot
 * mengirim POST langsung ke endpoint ini tanpa pernah membuka halamannya.
 * Karena itu semua aturan di bawah dijalankan ulang di sini, ditambah dua
 * saringan spam yang tidak membebani pengunjung: honeypot dan pembatasan laju.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATAS_JUMLAH = 5;              // maksimal kiriman
const BATAS_JENDELA_MS = 10 * 60_000; // per 10 menit, per alamat IP
const MIN_ISI_DETIK = 2;             // manusia tidak mengisi form dalam < 2 detik

type Kiriman = {
  nama?: unknown;
  email?: unknown;
  pesan?: unknown;
  topik?: unknown;
  /** Honeypot: disembunyikan dari mata dan pembaca layar; hanya bot yang mengisinya. */
  situsWeb?: unknown;
  /** Milidetik epoch saat form dirender — dipakai mengukur kecepatan pengisian. */
  dimuatPada?: unknown;
};

const TOPIK = ['proyek-baru', 'migrasi', 'audit-seo', 'lainnya'] as const;

/**
 * Penghitung laju di memori proses. Cukup untuk satu instance; untuk banyak
 * instance, ganti pemanggilan `lewatBatas()` dengan Redis/Upstash tanpa
 * mengubah bagian lain endpoint ini.
 */
const jejakLaju = new Map<string, number[]>();

export async function POST(request: Request) {
  const ip = alamatIp(request);
  const badan = await bacaBadan(request);
  if (!badan) {
    return NextResponse.json(
      { diterima: false, alasan: 'format-tidak-valid', pesan: 'Badan permintaan bukan JSON atau form yang sah.' },
      { status: 400 },
    );
  }

  // Saringan 1 — honeypot. Dijawab seolah gagal validasi biasa, tanpa
  // memberi tahu bot bahwa jebakannya yang membuatnya tertolak.
  if (teks(badan.situsWeb).length > 0) {
    return NextResponse.json(
      { diterima: false, alasan: 'terdeteksi-bot', pesan: 'Kiriman ditolak.' },
      { status: 422 },
    );
  }

  // Saringan 2 — kecepatan pengisian yang tidak manusiawi.
  const dimuatPada = Number(badan.dimuatPada);
  if (Number.isFinite(dimuatPada) && dimuatPada > 0) {
    const detik = (Date.now() - dimuatPada) / 1000;
    if (detik >= 0 && detik < MIN_ISI_DETIK) {
      return NextResponse.json(
        { diterima: false, alasan: 'terdeteksi-bot', pesan: 'Kiriman ditolak.' },
        { status: 422 },
      );
    }
  }

  const galat = validasi(badan);
  if (Object.keys(galat).length) {
    return NextResponse.json(
      { diterima: false, alasan: 'validasi-gagal', galat },
      { status: 400 },
    );
  }

  /**
   * Kuota diperiksa paling akhir, sesudah honeypot dan validasi.
   *
   * Penolakan yang murah dikerjakan lebih dulu, dan kuota hanya dihabiskan
   * oleh kiriman yang benar-benar diterima — sehingga banjir permintaan sampah
   * tidak bisa memakai jatah pengunjung yang sah pada IP bersama (kantor,
   * kampus, atau NAT operator seluler).
   */
  if (lewatBatas(ip)) {
    return NextResponse.json(
      { diterima: false, alasan: 'terlalu-sering', pesan: 'Terlalu banyak kiriman. Coba lagi beberapa menit lagi.' },
      { status: 429, headers: { 'Retry-After': String(BATAS_JENDELA_MS / 1000) } },
    );
  }

  catatLaju(ip);

  /**
   * Di produksi, di sinilah pesan diteruskan: simpan ke WordPress lewat REST
   * API, kirim email, atau masukkan ke antrean. Demo ini berhenti di sini
   * supaya tidak ada data pengunjung yang benar-benar tersimpan.
   */
  return NextResponse.json({
    diterima: true,
    ringkasan: {
      nama: teks(badan.nama),
      email: teks(badan.email),
      topik: TOPIK.includes(teks(badan.topik) as (typeof TOPIK)[number])
        ? teks(badan.topik)
        : 'lainnya',
      panjangPesan: teks(badan.pesan).length,
    },
    waktu: new Date().toISOString(),
  });
}

/* ── Validasi ───────────────────────────────────────────────────── */

function validasi(b: Kiriman): Record<string, string> {
  const galat: Record<string, string> = {};

  const nama = teks(b.nama);
  if (nama.length < 2 || nama.length > 80) {
    galat.nama = 'Nama harus 2–80 karakter.';
  }

  const email = teks(b.email);
  // Sengaja longgar: yang penting bentuknya masuk akal, bukan menebak-nebak
  // aturan RFC yang justru sering menolak alamat yang sah.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email) || email.length > 160) {
    galat.email = 'Alamat email tidak valid.';
  }

  const pesan = teks(b.pesan);
  if (pesan.length < 10 || pesan.length > 2000) {
    galat.pesan = 'Pesan harus 10–2000 karakter.';
  }
  if (/https?:\/\/\S+.*https?:\/\/\S+/i.test(pesan)) {
    galat.pesan = 'Pesan mengandung terlalu banyak tautan.';
  }

  const topik = teks(b.topik);
  if (topik && !TOPIK.includes(topik as (typeof TOPIK)[number])) {
    galat.topik = 'Topik tidak dikenal.';
  }

  return galat;
}

/* ── Pembantu ───────────────────────────────────────────────────── */

const teks = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

async function bacaBadan(request: Request): Promise<Kiriman | null> {
  const tipe = request.headers.get('content-type') ?? '';

  if (tipe.includes('application/json')) {
    return (await request.json().catch(() => null)) as Kiriman | null;
  }

  if (tipe.includes('form')) {
    const form = await request.formData().catch(() => null);
    if (!form) return null;
    return Object.fromEntries(form.entries()) as Kiriman;
  }

  return null;
}

function alamatIp(request: Request): string {
  const teruskan = request.headers.get('x-forwarded-for');
  return (teruskan?.split(',')[0] ?? request.headers.get('x-real-ip') ?? 'lokal').trim();
}

function lewatBatas(ip: string): boolean {
  const sekarang = Date.now();
  const riwayat = (jejakLaju.get(ip) ?? []).filter((t) => sekarang - t < BATAS_JENDELA_MS);
  jejakLaju.set(ip, riwayat);
  return riwayat.length >= BATAS_JUMLAH;
}

function catatLaju(ip: string) {
  const riwayat = jejakLaju.get(ip) ?? [];
  riwayat.push(Date.now());
  jejakLaju.set(ip, riwayat);

  // Jaga peta tetap kecil pada proses yang berumur panjang.
  if (jejakLaju.size > 5000) {
    const sekarang = Date.now();
    for (const [kunci, waktu] of jejakLaju) {
      if (!waktu.some((t) => sekarang - t < BATAS_JENDELA_MS)) jejakLaju.delete(kunci);
    }
  }
}
