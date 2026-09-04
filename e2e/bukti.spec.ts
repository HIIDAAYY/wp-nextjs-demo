import { test, expect } from '@playwright/test';

/**
 * Halaman /bukti menjalankan 14 pemeriksaan terhadap situsnya sendiri
 * tiap kali dibuka. Test ini lapisan kedua: memastikan laporan itu
 * masih berkata semuanya lolos, dan bahwa halamannya benar-benar
 * diperiksa saat dibuka, bukan disajikan dari cache.
 *
 * Versi HTML-server dari pemeriksaan ini ada di seo-html-mentah.spec.ts.
 */
test.describe('Halaman bukti teknis (di browser)', () => {
  test('ringkasan menunjukkan seluruh pemeriksaan lolos', async ({ page }) => {
    const res = await page.goto('/bukti', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);

    const ringkasan = page.getByText(/\d+\s+dari\s+\d+\s+lolos/i);
    await expect(ringkasan).toBeVisible();

    const teks = (await ringkasan.textContent()) ?? '';
    const cocok = teks.match(/(\d+)\s+dari\s+(\d+)\s+lolos/i);
    expect(cocok, `baris ringkasan tidak terbaca: "${teks}"`).not.toBeNull();

    const lolos = Number(cocok![1]);
    const total = Number(cocok![2]);
    expect(total, 'jumlah pemeriksaan menyusut — ada yang hilang').toBeGreaterThanOrEqual(14);
    expect(lolos, `${total - lolos} pemeriksaan gagal`).toBe(total);
  });

  test('tidak ada kartu berstatus GAGAL yang terlihat', async ({ page }) => {
    await page.goto('/bukti', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/\d+\s+dari\s+\d+\s+lolos/i)).toBeVisible();

    await expect(page.getByText('GAGAL', { exact: true })).toHaveCount(0);
    expect(await page.getByText('LOLOS', { exact: true }).count()).toBeGreaterThanOrEqual(14);
  });

  test('halaman benar-benar diperiksa saat dibuka, bukan dari cache', async ({ page }) => {
    await page.goto('/bukti', { waitUntil: 'domcontentloaded' });

    const body = await page.locator('body').innerText();
    const stempel = body.match(/(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/);
    expect(stempel, 'stempel waktu pemeriksaan tidak ditemukan').not.toBeNull();

    const selisihMenit = (Date.now() - new Date(stempel![1]).getTime()) / 60_000;
    expect(selisihMenit, 'halaman tersaji dari cache — angkanya bukan hasil pemeriksaan saat dibuka').toBeLessThan(10);
  });
});
