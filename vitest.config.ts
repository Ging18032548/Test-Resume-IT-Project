import { defineConfig } from 'vitest/config';

/**
 * ============================================================
 * Vitest — ชั้น Unit Test ของเฟรมเวิร์ก (แยกจาก Playwright)
 * ============================================================
 * รันด้วย: npm run test:unit
 * ขอบเขต: tests/unit/** เท่านั้น — ห้ามให้ Playwright (testDir ./tests)
 * จับไฟล์ .test.ts ของชั้นนี้ (ป้องกันด้วยการตั้ง testMatch ให้จับเฉพาะ .spec.ts
 * ใน playwright.config.ts)
 *
 * ขอบเขตที่รายงานตรงไปตรงมา: learnace.tech เป็นเว็บภายนอกที่เราไม่มี
 * โค้ดต้นทาง จึง unit test ได้เฉพาะ "โค้ดของเฟรมเวิร์ก" ที่ map กับ
 * ฟังก์ชันของเว็บ (กติกา login/register/upload, envelope, DB guard,
 * การสร้างข้อมูลทดสอบ) — พฤติกรรมปลายทางจริงยังคุมด้วย E2E/API/DB
 */
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
  },
});