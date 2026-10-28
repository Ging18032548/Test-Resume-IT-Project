import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const baseURL = process.env.BASE_URL || 'https://learnace.tech';

/**
 * โหมด Offline: เมื่อ BASE_URL ชี้ไปที่ localhost — Playwright จะสตาร์ท
 * scripts/mock-app-server.js (web app จำลอง + API ในเครื่อง) ให้อัตโนมัติ
 * เพื่อใช้ตรวจความถูกต้องของเฟรมเวิร์กโดยไม่แตะระบบจริงเลย
 * (สภาพแวดล้อม sandbox เชื่อมต่อ learnace.tech ตรงไม่ได้ — พิสูจน์ด้วย curl timeout)
 */
const isOffline = /localhost|127\.0\.0\.1/.test(baseURL);

const testTimeout = Number(process.env.TEST_TIMEOUT) || 120_000;
const expectTimeout = Number(process.env.EXPECT_TIMEOUT) || 15_000;

export default defineConfig({
  testDir: './tests',

  /* จับเฉพาะ *.spec.ts — ไม่ให้ Playwright ไปหยิบ tests/unit/*.test.ts ของ Vitest
   * (unit tests รันด้วยคำสั่งแยก: npm run test:unit) */
  testMatch: '**/*.spec.ts',

  outputDir: './test-results',

  /* เทสต์แต่ละไฟล์ไม่พึ่งพาลำดับการรัน — รันขนาน/สลับลำดับได้ */
  fullyParallel: true,

  forbidOnly: !!process.env.CI,

  /* เว็บจริงอยู่หลัง Cloudflare tunnel — โหลดช้าเป็นครั้งคราว
   * รัน local ให้ retry 1 ครั้ง (Playwright แยกสถานะ flaky ในรายงาน ไม่ปิดบังความล้มเหลวจริง)
   * CI มี retry 2 อยู่แล้ว */
  retries: process.env.CI ? 2 : 1,

  workers: process.env.CI ? 1 : undefined,

  timeout: testTimeout,

  expect: {
    timeout: expectTimeout,
  },

  /**
   * HTML Report — ฝัง screenshot + video ของเคสที่ fail โดยอัตโนมัติ
   * open: 'always' → เปิดรายงานบนเบราว์เซอร์ทันทีหลังรันเสร็จ
   * (บน CI/headless ที่ไม่มีจอ ให้ override เป็น npm run test ด้วย --reporter=line)
   */
  reporter: [
    ['html', {
      outputFolder: 'playwright-report',
      open: process.env.CI ? 'on-failure' : 'always',
    }],
    ['json', {
      outputFile: 'reports/test-results.json',
    }],
  ],

  use: {
    baseURL,

    actionTimeout: 15_000,

    /* เว็บจริง (Cloudflare tunnel) เคยโหลดเกิน 30s — พิสูจน์จาก TC-AUTH-004
     * TimeoutError บน Desktop Firefox จริง จึงยกเป็น 60s */
    navigationTimeout: 60_000,

    /* Media & Diagnostics — ฝังใน HTML Report อัตโนมัติ */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    ignoreHTTPSErrors: true,
  },

  /* Cross-Device / Cross-Browser Matrix (5 Projects ตาม MASTER PROMPT) */
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'Desktop Safari',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* ใช้เฉพาะโหมด Offline — สตาร์ท mock app server ให้เอง (port ต้องตรงกับ scripts/mock-app-server.js) */
  webServer: isOffline
    ? {
        command: 'node scripts/mock-app-server.js',
        url: 'http://127.0.0.1:4310/sign-in',
        reuseExistingServer: true,
        timeout: 15_000,
      }
    : undefined,
});