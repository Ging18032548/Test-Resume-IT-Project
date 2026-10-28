/**
 * ============================================================
 * Database Helper — ตัวเชื่อมฐานข้อมูลแบบ READ-ONLY + Schema Discovery
 * ============================================================
 * หลักการตาม MASTER PROMPT (Phase 2 + Phase 4):
 *  1. ห้ามเดาชื่อตาราง/คอลัมน์ — ต้องค้นจาก information_schema ของระบบจริง
 *  2. ใช้ DATABASE_URL จาก environment เท่านั้น (ห้าม hardcode credential)
 *  3. บังคับ READ-ONLY ที่ระดับ session (PostgreSQL: default_transaction_read_only,
 *     MySQL: SESSION TRANSACTION READ ONLY)
 *  4. ไม่มี DATABASE_URL = รายงาน BLOCKED พร้อมเหตุผล — ไม่ปลอมผล
 *  5. ห้าม DROP/TRUNCATE/UPDATE/DELETE/INSERT ในชั้นนี้ (ตรวจด้วย guard)
 *
 * รองรับ PostgreSQL (postgres://) และ MySQL (mysql://) ด้วยการ dynamic-import
 * ไดรเวอร์ที่ตรงกับ scheme — ถ้ายังไม่ติดตั้ง จะรายงานเหตุผลชัดเจนแทนการพัง
 */

export type DbDriver = 'postgres' | 'mysql' | null;

export interface DbQueryResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number;
}

export interface SchemaInventory {
  driver: Exclude<DbDriver, null>;
  databaseName: string;
  tables: Array<{
    name: string;
    columns: Array<{ name: string; dataType: string; nullable: boolean; key: string | null }>;
  }>;
  discoveredAt: string;
}

/** เหตุผลมาตรฐานของสถานะ BLOCKED (ใช้แสดงในรายงานให้ตรงกันทุกที่) */
export const DB_BLOCKED_REASONS = {
  noUrl:
    'BLOCKED: ยังไม่ได้รับ DATABASE_URL / สิทธิ์เข้าถึงฐานข้อมูล — Database Assertions จึงยังไม่ได้ Query จริง (ตามข้อกำหนดห้ามเดา schema)',
  noDriver:
    'BLOCKED: ไม่พบไดรเวอร์ฐานข้อมูล (pg / mysql2) — รัน npm install เพื่อติดตั้ง optionalDependencies',
} as const;

