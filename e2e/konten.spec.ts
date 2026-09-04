import { test, expect } from '@playwright/test';

/**
 * Lapisan browser: hanya untuk hal yang memang butuh rendering nyata.
 * Pemeriksaan SEO TIDAK ditaruh di sini — lihat seo-html-mentah.spec.ts
 * untuk alasannya (hydration menutupi kerusakan di HTML server).
 */
test.describe('Tampilan dan navigasi', () => {
  test('beranda terbuka dan judul utamanya terlihat', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('artikel bisa dibuka dari beranda lewat tautan sungguhan', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const tautan = page.locator('a[href*="/artikel/"]').first();
    await expect(tautan, 'tidak ada satu pun tautan artikel di beranda').toBeVisible();
    await tautan.click();

    await page.waitForURL(/\/artikel\//);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('halaman artikel tidak menampilkan pesan error React', async ({ page }) => {
    const errorKonsol: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errorKonsol.push(m.text()); });

    await page.goto('/artikel/open-weight', { waitUntil: 'load' });
    await page.waitForTimeout(1500);

    const serius = errorKonsol.filter((t) => /hydration|Minified React error|Uncaught/i.test(t));
    expect(serius, `error serius di konsol: ${serius.join(' | ')}`).toHaveLength(0);
  });
});
