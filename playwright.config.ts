import { defineConfig, devices } from '@playwright/test';

/**
 * Suite E2E + API untuk headless-wp-nextjs-demo.
 * Menguji situs yang benar-benar sudah tayang, bukan server lokal,
 * supaya kegagalan yang tertangkap adalah kegagalan yang dilihat pengguna.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 15_000 },

  // Di CI: jangan izinkan test.only tertinggal, dan ulangi sekali
  // supaya kegagalan jaringan sesaat tidak dilaporkan sebagai bug.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/hasil.json' }],
  ],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://headless-wp-nextjs-demo.vercel.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