/** ตรวจจับชนิดฐานข้อมูลจาก DATABASE_URL scheme */
export function detectDriver(databaseUrl: string): DbDriver {
  if (!databaseUrl) return null;
  if (/^postgres(ql)?:\/\//i.test(databaseUrl)) return 'postgres';
  if (/^mysql:\/\//i.test(databaseUrl)) return 'mysql';
  return null;
}

/** คำสั่ง SQL ที่ห้ามรันเด็ดขาดจากชั้นทดสอบ (read-only guard) */
const FORBIDDEN_SQL = /\b(drop|truncate|alter|create|insert|update|delete|grant|revoke|call)\b/i;

export class DatabaseHelper {
  private databaseUrl: string;
  private driver: DbDriver = null;
  private client: unknown = null;
  private connected = false;

  constructor(databaseUrl?: string) {
    this.databaseUrl = databaseUrl ?? process.env.DATABASE_URL ?? '';
  }

  /** สถานะพร้อมใช้งาน — คืน null ถ้าพร้อม หรือเหตุผล BLOCKED ถ้าไม่พร้อม */
  async readinessIssue(): Promise<string | null> {
    if (!this.databaseUrl) return DB_BLOCKED_REASONS.noUrl;

    this.driver = detectDriver(this.databaseUrl);
    if (!this.driver) {
      return `BLOCKED: DATABASE_URL scheme ไม่รองรับ (รองรับเฉพาะ postgres:// และ mysql://)`;
    }

    try {
      if (this.driver === 'postgres') {
        await import('pg');
      } else {
        await import('mysql2/promise');
      }
    } catch {
      return DB_BLOCKED_REASONS.noDriver;
    }
    return null;
  }

  /** เชื่อมต่อแบบ read-only — เรียกหลัง readinessIssue() คืน null */
  async connect(): Promise<void> {
    if (this.connected) return;

    if (this.driver === 'postgres') {
      const { Client } = await import('pg');
      const client = new Client({ connectionString: this.databaseUrl });
      await client.connect();
      // บังคับ read-only ทั้ง session — ป้องกันการเขียนโดยไม่ตั้งใจ
      await client.query('SET default_transaction_read_only = on;');
      this.client = client;
    } else if (this.driver === 'mysql') {
      const mysql = await import('mysql2/promise');
      const conn = await mysql.createConnection(this.databaseUrl);
      await conn.query('SET SESSION TRANSACTION READ ONLY;');
      this.client = conn;
    } else {
      throw new Error('ยังตรวจจับไดรเวอร์ไม่สำเร็จ — เรียก readinessIssue() ก่อน connect()');
    }

    this.connected = true;
  }

  /** รันคำสั่ง SELECT เท่านั้น (มี guard กันคำสั่งเขียน) */
  async query(sql: string): Promise<DbQueryResult> {
    if (!this.connected) throw new Error('ยังไม่ได้เชื่อมต่อ — เรียก connect() ก่อน');
    if (FORBIDDEN_SQL.test(sql)) {
      throw new Error(`ห้ามรันคำสั่งเขียน/เปลี่ยนโครงสร้างจากชั้นทดสอบ: ${sql}`);
    }

    if (this.driver === 'postgres') {
      const client = this.client as { query: (s: string) => Promise<{ rows: Array<Record<string, unknown>> }> };
      const result = await client.query(sql);
      return { rows: result.rows, rowCount: result.rows.length };
    }

    const conn = this.client as {
      query: (s: string) => Promise<[Array<Record<string, unknown>>, unknown]>;
    };
    const [rows] = await conn.query(sql);
    return { rows, rowCount: rows.length };
  }

  /**
   * ค้นหาโครงสร้าง schema จริงทั้งหมด — หัวใจของ "ไม่เดา schema"
   * ใช้ information_schema ที่เป็นมาตรฐานทั้ง MySQL และ PostgreSQL
   */
  async discoverSchema(): Promise<SchemaInventory> {
    if (!this.driver) throw new Error('ยังตรวจจับไดรเวอร์ไม่สำเร็จ');

    const tablesSql =
      this.driver === 'postgres'
        ? `SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
           ORDER BY table_name;`
        : `SELECT table_name FROM information_schema.tables
           WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
           ORDER BY table_name;`;

    const tablesResult = await this.query(tablesSql);
    const inventory: SchemaInventory = {
      driver: this.driver,
      databaseName: '',
      tables: [],
      discoveredAt: new Date().toISOString(),
    };

    const dbNameResult =
      this.driver === 'postgres'
        ? await this.query('SELECT current_database() AS name;')
        : await this.query('SELECT DATABASE() AS name;');
    inventory.databaseName = String(dbNameResult.rows[0]?.name ?? '');

    for (const row of tablesResult.rows) {
      const tableName = String(row.table_name ?? row['TABLE_NAME'] ?? '');
      if (!tableName) continue;

      const columnsSql =
        this.driver === 'postgres'
          ? `SELECT column_name, data_type, is_nullable, null AS column_key
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = '${tableName.replace(/'/g, "''")}'
             ORDER BY ordinal_position;`
          : `SELECT column_name, data_type, is_nullable, column_key
             FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = '${tableName.replace(/'/g, "''")}'
             ORDER BY ordinal_position;`;

      const columnsResult = await this.query(columnsSql);
      inventory.tables.push({
        name: tableName,
        columns: columnsResult.rows.map((col) => ({
          name: String(col.column_name ?? ''),
          dataType: String(col.data_type ?? ''),
          nullable: String(col.is_nullable ?? 'YES').toUpperCase() === 'YES',
          key: col.column_key ? String(col.column_key) : null,
        })),
      });
    }

    return inventory;
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    try {
      if (this.driver === 'postgres') {
        await (this.client as { end: () => Promise<void> }).end();
      } else {
        await (this.client as { end: () => Promise<void> }).end();
      }
    } finally {
      this.connected = false;
      this.client = null;
    }
  }
}
