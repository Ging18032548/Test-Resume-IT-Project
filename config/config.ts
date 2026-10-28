import dotenv from 'dotenv';

dotenv.config();

/**
 * ============================================================
 * Central Configuration — ค่ากลางของเฟรมเวิร์กทั้งหมด
 * ============================================================
 * ทุก endpoint ในไฟล์นี้มี "สถานะหลักฐาน" กำกับเสมอ:
 *   VERIFIED_LIVE_*   = ตรวจสอบกับ https://learnace.tech จริง (WebFetch probe)
 *   MOCK_ONLY         = มีเฉพาะใน mock layer ใช้กับ UI testing เท่านั้น
 *   UNVERIFIED        = ยังไม่มีหลักฐานว่ามีอยู่จริง — ห้ามใช้ยืนยันผลบนระบบจริง
 *
 * หลักฐานการโพรบ (ดูรายละเอียดใน docs/website-inventory.md):
 *   GET /api/jobs         -> {"success":false,"message":"กรุณาเข้าสู่ระบบ","code":"TOKEN_REQUIRED"}
 *   GET /api/resumes      -> {"success":false,"message":"กรุณาเข้าสู่ระบบ","code":"TOKEN_REQUIRED"}
 *   GET /api/analyses     -> {"success":false,"message":"ไม่พบ API GET /api/analyses","code":"ENDPOINT_NOT_FOUND"}
 *   GET /api/analyses/:id -> {"success":false,"message":"กรุณาเข้าสู่ระบบ","code":"TOKEN_REQUIRED"}
 *   GET /api/auth/me      -> {"success":false,"message":"กรุณาเข้าสู่ระบบ","code":"TOKEN_REQUIRED"}
 *   GET /api/admin/stats  -> {"success":false,"message":"กรุณาเข้าสู่ระบบ","code":"TOKEN_REQUIRED"}
 *   GET /api/admin/users  -> {"success":false,"message":"กรุณาเข้าสู่ระบบ","code":"TOKEN_REQUIRED"}
 */

export const APP = {
  /** URL เว็บเป้าหมาย — ค่า default ตาม MASTER PROMPT */
  baseUrl: process.env.BASE_URL || 'https://learnace.tech',
  /** Backend API แยก (ถ้ามี) — ไม่ตั้ง = ใช้ BASE_URL เดียวกัน */
  apiBaseUrl: process.env.API_BASE_URL || process.env.BASE_URL || 'https://learnace.tech',
  /** โหมด mocked persistence — true = ไม่มี request ใดแตะ DB จริง */
  mockApi: process.env.MOCK_API !== 'false',
  /**
   * โหมดแอปจำลองในเครื่อง (BASE_URL ชี้ localhost) — ทั้ง DOM และ API เป็นของเฟรมเวิร์ก
   * assertion เชิงเนื้อหาที่ผูกกับ mock success shape ใช้ได้ "เฉพาะโหมดนี้"
   * (เว็บจริง + MOCK_API=true: DOM เป็นของจริงแต่ API ถูกดัก — success contract UNVERIFIED)
   */
  isMockAppServer: /localhost|127\.0\.0\.1/.test(process.env.BASE_URL || ''),
} as const;

/** โครงสร้าง JSON envelope มาตรฐานที่ยืนยันจากการโพรบจริง */
export const API_ENVELOPE_CODES = {
  tokenRequired: 'TOKEN_REQUIRED',
  endpointNotFound: 'ENDPOINT_NOT_FOUND',
  unauthorizedMessage: 'กรุณาเข้าสู่ระบบ',
  notFoundMessagePrefix: 'ไม่พบ API',
} as const;

export type EndpointEvidence =
  | 'VERIFIED_LIVE_401_TOKEN_REQUIRED'
  | 'VERIFIED_LIVE_404_ENDPOINT_NOT_FOUND'
  | 'MOCK_ONLY'
  | 'UNVERIFIED';

export interface ApiPath {
  method: string;
  path: string;
  evidence: EndpointEvidence;
}

