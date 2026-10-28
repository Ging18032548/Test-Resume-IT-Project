import { describe, it, expect } from 'vitest';
import {
  uniqueEmail,
  uniqueName,
  createTempFile,
  buildValidPdfBytes,
  buildFakePdfBytes,
  buildOversizedPdfBytes,
} from '../../helpers/test-data-factory';

/**
 * ============================================================
 * Unit Tests — helpers/test-data-factory.ts (โรงงานข้อมูลทดสอบ)
 * ============================================================
 * ครอบคลุมฟังก์ชันที่ทุกเทสต์ registration/upload ใช้:
 *  - uniqueEmail(): plus-addressing ไม่ซ้ำ — ถ้าซ้ำ = สมัครซ้ำพังเอง
 *  - uniqueName(): ชื่อไม่ซ้ำ
 *  - createTempFile(): สร้าง + cleanup จริงบนดิสก์
 *  - PDF builders: magic number ถูกต้อง (backend ตรวจ %PDF-), escaping,
 *    ขนาด boundary ของไฟล์ใหญ่เกิน 5MB
 */

describe('uniqueEmail — อีเมลไม่ซ้ำแบบ plus-addressing', () => {
  it('ฝัง prefix + stamp ระหว่าง local กับ domain', () => {
    const email = uniqueEmail('qa.tester@example.com', 'reg');
    expect(email).toMatch(/^qa\.tester\+reg-[0-9-]+@example\.com$/);
  });

  it('ไม่ซ้ำกันเมื่อเรียกหลายครั้งติดกัน (หัวใจของการสมัครซ้ำได้)', () => {
    const emails = new Set(
      Array.from({ length: 50 }, () => uniqueEmail('qa.tester@example.com', 'reg'))
    );
    expect(emails.size).toBe(50);
  });

  it('อีเมลที่ได้ต้องผ่านรูปแบบ RFC เบื้องต้น (มี @ และไม่มีช่องว่าง)', () => {
    for (let i = 0; i < 10; i++) {
      const email = uniqueEmail('qa.tester@example.com');
      expect(email).toContain('@');
      expect(email).not.toMatch(/\s/);
    }
  });

  it('baseEmail ไม่มี @ → fallback โดเมนปลอดภัย example.test', () => {
    const email = uniqueEmail('not-an-email', 'qa');
    expect(email).toMatch(/^qa\.[0-9-]+@example\.test$/);
  });

  it('เปลี่ยน prefix ได้ตามวัตถุประสงค์ของเทสต์', () => {
    expect(uniqueEmail('a@b.com', 'upload')).toMatch(/^a\+upload-[0-9-]+@b\.com$/);
  });
});

describe('uniqueName — ชื่อผู้ใช้ทดสอบไม่ซ้ำ', () => {
  it('มี prefix ตามที่ส่ง + suffix base36', () => {
    expect(uniqueName('QA Tester')).toMatch(/^QA Tester [0-9A-Z-]+$/);
  });

  it('ไม่ซ้ำกันเมื่อเรียกหลายครั้งติดกัน', () => {
    const names = new Set(Array.from({ length: 30 }, () => uniqueName()));
    expect(names.size).toBe(30);
  });
});

describe('createTempFile — ไฟล์ชั่วคราว + cleanup', () => {
  it('สร้างไฟล์จริงบนดิสก์ด้วย bytes ที่กำหนด', () => {
    const bytes = Buffer.from('learnace-unit-test');
    const file = createTempFile('sample.pdf', bytes);
    try {
      expect(require('fs').existsSync(file.path)).toBe(true);
      expect(require('fs').readFileSync(file.path)).toEqual(bytes);
    } finally {
      file.cleanup();
    }
  });

  it('cleanup() ลบโฟลเดอร์ทั้งโฟลเดอร์จริง', () => {
    const file = createTempFile('tmp.pdf', Buffer.from('%PDF-1.4'));
    const dir = require('path').dirname(file.path);
    file.cleanup();
    expect(require('fs').existsSync(dir)).toBe(false);
  });
});

describe('buildValidPdfBytes — PDF จริง 1 หน้า', () => {
  it('เริ่มด้วย magic number %PDF- และจบด้วย %%EOF (backend ตรวจสองจุดนี้)', () => {
    const pdf = buildValidPdfBytes();
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.subarray(-5).toString('latin1')).toBe('%%EOF');
  });

  it('มีโครงสร้าง xref ที่ backend/parser ต้องการ', () => {
    const pdf = buildValidPdfBytes().toString('latin1');
    expect(pdf).toContain('xref');
    expect(pdf).toContain('trailer');
    expect(pdf).toContain('/Type /Catalog');
  });

  it('escape วงเล็บในเนื้อหาไม่ให้ทำ PDF stream พัง', () => {
    const pdf = buildValidPdfBytes('Skills (Node.js) \\ React').toString('latin1');
    expect(pdf).toContain('Skills \\(Node.js\\) \\\\ React');
  });

  it('ขนาดเล็กกว่าลิมิต 5MB อย่างชัดเจน (เคส "ไฟล์ปกติ")', () => {
    expect(buildValidPdfBytes().length).toBeLessThan(5 * 1024 * 1024);
  });
});

describe('buildFakePdfBytes — ไฟล์ชื่อ .pdf แต่เนื้อหาไม่ใช่ PDF', () => {
  it('ต้องไม่ขึ้นต้นด้วย magic number %PDF- (ใช้ยิง negative case)', () => {
    const bytes = buildFakePdfBytes();
    expect(bytes.subarray(0, 5).toString('latin1')).not.toBe('%PDF-');
  });
});

describe('buildOversizedPdfBytes — boundary ขนาดไฟล์ > 5MB', () => {
  it('ใหญ่กว่าลิมิตที่ระบุเสมอ', () => {
    const limit = 5 * 1024 * 1024;
    const bytes = buildOversizedPdfBytes(limit);
    expect(bytes.length).toBeGreaterThan(limit);
  });

  it('ใหญ่กว่าลิมิตแบบ default ด้วย', () => {
    const bytes = buildOversizedPdfBytes();
    expect(bytes.length).toBeGreaterThan(5 * 1024 * 1024);
  });

  it('ยังเป็น PDF ที่ magic number ถูกต้อง (ทดสอบ "ใหญ่แต่รูปแบบถูก")', () => {
    const bytes = buildOversizedPdfBytes(1024);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
