import { describe, it, expect } from 'vitest';
import {
  MOCK_USER,
  MOCK_TOKEN,
  MOCK_RESUME,
  MOCK_SECTION_SCORES,
  MOCK_RADAR_DATA,
  MOCK_ANALYSIS,
  MOCK_ADMIN_STATS,
  MOCK_ADMIN_USERS,
} from '../../fixtures/test-fixtures';

/**
 * ============================================================
 * Unit Tests — fixtures/test-fixtures.ts (ข้อมูล mock + โทเคน)
 * ============================================================
 * ครอบคลุม:
 *  - MOCK_TOKEN: โครงสร้างที่ isAuthed() ใช้ตัดสินว่า request "ล็อกอินแล้ว"
 *    (ผิดที่นี่ = E2E authenticated flow ทั้งชุดพัง)
 *  - Payload ของโทเคน: base64url decode ได้ มี sub/role/exp จริง
 *  - MOCK_ANALYSIS / MOCK_RADAR_DATA: ความสอดคล้องภายในของข้อมูลผลวิเคราะห์
 *    (คะแนนรวมอยู่ในช่วง 0-100, radar ตรงกับ section scores, คะแนนในช่วงเหตุผล)
 *  - MOCK_ADMIN_STATS: byStatus รวมกันต้องเท่ากับ totalAnalyses
 *    (mock data ที่ไม่สมเหตุสมผล = เทสต์ Dashboard/Admin หลอกตัวเอง)
 */

describe('MOCK_TOKEN — โครงสร้างที่ isAuthed() ใช้ตัดสินสถานะล็อกอิน', () => {
  it('ต้องมี segment "mock.header" (เงื่อนไขแรกของ isAuthed)', () => {
    expect(MOCK_TOKEN).toContain('mock.header');
  });

  it('ต้องมี 4 segment ตามรูปแบบ mock.header.<payload>.mock-signature', () => {
    expect(MOCK_TOKEN.split('.')).toHaveLength(4);
  });

  it('payload segment decode ด้วย base64url ได้ข้อมูลผู้ใช้จริง', () => {
    const payloadSegment = MOCK_TOKEN.split('.')[2];
    const decoded = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'));
    expect(decoded.sub).toBe(MOCK_USER.id);
    expect(decoded.role).toBe('ADMIN');
    expect(typeof decoded.exp).toBe('number');
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000)); // ยังไม่หมดอายุ
  });

  it('ยาวเกิน 10 ตัวอักษร (เงื่อนไขสำรองของ isAuthed)', () => {
    expect(MOCK_TOKEN.length).toBeGreaterThan(10);
  });
});

describe('MOCK_RESUME — ข้อมูล resume ตัวอย่างสมเหตุสมผล', () => {
  it('ชนิดไฟล์และชื่อสอดคล้องกัน (PDF)', () => {
    expect(MOCK_RESUME.mimeType).toBe('application/pdf');
    expect(MOCK_RESUME.originalName).toMatch(/\.pdf$/);
  });

  it('ขนาดไฟล์ไม่เกินลิมิต 5MB (มิฉะนั้น mock ตัวเองต้องโดน reject)', () => {
    expect(MOCK_RESUME.fileSize).toBeLessThan(5 * 1024 * 1024);
  });

  it('สถานะ extraction ต้อง COMPLETED (flow หลังอัปโหลด)', () => {
    expect(MOCK_RESUME.status).toBe('COMPLETED');
    expect(MOCK_RESUME.extractionStatus).toBe('COMPLETED');
  });
});

describe('MOCK_SECTION_SCORES / MOCK_RADAR_DATA — ความสอดคล้องของผลวิเคราะห์', () => {
  it('ทุกคะแนน section อยู่ในช่วง 0-100', () => {
    for (const score of Object.values(MOCK_SECTION_SCORES)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('radar ต้องมีจำนวนแกนเท่ากับ section scores (หน้า Dashboard วาด radar จากสองชุดนี้)', () => {
    expect(MOCK_RADAR_DATA).toHaveLength(Object.keys(MOCK_SECTION_SCORES).length);
  });

  it('คะแนน radar ตรงกับคะแนน section ตามลำดับเดียวกัน', () => {
    const sectionValues = Object.values(MOCK_SECTION_SCORES);
    MOCK_RADAR_DATA.forEach((axis, index) => {
      expect(axis.score).toBe(sectionValues[index]);
      expect(axis.subject.length).toBeGreaterThan(0);
    });
  });

  it('overallScore อยู่ในช่วง 0-100 และใกล้ค่าเฉลี่ย section (±15)', () => {
    const values = Object.values(MOCK_SECTION_SCORES);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    expect(MOCK_ANALYSIS.overallScore).toBeGreaterThanOrEqual(0);
    expect(MOCK_ANALYSIS.overallScore).toBeLessThanOrEqual(100);
    expect(Math.abs(MOCK_ANALYSIS.overallScore - avg)).toBeLessThanOrEqual(15);
  });

  it('ประเภทการวิเคราะห์ BASE ต้องไม่มี jobMatchScore', () => {
    expect(MOCK_ANALYSIS.analysisType).toBe('BASE');
    expect(MOCK_ANALYSIS.jobMatchScore).toBe(null);
  });
});

describe('MOCK_ADMIN_STATS — สถิติผู้ดูแลระบบต้องสมเหตุสมผลภายใน', () => {
  it('byStatus รวมกันต้องเท่ากับ totalAnalyses (หน้า Admin แสดงทั้งคู่)', () => {
    const sum = MOCK_ADMIN_STATS.byStatus.success + MOCK_ADMIN_STATS.byStatus.failed + MOCK_ADMIN_STATS.byStatus.queued;
    expect(sum).toBe(MOCK_ADMIN_STATS.totalAnalyses);
  });

  it('ค่าเฉลี่ยคะแนนอยู่ในช่วง 0-100 และ success rate อยู่ในช่วง 0-100', () => {
    expect(MOCK_ADMIN_STATS.averageScore).toBeGreaterThanOrEqual(0);
    expect(MOCK_ADMIN_STATS.averageScore).toBeLessThanOrEqual(100);
    expect(MOCK_ADMIN_STATS.successRate).toBeGreaterThanOrEqual(0);
    expect(MOCK_ADMIN_STATS.successRate).toBeLessThanOrEqual(100);
  });

  it('trend ต้องสอดคล้องภายในแต่ละวัน (success + failed = total)', () => {
    for (const day of MOCK_ADMIN_STATS.trend) {
      expect(day.success + day.failed).toBe(day.total);
    }
  });
});

describe('MOCK_ADMIN_USERS — รายชื่อผู้ใช้ mock', () => {
  it('มีบทบาทเฉพาะ USER / ADMIN เท่านั้น', () => {
    for (const user of MOCK_ADMIN_USERS) {
      expect(['USER', 'ADMIN']).toContain(user.role);
    }
  });

  it('มีผู้ใช้ ADMIN อย่างน้อย 1 คน (mock user ตัวเองต้องอยู่ในรายการ)', () => {
    expect(MOCK_ADMIN_USERS.some((u) => u.role === 'ADMIN')).toBe(true);
  });
});
