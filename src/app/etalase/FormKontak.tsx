'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Form kontak.
 *
 * Komponen ini sengaja tidak memvalidasi apa pun yang menentukan diterima atau
 * tidaknya kiriman — semua keputusan ada di /api/kontak. Yang dikerjakan di
 * sini hanya menampilkan hasilnya, plus dua saringan spam yang memang harus
 * hidup di browser: honeypot dan penanda waktu form dimuat.
 */

type Balasan = {
  diterima: boolean;
  alasan?: string;
  pesan?: string;
  galat?: Record<string, string>;
};

export default function FormKontak() {
  const dimuatPada = useRef(0);
  const [kirim, setKirim] = useState(false);
  const [hasil, setHasil] = useState<Balasan | null>(null);

  // Diisi setelah render supaya HTML server dan klien tetap identik.
  useEffect(() => { dimuatPada.current = Date.now(); }, []);

  async function tangani(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setKirim(true);
    setHasil(null);

    const data = Object.fromEntries(new FormData(e.currentTarget).entries());

    try {
      const res = await fetch('/api/kontak', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...data, dimuatPada: dimuatPada.current }),
      });
      setHasil((await res.json()) as Balasan);
    } catch {
      setHasil({ diterima: false, pesan: 'Gagal menghubungi server. Coba lagi.' });
    } finally {
      setKirim(false);
    }
  }

  const galat = hasil?.galat ?? {};

  return (
    <form className="form-kontak" onSubmit={tangani} noValidate>
      <div>
        <label htmlFor="nama">Nama</label>
        <input id="nama" name="nama" autoComplete="name" required />
        {galat.nama && <p className="galat">{galat.nama}</p>}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        {galat.email && <p className="galat">{galat.email}</p>}
      </div>

      <div>
        <label htmlFor="topik">Topik</label>
        <select id="topik" name="topik" defaultValue="proyek-baru">
          <option value="proyek-baru">Proyek baru</option>
          <option value="migrasi">Migrasi ke headless</option>
          <option value="audit-seo">Audit SEO teknis</option>
          <option value="lainnya">Lainnya</option>
        </select>
        {galat.topik && <p className="galat">{galat.topik}</p>}
      </div>

      <div>
        <label htmlFor="pesan">Pesan</label>
        <textarea id="pesan" name="pesan" required />
        {galat.pesan && <p className="galat">{galat.pesan}</p>}
      </div>

      {/* Honeypot: pengunjung tidak pernah melihat atau mendengar field ini. */}
      <div className="jebakan" aria-hidden="true">
        <label htmlFor="situsWeb">Situs web (jangan diisi)</label>
        <input id="situsWeb" name="situsWeb" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <button type="submit" disabled={kirim}>
        {kirim ? 'Mengirim…' : 'Kirim pesan'}
      </button>

      {hasil && (
        <p
          className={hasil.diterima ? 'sukses' : 'galat'}
          role="status"
          aria-live="polite"
        >
          {hasil.diterima
            ? 'Terkirim. Demo ini tidak menyimpan data — validasi server berjalan, isinya dibuang.'
            : hasil.pesan ?? 'Ada isian yang perlu diperbaiki.'}
        </p>
      )}
    </form>
  );
}