/** API paths ที่ใช้ในการทดสอบ — แต่ละเส้นมีสถานะหลักฐานกำกับ */
export const API_PATHS = {
  login: {
    method: 'POST',
    path: '/api/auth/login',
    evidence: 'MOCK_ONLY',
  } as ApiPath,
  register: {
    method: 'POST',
    path: '/api/auth/register',
    evidence: 'UNVERIFIED',
  } as ApiPath,
  me: {
    method: 'GET',
    path: '/api/auth/me',
    evidence: 'VERIFIED_LIVE_401_TOKEN_REQUIRED',
  } as ApiPath,
  logout: {
    method: 'POST',
    path: '/api/auth/logout',
    evidence: 'MOCK_ONLY',
  } as ApiPath,
  resumes: {
    method: 'GET',
    path: '/api/resumes',
    evidence: 'VERIFIED_LIVE_401_TOKEN_REQUIRED',
  } as ApiPath,
  resumeUpload: {
    method: 'POST',
    path: '/api/resumes/upload',
    evidence: 'MOCK_ONLY',
  } as ApiPath,
  /** หมายเหตุ: GET /api/analyses (collection) ถูกยืนยันว่า "ไม่มีอยู่จริง" บนเว็บจริง */
  analysesCollection: {
    method: 'GET',
    path: '/api/analyses',
    evidence: 'VERIFIED_LIVE_404_ENDPOINT_NOT_FOUND',
  } as ApiPath,
  analysisItem: {
    method: 'GET',
    path: '/api/analyses/1',
    evidence: 'VERIFIED_LIVE_401_TOKEN_REQUIRED',
  } as ApiPath,
  adminStats: {
    method: 'GET',
    path: '/api/admin/stats',
    evidence: 'VERIFIED_LIVE_401_TOKEN_REQUIRED',
  } as ApiPath,
  adminUsers: {
    method: 'GET',
    path: '/api/admin/users',
    evidence: 'VERIFIED_LIVE_401_TOKEN_REQUIRED',
  } as ApiPath,
  jobs: {
    method: 'GET',
    path: '/api/jobs',
    evidence: 'VERIFIED_LIVE_401_TOKEN_REQUIRED',
  } as ApiPath,
} as const;

/** เส้นทางหน้าจอที่ยืนยันจากการเข้าเว็บจริง */
export const ROUTES = {
  home: '/',
  signIn: '/sign-in',
  register: '/register',
  dashboard: '/dashboard',
  jobs: '/jobs',
  uploadResume: '/resumes/upload',
  admin: '/admin',
} as const;

export const TIMEOUTS = {
  test: Number(process.env.TEST_TIMEOUT) || 120_000,
  expect: Number(process.env.EXPECT_TIMEOUT) || 15_000,
  action: 15_000,
  /** เว็บจริงอยู่หลัง Cloudflare tunnel — โหลดหน้าเคยเกิน 30s (TC-AUTH-004 จริง) จึงตั้ง 60s */
  navigation: 60_000,
} as const;

/** เงื่อนไขของแอปที่ยืนยันจากหน้า register จริง (real-time password checklist) */
export const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  /** ข้อความกติกาบนฟอร์ม (ตรวจสอบจากหน้า /register จริง) */
  ruleLabels: [
    'อย่างน้อย 8 ตัวอักษร',
    'ตัวพิมพ์ใหญ่ (A–Z)',
    'ตัวพิมพ์เล็ก (a–z)',
    'ตัวเลข (0–9)',
  ],
} as const;

/** ขีดจำกัดไฟล์อัปโหลด — ค่า 5MB เป็น "ข้อสมมติฐานที่ยังยืนยันไม่ได้" จนกว่าจะเห็น backend rule จริง */
export const UPLOAD_LIMITS = {
  maxSizeBytes: 5 * 1024 * 1024,
  /** ชนิดไฟล์ที่ input ยอมรับ — ยืนยันเบื้องต้นจาก UI (ยังต้องยืนยันกับ backend จริง) */
  acceptedExtensions: ['.pdf', '.docx'],
  verified: false as const,
} as const;
