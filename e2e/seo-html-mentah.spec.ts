import { test, expect } from '@playwright/test';

/**
 * PENTING — kenapa berkas ini tidak memakai browser sama sekali.
 *
 * Next.js menyisipkan ulang tag <head> lewat React setelah hydration.
 * Akibatnya, kalau canonical HILANG dari HTML yang dikirim server,
 * DOM di browser TETAP memperlihatkannya — dan test berbasis browser
 * akan berkata "aman" padahal tidak.
 *
 * Crawler mesin pencari membaca HTML yang dikirim server. Jadi
 * pemeriksaan SEO harus dilakukan di lapisan itu, bukan di DOM.
 * Ini diverifikasi langsung: canonical dihapus dari HTML server,
 * DOM browser tetap menunjukkan 1 canonical.
 */
const ARTIKEL = '/artikel/open-weight';

async function ambilHtml(request: any, path: string) {
  const res = await request.get(path);
  expect(res.status(), `${path} tidak balas 200`).toBe(200);
  return await res.text();
}

test.describe('SEO pada HTML server (yang dilihat crawler)', () => {
  test('canonical ada di HTML server, absolut, dan menunjuk halaman itu sendiri', async ({ request }) => {
    const html = await ambilHtml(request, ARTIKEL);
    const cocok = html.match(/<link[^>]+rel="canonical"[^>]*>/i);
    expect(cocok, 'canonical tidak ada di HTML server — crawler tidak akan melihatnya').not.toBeNull();

    const href = cocok![0].match(/href="([^"]+)"/i)?.[1] ?? '';
    expect(href, 'canonical harus absolut').toMatch(/^https:\/\//);
    expect(href).toContain('/artikel/open-weight');
  });

  test('meta description dan Open Graph ada di HTML server', async ({ request }) => {
    const html = await ambilHtml(request, ARTIKEL);

    const desc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1] ?? '';
    expect(desc.length, 'meta description kosong di HTML server').toBeGreaterThan(20);

    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i)?.[1] ?? '';
    expect(ogTitle.length, 'og:title kosong — pratinjau tautan di WhatsApp akan polos').toBeGreaterThan(0);
  });

  test('JSON-LD ada di HTML server, sah, dan memuat tipe Article', async ({ request }) => {
    const html = await ambilHtml(request, ARTIKEL);
    const blok = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    expect(blok.length, 'tidak ada JSON-LD di HTML server').toBeGreaterThan(0);

    const tipe: string[] = [];
    for (const [i, b] of blok.entries()) {
      let data: any;
      expect(() => { data = JSON.parse(b[1]); }, `blok JSON-LD ke-${i + 1} bukan JSON sah`).not.toThrow();
      const daftar = Array.isArray(data) ? data : data['@graph'] ?? [data];
      for (const item of daftar) if (item?.['@type']) tipe.push(String(item['@type']));
    }
    expect(tipe.join(','), 'JSON-LD tidak memuat tipe Article').toContain('Article');
  });

  test('isi artikel sudah ada di HTML sebelum JavaScript jalan', async ({ request }) => {
    const html = await ambilHtml(request, ARTIKEL);
    expect(html, 'tidak ada <h1> di HTML server').toMatch(/<h1[\s>]/i);
    const paragraf = (html.match(/<p[\s>]/gi) ?? []).length;
    expect(paragraf, 'nyaris tidak ada paragraf di HTML server').toBeGreaterThan(3);
  });

  test('halaman bukti melaporkan seluruh pemeriksaan lolos di HTML server', async ({ request }) => {
    const html = await ambilHtml(request, '/bukti');
    const teks = html.replace(/<[^>]+>/g, ' ');
    const cocok = teks.match(/(\d+)\s+dari\s+(\d+)\s+lolos/i);
    expect(cocok, 'baris ringkasan tidak ada di HTML server').not.toBeNull();
    expect(Number(cocok![1]), 'ada pemeriksaan yang gagal').toBe(Number(cocok![2]));

    // Kata "GAGAL" hanya boleh muncul di kalimat penjelasan, bukan sebagai status kartu.
    const statusGagal = (html.match(/>GAGAL</g) ?? []).length;
    expect(statusGagal, 'ada kartu berstatus GAGAL di HTML server').toBe(0);
  });
});
