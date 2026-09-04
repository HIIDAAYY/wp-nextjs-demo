import { test, expect } from '@playwright/test';

/**
 * API testing — dijalankan lewat request fixture Playwright,
 * tanpa membuka browser sama sekali. Cepat, dan menguji lapisan
 * yang tidak kelihatan dari layar.
 */
test.describe('Endpoint HTTP', () => {
  test('endpoint revalidasi menolak permintaan tanpa secret', async ({ request }) => {
    const res = await request.post('/api/revalidate', { data: {} });
    expect(res.status(), 'endpoint revalidasi terbuka tanpa secret').toBe(401);
  });

  test('endpoint revalidasi menolak secret yang salah', async ({ request }) => {
    const res = await request.post('/api/revalidate', { data: { secret: 'secret-yang-salah' } });
    expect(res.status(), 'secret salah tidak ditolak').toBe(401);
  });

  test('sitemap.xml tersaji dan berisi daftar URL', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('xml');

    const body = await res.text();
    expect(body).toContain('<urlset');
    const jumlahUrl = (body.match(/<loc>/g) ?? []).length;
    expect(jumlahUrl, 'sitemap kosong — halaman tidak akan terindeks').toBeGreaterThan(0);
  });

  test('robots.txt tersaji dan menunjuk ke sitemap', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    expect((await res.text()).toLowerCase()).toContain('sitemap');
  });

  test('alamat yang tidak ada membalas 404, bukan 200 kosong', async ({ request }) => {
    const res = await request.get('/halaman-yang-tidak-pernah-ada-8f2a');
    // 200 di sini berbahaya: Google akan mengindeks halaman kosong sebagai halaman sah.
    expect(res.status(), 'soft-404 terdeteksi').toBe(404);
  });
});
