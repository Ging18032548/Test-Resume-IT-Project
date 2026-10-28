import path from 'path';

/**
 * ============================================================
 * Test Data — ข้อมูลทดสอบกลาง (แยกออกจาก Test Script)
 * ============================================================
 * หลักการ:
 *  - Credentials มาจาก Environment Variables เท่านั้น (ห้าม hardcode รหัสผ่านจริง)
 *  - ค่า default ใช้ได้เฉพาะกับ MOCK mode (ไม่มีผลกับระบบจริง)
 *  - ไฟล์ fixture สร้างด้วย `npm run gen:fixtures` (scripts/gen-fixtures.js)
 */

export const ENV = {
  testEmail: process.env.TEST_EMAIL || '',
  testPassword: process.env.TEST_PASSWORD || '',
  registrationName: process.env.REGISTRATION_NAME || '',
  registrationEmail: process.env.REGISTRATION_EMAIL || '',
  registrationPassword: process.env.REGISTRATION_PASSWORD || '',
  allowRegistrationTest: process.env.ALLOW_REGISTRATION_TEST === 'true',
  databaseUrl: process.env.DATABASE_URL || '',
} as const;

/** มีบัญชีทดสอบจริงหรือไม่ (ตัดสินว่าเทสต์ authenticated จะรันหรือ BLOCKED) */
export function hasTestAccount(): boolean {
  return ENV.testEmail.length > 0 && ENV.testPassword.length > 0;
}

/** มีสิทธิ์สมัครสมาชิกจริงบนระบบเป้าหมายหรือไม่ (วาล์วกันพลาดของ MASTER PROMPT) */
export function canRunRealRegistration(): boolean {
  return (
    ENV.allowRegistrationTest &&
    ENV.registrationEmail.length > 0 &&
    ENV.registrationPassword.length > 0
  );
}

/** ค่า default สำหรับ MOCK mode — ใช้เมื่อไม่ได้ตั้งบัญชีจริง */
export const MOCK_CREDENTIALS = {
  email: 'qa.tester@example.com',
  password: 'QaSecure!2026',
  adminEmail: 'qa.admin@example.com',
  adminPassword: 'AdminSecure!2026',
} as const;

/** โฟลเดอร์ไฟล์ fixture ที่ generate ไว้ (fixtures/files — สร้างด้วย npm run gen:fixtures) */
export const FIXTURE_FILES_DIR = path.join(__dirname, 'files');

/**
 * ============================================================
 * TEAM_USERS — บัญชีทีมงาน 3 คน สำหรับเทสต์ "sign in แล้วต้องเห็น
 * ข้อมูล user ใน /admin" (ข้อมูลที่ผู้ใช้ระบุเมื่อ 2026-10-27)
 * ============================================================
 * นโยบายข้อมูลลับ (ตามหัวไฟล์):
 *  - ชื่อ/นามสกุล/อีเมล/สายงาน = ข้อมูลระบุตัวตน ไม่ใช่ความลับ ระบุในไฟล์นี้ได้
 *  - รหัสผ่านจริง = อ่านจาก .env เท่านั้น (TEAM_KANYARAT_PASSWORD /
 *    TEAM_PHIRAPHAT_PASSWORD / TEAM_VARIN_PASSWORD) — ห้าม hardcode ใน repo
 *  - ค่า fallback (QaSecure!2026) ใช้ได้เฉพาะ MOCK mode เพราะ mock layer
 *    ไม่ได้ตรวจรหัสผ่านจริงอยู่แล้ว (ปฏิเสธเฉพาะ .invalid / Wrong*)
 */
export interface TeamUser {
  /** ชื่อ (First Name) ตามที่ผู้ใช้ระบุ */
  firstName: string;
  /** นามสกุล (Last Name) ตามที่ผู้ใช้ระบุ */
  lastName: string;
  /** ชื่อที่แสดงบนหน้าเว็บ/ตาราง Users ของ /admin */
  displayName: string;
  /** สายงานที่ระบุไว้ตอนส่งข้อมูล (ใช้ในชื่อเทสต์ ให้รายงานอ่านง่าย) */
  department: string;
  email: string;
  /** รหัสผ่านทดสอบ — โหมดจริงต้องมาจาก .env เสมอ */
  password: string;
  /**
   * ไฟล์ Resume fixture ที่ "ตั้งชื่อตามเจ้าของบัญชี" — ผู้ใช้สั่งว่าห้ามใช้ชื่ออื่น
   * เพราะไฟล์ resume บนระบบจริงเป็นชื่อของ 3 คนนี้แล้ว (สร้างด้วย npm run gen:fixtures)
   */
  resumeFile: string;
  /**
   * ตำแหน่งงานที่เลือกเทียบตอนวิเคราะห์แบบ JOB_MATCH — จำกัดตาม options
   * ที่หน้า Dashboard มีจริง (Frontend/Backend/QA) จับคู่ให้ใกล้สายงานที่สุด
   */
  jobOption: string;
  /** ตำแหน่งงานที่สร้างผ่านหน้า /jobs (ทดสอบฟังก์ชัน Job Descriptions) */
  jobToCreate: { title: string; company: string };
}

