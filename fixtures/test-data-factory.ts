import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * TestDataFactory — โรงงานสร้างข้อมูลทดสอบไม่ซ้ำต่อการรัน
 *
 * จุดประสงค์ตาม MASTER PROMPT Phase 4:
 *  - เตรียม Test Data ที่ "ไม่ซ้ำกัน" สำหรับแต่ละ Test Run (plus-addressing + timestamp)
 *  - สร้างไฟล์ fixture ชั่วคราว (PDF จริง / ไฟล์ปลอม / ไฟล์ใหญ่เกิน) ในโฟลเดอร์ temp
 *  - ทุกไฟล์ที่สร้างเป็น "ข้อมูลทดสอบล้วน" และถูกทำลายได้ทันทีหลังเทสต์
 */

/**
 * ตัวนับลำดับปรันความไม่ซ้ำ — หลักฐานจาก unit test (tests/unit/test-data-factory.test.ts):
 * การใช้ Date.now() + random อย่างเดียวมีโอกาสซ้ำจริงเมื่อเรียกหลายครั้งในมิลลิวินาทีเดียว
 * (เทสต์ 50 ครั้งติดกันพัง จึงเติมลำดับต่อกระบวนการเข้าไปร่วมด้วย)
 */
let dataSequence = 0;

/** อีเมลไม่ซ้ำต่อการรัน — ใช้ plus-addressing กับโดเมนที่รองรับ */
export function uniqueEmail(baseEmail: string, prefix = 'qa'): string {
  dataSequence += 1;
  const stamp = `${Date.now()}-${dataSequence}-${Math.floor(Math.random() * 1000)}`;
  const [local, domain] = baseEmail.split('@');
  if (!domain) return `${prefix}.${stamp}@example.test`;
  return `${local}+${prefix}-${stamp}@${domain}`;
}

/** ชื่อผู้ใช้ทดสอบไม่ซ้ำ */
export function uniqueName(prefix = 'QA Tester'): string {
  dataSequence += 1;
  return `${prefix} ${Date.now().toString(36).toUpperCase()}-${dataSequence}`;
}

/** สร้างไฟล์ชั่วคราวพร้อมลบตัวเองเมื่อเทสต์จบ (ผ่าน cleanup callback) */
export function createTempFile(name: string, bytes: Buffer): { path: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'learnace-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, bytes);
  return {
    path: filePath,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/* อักษร backslash — เขียนลิเทอรัลตรง ๆ ไม่ได้ตามกฎ SonarLint S7780 จึงสร้างจากรหัส ASCII */
const BACKSLASH = String.fromCharCode(92);

/**
 * Escape ข้อความก่อนฝังใน content stream ของ PDF
 * ลำดับสำคัญ: escape backslash ก่อนวงเล็บเสมอ (มิฉะนั้น backslash ที่เติมให้วงเล็บจะถูก escape ซ้ำ)
 * ใช้ replaceAll กับ string literal ตามกฎ SonarLint S7781 และ String.raw ตามกฎ S7780
 */
function escapePdfText(text: string): string {
  return text
    .replaceAll(BACKSLASH, BACKSLASH + BACKSLASH)
    .replaceAll('(', String.raw`\(`)
    .replaceAll(')', String.raw`\)`);
}

/**
 * PDF จริงขนาดเล็ก (1 หน้า) — สร้าง bytes ในหน่วยความจำ
 * โครงสร้าง PDF 1.4 ที่เบราว์เซอร์/backend ตรวจ magic number ผ่าน (%PDF-)
 */
export function buildValidPdfBytes(text = 'LearnAce QA - Sample Resume\nSkills: Node.js, React, SQL\nExperience: 3 years'): Buffer {
  const content = `
BT /F1 12 Tf 50 750 Td (${escapePdfText(text).replaceAll('\n', ') Tj\n0 -16 Td (')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
}

/** ไฟล์ปลอมที่ชื่อ .pdf แต่เนื้อหาไม่ใช่ PDF */
export function buildFakePdfBytes(): Buffer {
  return Buffer.from('นี่คือไฟล์ข้อความธรรมดา ไม่ใช่ PDF จริง — LearnAce QA test data', 'utf8');
}

/** ไฟล์ใหญ่เกิน 5MB (boundary test) — ขนาดใหญ่กว่าลิมิตเล็กน้อย */
export function buildOversizedPdfBytes(limitBytes = 5 * 1024 * 1024): Buffer {
  const valid = buildValidPdfBytes();
  const padding = Buffer.alloc(limitBytes + 1024, 0x41); // 'A' ซ้ำ
  return Buffer.concat([valid, padding]);
}