import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  DatabaseHelper,
  DB_BLOCKED_REASONS,
} from '../../helpers/database-helper';

/**
 * ============================================================
 * Database Data Integrity — การตรวจสอบข้อมูลในฐานข้อมูล
 * ============================================================
 * อ้างอิง Test Plan: TC-DB-001 .. TC-DB-004 (docs/test-plan.md)
 * และ docs/database-mapping.md
 *
 * สถานะจริง ณ วันที่สร้างชุดทดสอบ:
 *   ยังไม่ได้รับ DATABASE_URL / สิทธิ์เข้าถึงฐานข้อมูลของ learnace.tech
 *   และไม่มี Source Code หรือ Schema ให้ตรวจสอบ → ห้ามเดาชื่อตาราง/คอลัมน์
 *
 * พฤติกรรมของชุดทดสอบนี้:
 *   1) ไม่มี DATABASE_URL → รายงาน "BLOCKED" พร้อมเหตุผลชัดเจน
 *      (test.skip พร้อมเหตุผล — ไม่ปลอมผล PASS, ไม่ปิดบังปัญหา)
 *   2) มี DATABASE_URL → เชื่อมต่อแบบ READ-ONLY ค้น schema จริงจาก
 *      information_schema แล้วบันทึก Database Inventory Report
 *      (reports/db-inventory.json) — assertion ระดับ business จะทำงาน
 *      เฉพาะกับตารางที่ "ค้นพบจริง" เท่านั้น
 */

let blockedReason: string | null = null;
let dbHelper: DatabaseHelper | null = null;

test.beforeAll(async () => {
  dbHelper = new DatabaseHelper();
  blockedReason = await dbHelper.readinessIssue();
});

test.afterAll(async () => {
  await dbHelper?.close();
});

test.describe('Database — การเชื่อมต่อและสถานะสิทธิ์', () => {
  test('[TC-DB-001] สถานะการเข้าถึงฐานข้อมูล — ต้องรายงาน BLOCKED อย่างชัดเจนเมื่อไม่มีสิทธิ์', async () => {
    test.skip(blockedReason === null, 'มีสิทธิ์เข้าถึงแล้ว — ข้ามการตรวจสถานะ BLOCKED');

    // ยืนยันว่า "เหตุผลของการถูกบล็อก" ถูกระบุชัดเจน ไม่ใช่ปิดบังอย่างเงียบ ๆ
    expect(blockedReason, 'ต้องมีเหตุผล BLOCKED ที่อธิบายได้').toBeTruthy();
    expect(blockedReason).toMatch(/^BLOCKED:/);

    // รายงานเหตุผลลง attachment เพื่อโชว์ใน HTML Report
    test.info().attach('database-blocked-reason.txt', {
      body: blockedReason ?? '',
      contentType: 'text/plain',
    });
  });

  test('[TC-DB-002] เชื่อมต่อฐานข้อมูลแบบ READ-ONLY สำเร็จ', async () => {
    test.skip(blockedReason !== null, blockedReason ?? DB_BLOCKED_REASONS.noUrl);

    await dbHelper!.connect();
    const result =
      await dbHelper!.query('SELECT 1 AS ping;');
    expect(Number(result.rows[0]?.ping ?? result.rows[0]?.[Object.keys(result.rows[0] ?? {})[0] ?? ''] ?? 0)).toBe(1);
  });

  test('[TC-DB-003] ค้นพบ schema จริงทั้งหมด (ไม่ใช้การเดา) และบันทึก Database Inventory', async () => {
    test.skip(blockedReason !== null, blockedReason ?? DB_BLOCKED_REASONS.noUrl);

    await dbHelper!.connect();
    const inventory = await dbHelper!.discoverSchema();

    expect(
      inventory.tables.length,
      'ต้องค้นพบตารางอย่างน้อย 1 ตารางจากฐานข้อมูลจริง'
    ).toBeGreaterThanOrEqual(1);

    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync(
      path.join('reports', 'db-inventory.json'),
      JSON.stringify(inventory, null, 2),
      'utf8'
    );

    test.info().attach('db-inventory.json', {
      body: JSON.stringify(inventory, null, 2),
      contentType: 'application/json',
    });
  });

  test('[TC-DB-004] Read-only guard ทำงาน — คำสั่งเขียนถูกปฏิเสธจากชั้นทดสอบ', async () => {
    test.skip(blockedReason !== null, blockedReason ?? DB_BLOCKED_REASONS.noUrl);

    // ยืนยันว่า helper กันคำสั่งเขียนเสมอ แม้ผู้ใช้พิมพ์ผิดใส่มาใน query
    await dbHelper!.connect();
    await expect(
      dbHelper!.query('DELETE FROM whatever_table;')
    ).rejects.toThrow(/ห้ามรันคำสั่งเขียน/i);
  });
});
