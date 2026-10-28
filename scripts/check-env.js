#!/usr/bin/env node
/**
 * scripts/check-env.js — ตรวจว่า .env พร้อมรันชุดเทสต์เว็บจริง (TEAM-SIGNIN-REAL) หรือยัง
 *
 * วิธีใช้:
 *   node scripts/check-env.js          → ตรวจทุกข้อ แล้วสรุป READY / NOT READY
 *   node scripts/check-env.js --init   → ถ้ายังไม่มีไฟล์ .env จะสร้างตั้งต้นให้ (ไม่ทับไฟล์ที่มีอยู่)
 *
 * หลักการ: อ่านอย่างเดียว ไม่แก้ไฟล์ใด (ยกเว้น --init สร้างได้เฉพาะ .env ที่ยังไม่มี)
 * ไม่พิมพ์รหัสผ่านจริงออกจอ — พิมพ์เพียง "ตั้งแล้ว/ยังว่าง" กับความยาวของค่าเท่านั้น
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const TEAM_KEYS = [
  'TEAM_KANYARAT_PASSWORD',
  'TEAM_PHIRAPHAT_PASSWORD',
  'TEAM_VARIN_PASSWORD',
];

const projectRoot = path.resolve(__dirname, '..');
const cwd = process.cwd();
const envPath = path.join(cwd, '.env'); // Playwright อ่าน .env จาก "โฟลเดอร์ที่รันคำสั่ง" เสมอ

const problems = [];
const warnings = [];

console.log('================================================================');
console.log(' ตรวจความพร้อม .env สำหรับชุด REAL (learnace.tech จริง, MOCK_API=false)');
console.log('================================================================');
console.log('โฟลเดอร์โปรเจกต์     : ' + projectRoot);
console.log('โฟลเดอร์ที่รันคำสั่ง : ' + cwd);
console.log('ไฟล์ .env ที่จะถูกอ่าน: ' + envPath);
console.log('');

if (path.resolve(cwd) !== projectRoot) {
  warnings.push(
    'รันคำสั่งจากโฟลเดอร์อื่น — Playwright อ่าน .env จาก "โฟลเดอร์ที่รันคำสั่ง" เสมอ ' +
      'ให้ cd ไปที่โฟลเดอร์โปรเจกต์ก่อน: cd "' + projectRoot + '"'
  );
}

/* ---------- --init: สร้าง .env ตั้งต้น (เฉพาะเมื่อยังไม่มี) ---------- */
if (process.argv.includes('--init')) {
  if (fs.existsSync(envPath)) {
    console.log('[init] มี .env อยู่แล้วที่ ' + envPath + ' — ไม่แตะไฟล์เดิม');
  } else {
    const template = [
      '# บรรทัดที่ขึ้นต้นด้วย # คือคำอธิบาย ลบทิ้งได้',
      '# กติกา: ห้ามเว้นวรรครอบเครื่องหมาย = และห้ามครอบค่าด้วยเครื่องหมายคำพูด',
      'BASE_URL=https://learnace.tech',
      'MOCK_API=false',
      'TEAM_KANYARAT_PASSWORD=',
      'TEAM_PHIRAPHAT_PASSWORD=',
      'TEAM_VARIN_PASSWORD=',
      '',
    ].join('\n');
    fs.writeFileSync(envPath, template, 'utf8');
    console.log('[init] สร้างไฟล์ใหม่แล้ว: ' + envPath);
    console.log('[init] ถัดไป: เปิดไฟล์ .env ใส่รหัสผ่านจริงหลัง = ของแต่ละคน แล้วรัน node scripts/check-env.js ซ้ำ');
  }
  console.log('');
}

/* ---------- ตรวจการมีอยู่ของไฟล์ + กับดักชื่อไฟล์/การเข้ารหัสบน Windows ---------- */
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath);
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
    problems.push(
      'ไฟล์ .env ถูกเซฟเป็น UTF-16 — dotenv อ่านไม่ได้ทั้งไฟล์ ให้เปิดด้วย Notepad แล้ว Save As เป็น "UTF-8"'
    );
  } else if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
    warnings.push(
      'ไฟล์ .env มี BOM (เซฟแบบ UTF-8 with BOM) — ถ้า MOCK_API ตรวจไม่ผ่านทั้งที่พิมพ์ถูก ' +
        'ให้ Save As เป็น "UTF-8" ปกติ (ไม่มี BOM)'
    );
  }
} else {
  let suspicious = [];
  let hasTemplate = false;
  try {
    suspicious = fs
      .readdirSync(cwd)
      .filter((f) => f.toLowerCase().startsWith('.env') && f !== '.env' && f !== '.env.example');
    hasTemplate = fs.existsSync(path.join(cwd, '.env.example'));
  } catch (e) {
    /* อ่านโฟลเดอร์ไม่ได้ = ข้ามการตรวจชื่อไฟล์แปลกปลอม */
  }
  if (suspicious.length > 0) {
    problems.push(
      'ไม่พบไฟล์ ".env" แต่พบไฟล์ชื่อใกล้เคียง: ' + suspicious.join(', ') +
        ' — อาการคลาสสิกของ Windows (ซ่อนนามสกุลไฟล์ ทำให้ไฟล์จริงกลายเป็น .env.txt) ' +
        'แก้ชื่อด้วยคำสั่ง: ' + suspicious.map((f) => 'Rename-Item "' + f + '" .env').join(' และ ')
    );
  } else if (hasTemplate) {
    problems.push(
      'ไม่พบไฟล์ .env ในโฟลเดอร์ที่รันคำสั่ง (มีแต่ .env.example ซึ่งเป็นเทมเพลต) — ' +
        'สร้างจากเทมเพลตด้วยคำสั่ง: Copy-Item .env.example .env แล้วเปิดไฟล์ .env กรอกค่าจริง ' +
        'หรือสร้างแบบสั้นด้วยคำสั่ง: node scripts/check-env.js --init'
    );
  } else {
    problems.push(
      'ไม่พบไฟล์ .env ในโฟลเดอร์ที่รันคำสั่ง — สร้างอัตโนมัติด้วยคำสั่ง: node scripts/check-env.js --init'
    );
  }
}

