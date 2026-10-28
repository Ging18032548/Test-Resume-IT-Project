import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DatabaseHelper,
  detectDriver,
  DB_BLOCKED_REASONS,
} from '../../helpers/database-helper';

/**
 * ============================================================
 * Unit Tests — helpers/database-helper.ts (ชั้นเชื่อมฐานข้อมูล)
 * ============================================================
 * ครอบคลุม:
 *  - detectDriver(): จำแนก postgres/mysql/ไม่รู้จัก/ว่าง
 *  - readinessIssue(): เหตุผล BLOCKED มาตรฐาน (ไม่มี URL / scheme ไม่รองรับ / ไม่มี driver)
 *  - query(): READ-ONLY guard — คำสั่งเขียนทุกชนิดต้องถูกโยนออก (กันเผลอแตะ DB จริง)
 *  - query(): จัดรูปผลลัพธ์ทั้งแบบ pg (rows) และ mysql ([rows, fields])
 *
 * การทดสอบทั้งหมด "ไม่แตะฐานข้อมูลจริง" — ใช้ fake client ฉีดเข้าไป
 * (private fields เข้าถึงผ่าน cast เพื่อ unit test เท่านั้น)
 */

beforeEach(() => {
  delete process.env.DATABASE_URL;
});

describe('detectDriver — จำแนกชนิดฐานข้อมูลจาก DATABASE_URL', () => {
  it('postgres:// → postgres', () => {
    expect(detectDriver('postgres://user:pass@host:5432/db')).toBe('postgres');
  });

  it('postgresql:// → postgres', () => {
    expect(detectDriver('postgresql://user:pass@host:5432/db')).toBe('postgres');
  });

  it('mysql:// → mysql', () => {
    expect(detectDriver('mysql://user:pass@host:3306/db')).toBe('mysql');
  });

  it('scheme อื่น (mongodb / sqlserver) → null (ไม่เดา รายงาน BLOCKED)', () => {
    expect(detectDriver('mongodb://host/db')).toBe(null);
    expect(detectDriver('sqlserver://host')).toBe(null);
  });

  it('URL ว่าง → null', () => {
    expect(detectDriver('')).toBe(null);
  });
});

describe('readinessIssue — เหตุผล BLOCKED มาตรฐาน (ไม่ปลอมผล)', () => {
  it('ไม่มี DATABASE_URL → สาเหตุ noUrl', async () => {
    const helper = new DatabaseHelper('');
    expect(await helper.readinessIssue()).toBe(DB_BLOCKED_REASONS.noUrl);
  });

  it('ไม่ส่ง URL และไม่มี env → ดึงจาก env (ว่าง) → noUrl', async () => {
    const helper = new DatabaseHelper();
    expect(await helper.readinessIssue()).toBe(DB_BLOCKED_REASONS.noUrl);
  });

  it('scheme ไม่รองรับ → สาเหตุระบุ scheme ชัดเจน', async () => {
    const helper = new DatabaseHelper('mongodb://host/db');
    const issue = await helper.readinessIssue();
    expect(issue).toContain('BLOCKED');
    expect(issue).toContain('postgres://');
    expect(issue).toContain('mysql://');
  });

  it('postgres:// และติดตั้ง pg แล้ว → พร้อมใช้ (null)', async () => {
    const pgInstalled = await import('pg').then(() => true).catch(() => false);
    if (!pgInstalled) return; // เครื่องไม่ได้ลง optionalDependency — ข้ามเคสนี้
    const helper = new DatabaseHelper('postgres://user:pass@localhost:5432/qadb');
    expect(await helper.readinessIssue()).toBe(null);
  });

  it('mysql:// และติดตั้ง mysql2 แล้ว → พร้อมใช้ (null)', async () => {
    const mysqlInstalled = await import('mysql2/promise').then(() => true).catch(() => false);
    if (!mysqlInstalled) return;
    const helper = new DatabaseHelper('mysql://user:pass@localhost:3306/qadb');
    expect(await helper.readinessIssue()).toBe(null);
  });
});

describe('query — READ-ONLY guard (ห้ามคำสั่งเขียนจากชั้นทดสอบ)', () => {
  const makeConnectedHelper = (driver: 'postgres' | 'mysql', fakeClient: unknown) => {
    const helper = new DatabaseHelper(
      driver === 'postgres'
        ? 'postgres://user:pass@localhost:5432/qadb'
        : 'mysql://user:pass@localhost:3306/qadb'
    );
    const internal = helper as unknown as Record<string, unknown>;
    internal.driver = driver;
    internal.client = fakeClient;
    internal.connected = true;
    return helper;
  };

  const writeStatements = [
    'DROP TABLE users',
    'TRUNCATE TABLE users',
    'ALTER TABLE users ADD COLUMN x INT',
    'CREATE TABLE hacked (id INT)',
    'INSERT INTO users VALUES (1)',
    'UPDATE users SET role = "ADMIN"',
    'DELETE FROM users',
    'GRANT ALL ON *.* TO someone',
    'REVOKE ALL ON *.* FROM someone',
    'CALL some_procedure()',
  ];

  for (const sql of writeStatements) {
    it(`ปฏิเสธ: ${sql.split(' ')[0]} — โยน error ก่อนถึง client เสมอ`, async () => {
      const querySpy = vi.fn();
      const helper = makeConnectedHelper('postgres', { query: querySpy });
      await expect(helper.query(sql)).rejects.toThrow('ห้ามรันคำสั่งเขียน');
      expect(querySpy).not.toHaveBeenCalled(); // guard ต้องมาก่อนแตะ DB
    });
  }

  it('ปฏิเสธแบบ case-insensitive (drop / Drop / DROP)', async () => {
    const helper = makeConnectedHelper('postgres', { query: vi.fn() });
    await expect(helper.query('drop table users')).rejects.toThrow();
    await expect(helper.query('Drop Table users')).rejects.toThrow();
  });

  it('ยอมรับ SELECT และส่ง rows ของ pg กลับมาถูกรูป', async () => {
    const fakeRows = [{ table_name: 'users' }, { table_name: 'resumes' }];
    const querySpy = vi.fn().mockResolvedValue({ rows: fakeRows });
    const helper = makeConnectedHelper('postgres', { query: querySpy });
    const result = await helper.query('SELECT table_name FROM information_schema.tables;');
    expect(result.rows).toEqual(fakeRows);
    expect(result.rowCount).toBe(2);
    expect(querySpy).toHaveBeenCalledTimes(1);
  });

  it('ยอมรับ SELECT และส่ง rows ของ mysql (รูป [rows, fields]) กลับมาถูกรูป', async () => {
    const fakeRows = [{ column_name: 'email' }];
    const querySpy = vi.fn().mockResolvedValue([fakeRows, []]);
    const helper = makeConnectedHelper('mysql', { query: querySpy });
    const result = await helper.query('SELECT column_name FROM information_schema.columns;');
    expect(result.rows).toEqual(fakeRows);
    expect(result.rowCount).toBe(1);
  });

  it('ยังไม่ connect → โยน error สั่งให้เรียก connect() ก่อน', async () => {
    const helper = new DatabaseHelper('postgres://user:pass@localhost:5432/qadb');
    await expect(helper.query('SELECT 1')).rejects.toThrow('เรียก connect() ก่อน');
  });

  it('เรียก connect() โดยไม่ผ่าน readinessIssue() → โยน error ชัดเจน', async () => {
    const helper = new DatabaseHelper('mongodb://host/db');
    await expect(helper.connect()).rejects.toThrow('readinessIssue');
  });
});