export const TEAM_USERS: TeamUser[] = [
  {
    firstName: 'KANYARAT',
    lastName: 'PATTHANAN',
    displayName: 'Kanyarat Patthanan',
    department: 'สายงาน HR & Recruitment',
    email: 'kanyarat.p.hr@gmail.com',
    password: process.env.TEAM_KANYARAT_PASSWORD || MOCK_CREDENTIALS.password,
    resumeFile: path.join(FIXTURE_FILES_DIR, 'resume-Kanyarat-Patthanan.pdf'),
    jobOption: 'QA Engineer',
    jobToCreate: { title: 'HR & Recruitment Specialist', company: 'LearnAce QA' },
  },
  {
    firstName: 'PHIRAPHAT',
    lastName: 'CHAYANON',
    displayName: 'Phiraphat Chayanon',
    department: 'สายงาน Finance & Financial Analyst',
    email: 'phiraphat.c.finance@gmail.com',
    password: process.env.TEAM_PHIRAPHAT_PASSWORD || MOCK_CREDENTIALS.password,
    resumeFile: path.join(FIXTURE_FILES_DIR, 'resume-Phiraphat-Chayanon.pdf'),
    jobOption: 'Backend Developer',
    jobToCreate: { title: 'Financial Analyst', company: 'LearnAce QA' },
  },
  {
    firstName: 'VARIN',
    lastName: 'METHAWEE',
    displayName: 'Varin Methawee',
    department: 'สายงาน UI/UX Product Design',
    email: 'varin.m.uxui@gmail.com',
    password: process.env.TEAM_VARIN_PASSWORD || MOCK_CREDENTIALS.password,
    resumeFile: path.join(FIXTURE_FILES_DIR, 'resume-Varin-Methawee.pdf'),
    jobOption: 'Frontend Developer',
    jobToCreate: { title: 'UI/UX Product Designer', company: 'LearnAce QA' },
  },
];

/** หา user ทีมจากอีเมล (case-insensitive) — ใช้แสดงชื่อจริงแทน email prefix ตอน login */
export function findTeamUserByEmail(email: string): TeamUser | undefined {
  const normalized = email.trim().toLowerCase();
  return TEAM_USERS.find((member) => member.email.toLowerCase() === normalized);
}

/**
 * ตั้งรหัสผ่านจริงของทีมครบ 3 คนใน .env แล้วหรือไม่
 * เงื่อนไขรันชุดเทสต์โหมดจริง (MOCK_API=false) — ถ้าไม่ครบ = BLOCKED ตามกฎเฟรมเวิร์ก
 */
export function hasTeamCredentials(): boolean {
  return (
    (process.env.TEAM_KANYARAT_PASSWORD || '').length > 0 &&
    (process.env.TEAM_PHIRAPHAT_PASSWORD || '').length > 0 &&
    (process.env.TEAM_VARIN_PASSWORD || '').length > 0
  );
}

export const FIXTURE_FILES = {
  /** PDF จริง 1 หน้า ที่มีเนื้อหา Resume จำลอง */
  validResumePdf: path.join(FIXTURE_FILES_DIR, 'sample-resume.pdf'),
  /** ไฟล์ที่ชื่อ .pdf แต่เนื้อหาไม่ใช่ PDF (ทดสอบ validation) */
  fakePdf: path.join(FIXTURE_FILES_DIR, 'not-a-real-cv.pdf'),
  /** ไฟล์ .exe (ชนิดต้องห้าม) */
  forbiddenExe: path.join(FIXTURE_FILES_DIR, 'malicious-sample.exe'),
  /** ไฟล์ใหญ่เกิน 5MB (ทดสอบ boundary ขนาด) */
  oversizedPdf: path.join(FIXTURE_FILES_DIR, 'oversized-resume.pdf'),
  /**
   * Resume ของทีมงาน 3 คน — ชื่อไฟล์ผูกกับเจ้าของบัญชีตามคำสั่งผู้ใช้
   * ("ห้ามใช้ชื่ออื่น เพราะมีไฟล์ resume เป็นชื่อ 3 คนนี้แล้ว")
   */
  kanyaratResumePdf: path.join(FIXTURE_FILES_DIR, 'resume-Kanyarat-Patthanan.pdf'),
  phiraphatResumePdf: path.join(FIXTURE_FILES_DIR, 'resume-Phiraphat-Chayanon.pdf'),
  varinResumePdf: path.join(FIXTURE_FILES_DIR, 'resume-Varin-Methawee.pdf'),
} as const;

/** ตำแหน่งงานที่ใช้เทียบ Job Description (ชื่อจาก UI จำลอง ใช้กับ MOCK mode) */
export const JOB_OPTIONS = {
  none: null,
  frontend: 'Frontend Developer',
  backend: 'Backend Developer',
  qa: 'QA Engineer',
} as const;