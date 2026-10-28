/**
 * gen-fixtures.js — สร้างไฟล์ fixture สำหรับการทดสอบ (fixtures/files/)
 *  - sample-resume.pdf    : PDF จริง 1 หน้า มีเนื้อหา Resume จำลอง
 *  - not-a-real-cv.pdf    : ไฟล์ปลอม (นามสกุล .pdf แต่เนื้อหาไม่ใช่ PDF)
 *  - malicious-sample.exe : ไฟล์ชนิดต้องห้าม
 *  - oversized-resume.pdf : ไฟล์ใหญ่เกิน 5MB (boundary test)
 *
 * ใช้: node scripts/gen-fixtures.js  (หรือ npm run gen:fixtures)
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'fixtures', 'files');

function buildValidPdf(text) {
  const lines = text.split('\n');
  let content = '';
  lines.forEach((line, index) => {
    const safe = line.replace(/([()\\])/g, '\\$1');
    content += index === 0
      ? `BT /F1 12 Tf 50 ${750} Td (${safe}) Tj ET\n`
      : `BT /F1 11 Tf 50 ${750 - index * 16} Td (${safe}) Tj ET\n`;
  });

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
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

fs.mkdirSync(OUT_DIR, { recursive: true });

const files = [
  {
    name: 'sample-resume.pdf',
    bytes: buildValidPdf(
      'LearnAce QA - Sample Resume\nName: Somchai Jaidee\nSkills: Node.js, React, SQL\nExperience: 3 years Full-stack Developer\nEducation: B.Sc. Computer Science'
    ),
  },
  {
    name: 'not-a-real-cv.pdf',
    bytes: Buffer.from('This is plain text, NOT a real PDF file. LearnAce QA test data.', 'utf8'),
  },
  {
    name: 'malicious-sample.exe',
    bytes: Buffer.concat([Buffer.from('MZ', 'latin1'), Buffer.alloc(512, 0x00)]),
  },
  {
    name: 'oversized-resume.pdf',
    bytes: Buffer.concat([buildValidPdf('Oversized boundary test'), Buffer.alloc(5 * 1024 * 1024 + 1024, 0x41)]),
  },
  /* ---- Resume ของทีมงาน 3 คน (ข้อมูลจากผู้ใช้ 2026-10-27) ----
   * ผู้ใช้สั่ง: "ห้ามใช้ชื่ออื่น เพราะมีไฟล์ resume เป็นชื่อ 3 คนนี้แล้ว"
   * จึงต้องมีไฟล์ fixture ที่ตั้งชื่อตามเจ้าของบัญชีแบบนี้เสมอ */
  {
    name: 'resume-Kanyarat-Patthanan.pdf',
    bytes: buildValidPdf(
      'LearnAce QA - Resume\nName: KANYARAT PATTHANAN\nTrack: HR & Recruitment\nSkills: Talent Acquisition, Screening, HRIS\nExperience: 4 years HR Recruitment Specialist\nEducation: B.A. Human Resources Management'
    ),
  },
  {
    name: 'resume-Phiraphat-Chayanon.pdf',
    bytes: buildValidPdf(
      'LearnAce QA - Resume\nName: PHIRAPHAT CHAYANON\nTrack: Finance & Financial Analyst\nSkills: Financial Modeling, Excel, SQL, Power BI\nExperience: 5 years Financial Analyst\nEducation: B.B.A. Finance'
    ),
  },
  {
    name: 'resume-Varin-Methawee.pdf',
    bytes: buildValidPdf(
      'LearnAce QA - Resume\nName: VARIN METHAWEE\nTrack: UI/UX Product Design\nSkills: Figma, User Research, Prototyping, Design System\nExperience: 4 years UI/UX Product Designer\nEducation: B.F.A. Industrial Design'
    ),
  },
];

for (const file of files) {
  fs.writeFileSync(path.join(OUT_DIR, file.name), file.bytes);
  process.stdout.write(`created ${file.name} (${(file.bytes.length / 1024).toFixed(1)} KB)\n`);
}

process.stdout.write('fixtures ready\n');