dotenv.config(); // อ่านจากโฟลเดอร์ที่รันคำสั่ง — วิธีเดียวกับ playwright.config.ts เป๊ะ

/* ---------- ตรวจเงื่อนไข gate ของชุด REAL ---------- */
const mockApiRaw = process.env.MOCK_API;
const mockApiOk = mockApiRaw === 'false';

if (!mockApiOk) {
  problems.push(
    'MOCK_API ต้องเป็น false ตัวพิมพ์เล็กเป๊ะ ๆ แต่ตอนนี้ = ' + JSON.stringify(mockApiRaw ?? null) +
      ' (ไม่ได้ตั้ง = ระบบถือว่า true ทันที) — แก้บรรทัดใน .env ให้เป็น: MOCK_API=false'
  );
}

for (const key of TEAM_KEYS) {
  const value = process.env[key] || '';
  if (!value.length) {
    problems.push('ยังไม่ได้ตั้ง ' + key + ' — เพิ่มบรรทัด ' + key + '=รหัสผ่านจริง ในไฟล์ .env');
    continue;
  }
  if (value !== value.trim()) {
    warnings.push(key + ' มีช่องว่างหัว/ท้ายค่า — ลบช่องว่างหัวท้ายออก');
  }
  if (/^["']|["']$/.test(value)) {
    warnings.push(key + ' ถูกครอบด้วยเครื่องหมายคำพูด " หรือ \' — ลบออก (เว้นแต่รหัสจริงมีตัวอักษรพวกนี้จริง)');
  }
  if (/[^\x00-\x7F]/.test(value)) {
    warnings.push(key + ' มีตัวอักษรนอกช่วง ASCII (เช่น ภาษาไทย) — ถ้าเผลอวางข้อความตัวอย่าง ให้แทนด้วยรหัสจริง');
  }
}

/* ---------- พิมพ์ค่าที่ gate มองเห็น ---------- */
console.log('ค่าที่ gate ของชุด REAL มองเห็นตอนนี้:');
console.log(
  '  MOCK_API            = ' + JSON.stringify(mockApiRaw ?? null) +
    (mockApiOk ? '  [OK]' : '  [X] ต้องเป็น "false"')
);
for (const key of TEAM_KEYS) {
  const value = process.env[key] || '';
  console.log(
    '  ' + key.padEnd(24) + ' = ' +
      (value ? 'ตั้งแล้ว (ยาว ' + value.length + ' ตัวอักษร)  [OK]' : 'ยังว่าง  [X]')
  );
}
console.log('  BASE_URL            = ' + JSON.stringify(process.env.BASE_URL || null) + '  (ข้อมูลประกอบ)');

if (mockApiOk && /localhost|127\.0\.0\.1/.test(process.env.BASE_URL || '')) {
  warnings.push(
    'MOCK_API=false แต่ BASE_URL ชี้ localhost — ชุด REAL จะยิงเว็บในเครื่อง ไม่ใช่ learnace.tech ' +
      'ถ้าจะทดสอบเว็บจริงให้ตั้ง BASE_URL=https://learnace.tech'
  );
}

/* ---------- คำตัดสิน ---------- */
console.log('');
if (warnings.length) {
  console.log('คำเตือน:');
  warnings.forEach((w) => console.log('  [!] ' + w));
  console.log('');
}
if (problems.length) {
  console.log('สิ่งที่ทำให้ยังรันชุด REAL ไม่ได้:');
  problems.forEach((p) => console.log('  [X] ' + p));
  console.log('');
  console.log('สรุป: NOT READY — แก้ตามรายการ [X] ข้างบน แล้วรัน node scripts/check-env.js ซ้ำ');
  process.exitCode = 1;
} else {
  console.log('สรุป: READY — เงื่อนไขครบแล้ว รันชุด REAL ด้วยคำสั่ง:');
  console.log('');
  console.log('  npx playwright test tests/e2e/team-signin-admin-visibility.spec.ts --grep "TEAM-SIGNIN-REAL" --project="Desktop Chrome" --workers=1 --headed');
}
console.log('================================================================');