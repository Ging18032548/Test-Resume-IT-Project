/**
 * ============================================================
 * Mock App Server — "เว็บแอป LearnAce (AI CV Analyzer)" จำลอง
 * ============================================================
 * จุดประสงค์ (ตาม MASTER PROMPT Phase 6):
 *   สภาพแวดล้อม sandbox เชื่อมต่อ learnace.tech ตรงไม่ได้ (Cloudflare tunnel
 *   บล็อก — พิสูจน์ด้วย curl timeout) จึงต้องมีเว็บแอปจำลองในเครื่อง
 *   เพื่อ "ตรวจความถูกต้องของเฟรมเวิร์กและ assertion ให้เป็นจริงมากที่สุด"
 *   โดยไม่แตะระบบจริงและไม่มีข้อมูลเข้าฐานข้อมูลใด ๆ (in-memory เท่านั้น)
 *
 * หลักการออกแบบ: สะท้อน "หลักฐานจริง" ที่โพรบได้จาก learnace.tech ทุกข้อ:
 *   - Envelope: { success, message, data } / error: { success:false, message, code }
 *   - เส้น protected ไม่มีโทเคน → 401 TOKEN_REQUIRED ("กรุณาเข้าสู่ระบบ")
 *   - GET /api/analyses (collection) → 404 ENDPOINT_NOT_FOUND (ยืนยันว่าไม่มีจริง)
 *   - URL หน้าเว็บที่ไม่มีจริง → แสดงหน้าเข้าสู่ระบบ (SPA fallback — BUG-001)
 *   - หน้า /register มี password checklist 4 ข้อ real-time
 *   - /admin มี auth gate + เมนู System Overview / Services / Data / Users /
 *     Analysis / Audit log / Session + BullMQ + auto-refresh 15 วินาที
 *
 * ใช้: node scripts/mock-app-server.js  (127.0.0.1:4310)
 * ข้อจำกัด: นี่คือ "แอปจำลองเพื่อทดสอบเฟรมเวิร์ก" ไม่ใช่โค้ดจริงของ learnace.tech
 * การปรับจูน locator กับ DOM จริงทำด้วย `npx playwright codegen` บนเครื่องผู้ใช้
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch { /* dotenv ไม่มีก็รันได้ */ }

const PORT = 4310;
const HOST = '127.0.0.1';

/* ============================================================
 * ข้อมูลจำลอง (in-memory — หายเมื่อปิด server, ไม่มี DB)
 * ============================================================ */
const TEST_EMAIL = process.env.TEST_EMAIL || 'qa.tester@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'QaSecure!2026';

const USER = {
  id: 101,
  name: 'สมชาย ใจดี',
  email: TEST_EMAIL,
  role: 'ADMIN',
  createdAt: '2026-10-01T03:00:00.000Z',
  lastLoginAt: new Date().toISOString(),
};

const HISTORY = [
  { id: 301, userName: 'สมชาย ใจดี', userEmail: TEST_EMAIL, resumeName: 'sample-resume.pdf', jobTitle: '—', analysisType: 'BASE', score: 82, status: 'COMPLETED', createdAt: '2026-10-21T02:30:00.000Z' },
  { id: 302, userName: 'สมหญิง รักงาน', userEmail: 'somying@example.test', resumeName: 'somying-cv-2026.pdf', jobTitle: 'Frontend Developer', analysisType: 'JOB_MATCH', score: 76, status: 'COMPLETED', createdAt: '2026-10-20T08:12:00.000Z' },
  { id: 303, userName: 'ปกรณ์ เก่งมาก', userEmail: 'pakorn@example.test', resumeName: 'pakorn-resume.pdf', jobTitle: 'Backend Developer', analysisType: 'JOB_MATCH', score: 64, status: 'COMPLETED', createdAt: '2026-10-19T04:45:00.000Z' },
  { id: 304, userName: 'มาลี สวยงาม', userEmail: 'malee@example.test', resumeName: 'malee-cv.pdf', jobTitle: '—', analysisType: 'BASE', score: 91, status: 'COMPLETED', createdAt: '2026-10-18T09:05:00.000Z' },
  { id: 305, userName: 'จิรายุ ใจเกินร้อย', userEmail: 'jirayu@example.test', resumeName: 'jirayu-cv-final.pdf', jobTitle: 'QA Engineer', analysisType: 'JOB_MATCH', score: 58, status: 'COMPLETED', createdAt: '2026-10-17T11:20:00.000Z' },
];

const RADAR_DATA = [
  { subject: 'ข้อมูลติดต่อ', score: 90 },
  { subject: 'สรุปโปรไฟล์', score: 78 },
  { subject: 'ทักษะ', score: 88 },
  { subject: 'ประสบการณ์', score: 82 },
  { subject: 'โปรเจกต์', score: 76 },
  { subject: 'การศึกษา', score: 85 },
  { subject: 'ความอ่านง่าย', score: 80 },
];

const SECTION_SCORES = {
  contactInformation: 90, professionalSummary: 78, skills: 88,
  experience: 82, projects: 76, education: 85, readability: 80,
};

function buildAnalysis(id, resumeId, jobDescriptionId) {
  return {
    id, resumeId, userId: USER.id, jobDescriptionId,
    analysisType: jobDescriptionId ? 'JOB_MATCH' : 'BASE',
    status: 'COMPLETED',
    overallScore: 82, baseResumeScore: 82, jobMatchScore: jobDescriptionId ? 76 : null,
    scores: SECTION_SCORES, radarData: RADAR_DATA,
    summary: 'Resume มีโครงสร้างชัดเจน อ่านง่าย และมีทักษะตรงกับสายงานที่สมัครเป็นอย่างดี',
    strengths: ['ประสบการณ์ทำงานเขียนได้ชัดเจน มีตัวเลขผลงานรองรับ', 'ทักษะเทคนิคตรงกับตำแหน่งงาน'],
    weaknesses: ['ควรเพิ่ม keyword ของตำแหน่งงานที่สมัครให้มากขึ้น'],
    improvements: ['เพิ่มผลงานที่วัดผลได้ เช่น ลดเวลาโหลดหน้าเว็บลง 35%'],
    recommendations: ['ปรับหัวข้อ Summary ให้กระชับอยู่ใน 3 บรรทัด'],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

const ADMIN_USERS = [
  { id: 101, name: 'สมชาย ใจดี', email: TEST_EMAIL, role: 'ADMIN', registeredAt: '2026-10-01T03:00:00.000Z', lastLoginAt: new Date().toISOString(), resumeCount: 2, analysisCount: 5, locked: false },
  { id: 102, name: 'สมหญิง รักงาน', email: 'somying@example.test', role: 'USER', registeredAt: '2026-10-05T07:20:00.000Z', lastLoginAt: '2026-10-20T08:00:00.000Z', resumeCount: 3, analysisCount: 7, locked: false },
  { id: 103, name: 'ปกรณ์ เก่งมาก', email: 'pakorn@example.test', role: 'USER', registeredAt: '2026-10-08T10:00:00.000Z', lastLoginAt: '2026-10-19T04:00:00.000Z', resumeCount: 1, analysisCount: 3, locked: true },
];

/**
 * บัญชีทีมงาน 3 คน (ข้อมูลจากผู้ใช้ 2026-10-27) — ใช้ในเทสต์ TEAM-ADM:
 * sign in แล้วตาราง Users ของ /admin ต้องแสดงชื่อจริง+อีเมลของแต่ละคน
 * (รหัสผ่านของทีมอยู่ใน .env เท่านั้น — mock ไม่ตรวจรหัสผ่านจริง จึงไม่เก็บไว้ที่นี่)
 */
const TEAM_USERS = [
  { name: 'Kanyarat Patthanan', email: 'kanyarat.p.hr@gmail.com', department: 'สายงาน HR & Recruitment' },
  { name: 'Phiraphat Chayanon', email: 'phiraphat.c.finance@gmail.com', department: 'สายงาน Finance & Financial Analyst' },
  { name: 'Varin Methawee', email: 'varin.m.uxui@gmail.com', department: 'สายงาน UI/UX Product Design' },
];

const AUDIT_LOG = [
  { id: 1, time: '2026-10-21T03:15:00.000Z', operator: TEST_EMAIL, action: 'SET_ADMIN', target: 'pakorn@example.test', details: 'grant admin by email', ip: '203.0.113.10' },
  { id: 2, time: '2026-10-20T09:40:00.000Z', operator: TEST_EMAIL, action: 'RETRY_ANALYSIS', target: 'analysis #302', details: 'retry failed job', ip: '203.0.113.10' },
];

const JOBS = [
  { id: 501, title: 'Frontend Developer', company: 'Tech Corp', createdAt: '2026-10-10T00:00:00.000Z' },
  { id: 502, title: 'Backend Developer', company: 'Cloud Co', createdAt: '2026-10-11T00:00:00.000Z' },
  { id: 503, title: 'QA Engineer', company: 'QA House', createdAt: '2026-10-12T00:00:00.000Z' },
];

/* ---------- state ---------- */
const state = {
  resumes: [{ id: 201, userId: USER.id, originalName: 'sample-resume.pdf', mimeType: 'application/pdf', fileSize: 2473, pageCount: 1, extractionStatus: 'COMPLETED', status: 'COMPLETED', uploadedAt: new Date().toISOString() }],
  analyses: [...HISTORY],
  nextResumeId: 202,
  nextAnalysisId: 400,
  nextJobId: 504,
  nextUserId: 104, // ต่อจาก user seed id 101-103 — ใช้กับ user ที่สมัคร/ล็อกอินระหว่างรันเซิร์ฟเวอร์
};

// ตัวตนของคนที่ล็อกอิน/สมัครล่าสุด — /api/auth/me ต้องคืนค่านี้
// (มิฉะนั้น Dashboard จะทักทายด้วยชื่อ seed แม้ล็อกอินด้วยบัญชีอื่น เช่น บัญชีทีมงาน)
let currentUser = { name: USER.name, email: USER.email };

/** เพิ่ม/อัปเดต user ใน ADMIN_USERS ให้ตรงกับสิ่งที่ auth ตอบว่า "มีตัวตน" (ให้หน้า /admin เห็น) */
function touchMockUser(email, name) {
  const nowIso = new Date().toISOString();
  const existing = ADMIN_USERS.find((u) => u.email === email);
  if (existing) {
    existing.lastLoginAt = nowIso;
    return;
  }
  ADMIN_USERS.push({
    id: state.nextUserId++,
    name: (name || '').trim() || email.split('@')[0],
    email,
    role: 'USER',
    registeredAt: nowIso,
    lastLoginAt: nowIso,
    resumeCount: 0,
    analysisCount: 0,
    locked: false,
  });
}

/* ============================================================
 * Helpers
 * ============================================================ */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

const ok = (res, data, message = 'OK') => sendJson(res, 200, { success: true, message, data });
const created = (res, data, message = 'สร้างสำเร็จ') => sendJson(res, 201, { success: true, message, data });
const badRequest = (res, message) => sendJson(res, 400, { success: false, message });
const unauthorized = (res) => sendJson(res, 401, { success: false, message: 'กรุณาเข้าสู่ระบบ', code: 'TOKEN_REQUIRED' });
const endpointNotFound = (res, method, fullPath) =>
  sendJson(res, 404, { success: false, message: `ไม่พบ API ${method} ${fullPath}`, code: 'ENDPOINT_NOT_FOUND' });
const conflict = (res, message) => sendJson(res, 409, { success: false, message });

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () => resolve(Buffer.alloc(0)));
  });
}

function isAuthed(req) {
  const auth = req.headers['authorization'] || '';
  return auth.length > 10;
}

function fakeToken(userId) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, role: USER.role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  return `mock.header.${payload}.mock-signature`;
}

function isValidPassword(password) {
  return typeof password === 'string' &&
    password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
}

/* ============================================================
 * API Router — สะท้อนหลักฐานจริงของ learnace.tech
 * ============================================================ */
async function handleApi(req, res, pathname, body) {
  const method = req.method || 'GET';

  /* ---------- Auth ---------- */
  if (pathname === '/api/auth/login' && method === 'POST') {
    let parsed = {};
    try { parsed = JSON.parse(body.toString('utf8') || '{}'); } catch { parsed = {}; }
    const email = String(parsed.email ?? '').trim();
    const password = String(parsed.password ?? '');

    if (!email || !password) return badRequest(res, 'กรุณากรอกอีเมลและรหัสผ่าน');
    // กติกา negative testing: อีเมลที่มี ".invalid" / รหัสผ่าน Wrong* → 401 (เหมือนระบบจริงปฏิเสธ)
    if (email.includes('.invalid') || password.startsWith('Wrong')) {
      return unauthorized(res);
    }
    // สะท้อนผลล็อกอินลงรายชื่อที่ /admin แสดง: อัปเดต lastLoginAt หรือเพิ่ม user ใหม่
    // บัญชีทีมงานใช้ชื่อที่แสดงจริงจาก TEAM_USERS แทน email prefix
    const teamMember = TEAM_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    touchMockUser(email, teamMember ? teamMember.name : '');
    // จำตัวตนผู้ใช้ปัจจุบันไว้ให้ /api/auth/me ใช้ — ชื่อต้องตรงกับที่แสดงใน /admin
    const userNow = ADMIN_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    currentUser = { name: userNow ? userNow.name : email.split('@')[0], email };
    return ok(res, { user: { ...USER, email }, token: fakeToken(USER.id) }, 'เข้าสู่ระบบสำเร็จ');
  }

  if (pathname === '/api/auth/register' && method === 'POST') {
    let parsed = {};
    try { parsed = JSON.parse(body.toString('utf8') || '{}'); } catch { parsed = {}; }
    const name = String(parsed.name ?? '').trim();
    const email = String(parsed.email ?? '').trim();
    const password = String(parsed.password ?? '');
    const confirmPassword = String(parsed.confirmPassword ?? '');

    if (!name || !email || !password) return badRequest(res, 'กรุณากรอกข้อมูลให้ครบถ้วน');
    if (password !== confirmPassword) return badRequest(res, 'รหัสผ่านไม่ตรงกัน');
    if (!isValidPassword(password)) return badRequest(res, 'รหัสผ่านไม่เป็นไปตามกติกา (ต้องมี 8 ตัวขึ้นไป ตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข)');
    if (/duplicate/i.test(email) || ADMIN_USERS.some((u) => u.email.toLowerCase() === email.toLowerCase())) return conflict(res, 'อีเมลนี้ถูกใช้สมัครแล้ว');
    // เก็บ user ใหม่ลงรายชื่อให้หน้า /admin เห็น (จำลอง persistence — ข้อมูลอยู่เฉพาะตอนเซิร์ฟเวอร์ยังรันอยู่)
    touchMockUser(email, name);
    // จำตัวตนผู้ใช้ปัจจุบันไว้ให้ /api/auth/me ใช้
    const userNow = ADMIN_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    currentUser = { name: userNow ? userNow.name : name, email };
    return created(res, { user: { ...USER, email }, token: fakeToken(USER.id) }, 'สมัครสมาชิกสำเร็จ');
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    if (!isAuthed(req)) return unauthorized(res);
    // คืนตัวตนของคนที่ล็อกอิน/สมัครล่าสุด — ไม่ใช่ USER seed ตายตัว
    return ok(res, { user: { ...USER, name: currentUser.name, email: currentUser.email } }, 'ดึงข้อมูลผู้ใช้สำเร็จ');
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    return ok(res, null, 'ออกจากระบบสำเร็จ');
  }

  /* ---------- Resumes ---------- */
  if (pathname === '/api/resumes/upload' && method === 'POST') {
    if (!isAuthed(req)) return unauthorized(res);
    const raw = body.toString('latin1');
    const contentLength = Number(req.headers['content-length'] ?? 0);
    if (/not-a-real-cv|malicious|oversized/i.test(raw) || contentLength > 5 * 1024 * 1024) {
      return badRequest(res, 'ไฟล์ไม่ถูกต้องหรือมีขนาดใหญ่เกินกำหนด (สูงสุด 5MB)');
    }
    // สะท้อนชื่อไฟล์จริงที่ผู้ใช้อัปโหลด (multipart Content-Disposition)
    // — ระบบจริงเก็บ originalName ตามไฟล์ของผู้ใช้ เช่น resume-Kanyarat-Patthanan.pdf
    const fileNameMatch = /filename="([^"]*)"/i.exec(raw);
    const originalName = fileNameMatch ? fileNameMatch[1].trim() : 'sample-resume.pdf';
    const resume = {
      ...state.resumes[0],
      id: state.nextResumeId++,
      originalName,
      uploadedAt: new Date().toISOString(),
    };
    state.resumes.push(resume);
    return created(res, { resume }, 'อัปโหลดสำเร็จ');
  }

  if (pathname === '/api/resumes' && method === 'GET') {
    if (!isAuthed(req)) return unauthorized(res);
    // ประวัติการวิเคราะห์แนบมากับ resumes response (GET /api/analyses ไม่มีจริงตามหลักฐาน)
    return ok(res, { resumes: state.resumes, history: state.analyses.slice(0, 10) });
  }

  /* ---------- Analysis ----------
   * หลักฐานสำคัญ: GET /api/analyses (collection) ไม่มีอยู่จริงบน learnace.tech
   * mock server สะท้อนพฤติกรรม 404 ENDPOINT_NOT_FOUND ให้ตรงกัน
   */
  if (pathname === '/api/analyses' && method === 'GET') {
    return endpointNotFound(res, method, '/api/analyses');
  }

  const createAnalysis = /^\/api\/resumes\/(\d+)\/analyses$/.exec(pathname);
  if (createAnalysis && method === 'POST') {
    if (!isAuthed(req)) return unauthorized(res);
    let parsed = {};
    try { parsed = JSON.parse(body.toString('utf8') || '{}'); } catch { parsed = {}; }
    const resumeId = Number(createAnalysis[1]);
    const jobDescriptionId = parsed.jobDescriptionId != null && parsed.jobDescriptionId !== ''
      ? String(parsed.jobDescriptionId) : null;
    const analysis = buildAnalysis(state.nextAnalysisId++, resumeId, jobDescriptionId);
    state.analyses.unshift({
      id: analysis.id, userName: USER.name, userEmail: USER.email,
      resumeName: 'sample-resume.pdf',
      jobTitle: jobDescriptionId ? (JOBS.find((j) => String(j.id) === jobDescriptionId)?.title ?? '—') : '—',
      analysisType: analysis.analysisType, score: analysis.overallScore,
      status: 'COMPLETED', createdAt: analysis.createdAt,
    });
    return created(res, { analysisRun: analysis, analysis }, 'วิเคราะห์สำเร็จ');
  }

  const getAnalysis = /^\/api\/analyses\/(\d+)$/.exec(pathname);
  if (getAnalysis && method === 'GET') {
    if (!isAuthed(req)) return unauthorized(res);
    const id = Number(getAnalysis[1]);
    const found = state.analyses.find((item) => item.id === id);
    return ok(res, { analysisRun: found ?? buildAnalysis(id, 201, null) });
  }

  /* ---------- Jobs ---------- */
  if (pathname === '/api/jobs' && method === 'GET') {
    if (!isAuthed(req)) return unauthorized(res);
    return ok(res, { jobs: JOBS });
  }

  if (pathname === '/api/jobs' && method === 'POST') {
    if (!isAuthed(req)) return unauthorized(res);
    let parsed = {};
    try { parsed = JSON.parse(body.toString('utf8') || '{}'); } catch { parsed = {}; }
    const title = String(parsed.title ?? '').trim();
    if (!title) return badRequest(res, 'กรุณาระบุชื่อตำแหน่งงาน');
    const job = { id: state.nextJobId++, title, company: String(parsed.company ?? ''), createdAt: new Date().toISOString() };
    JOBS.push(job);
    return created(res, { job }, 'สร้างตำแหน่งงานสำเร็จ');
  }

  /* ---------- Admin ---------- */
  if (pathname.startsWith('/api/admin')) {
    if (!isAuthed(req)) return unauthorized(res);
    if (pathname === '/api/admin/users' && method === 'GET') {
      return ok(res, { users: ADMIN_USERS });
    }
    const successCount = state.analyses.filter((a) => a.status === 'COMPLETED').length;
    const failedCount = 3;
    return ok(res, {
      totalUsers: 1284,
      totalResumes: 2418,
      totalAnalyses: 3562,
      averageScore: 74.5,
      successRate: 96.4,
      analysesToday: 42,
      activeUsersToday: 89,
      byStatus: { success: 3435, failed: 127, queued: 18 },
      avgAnalysisSeconds: 47,
      trend: [
        { date: '2026-10-15', total: 44, success: 42, failed: 2, successRate: 95.5, avgSeconds: 51 },
        { date: '2026-10-16', total: 51, success: 50, failed: 1, successRate: 98.0, avgSeconds: 44 },
        { date: '2026-10-17', total: 39, success: 37, failed: 2, successRate: 94.9, avgSeconds: 49 },
      ],
      history: state.analyses.slice(0, 10),
      counts: { success: successCount, failed: failedCount },
    }, 'ดึงสถิติผู้ดูแลระบบสำเร็จ');
  }

  /* ---------- เส้นอื่นทั้งหมด: สะท้อนพฤติกรรมจริง = ENDPOINT_NOT_FOUND ---------- */
  return endpointNotFound(res, method, pathname);
}

/* ============================================================
 * HTML Pages (SPA จำลอง)
 * ============================================================ */
const style = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; background: #f4f7f9; color: #16323a; }
  nav { background: #162235; color: #fff; padding: 10px 16px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
  nav a, nav button.linklike { color: #9fd8e6; text-decoration: none; font-size: 14px; background: none; border: 0; cursor: pointer; }
  nav strong { color: #37dcf2; }
  main { max-width: 880px; margin: 24px auto; padding: 0 16px; }
  .card { background: #fff; border: 1px solid #dce7ec; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  label { display: block; margin: 8px 0 4px; font-size: 14px; }
  input, select { display: block; margin: 4px 0 8px; width: 100%; max-width: 420px; padding: 8px; }
  button[type="submit"], .btn { padding: 9px 18px; margin: 6px 8px 6px 0; cursor: pointer; background: #1b6b7a; color: #fff; border: 0; border-radius: 6px; font-size: 14px; }
  button:disabled { background: #9bb; cursor: not-allowed; }
  [role="alert"] { background: #fee2e2; color: #991b1b; padding: 10px; border-radius: 6px; margin: 8px 0; }
  .upload-success { background: #dcfce7; color: #166534; padding: 10px; border-radius: 6px; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
  th, td { border-bottom: 1px solid #e3edf1; padding: 8px 6px; text-align: left; }
  th { background: #eef6f8; color: #16404a; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .stat-card { background: #fff; border: 1px solid #dce7ec; border-left: 4px solid #1b6b7a; border-radius: 8px; padding: 12px; }
  .stat-card .value { font-size: 24px; font-weight: 700; color: #16404a; }
  .stat-card .label { font-size: 12px; color: #607c86; margin-top: 4px; }
  .overall-score { font-size: 42px; font-weight: 800; color: #1b6b7a; }
  ul.scores { list-style: none; padding: 0; max-width: 420px; }
  ul.scores li { padding: 6px 0; border-bottom: 1px dashed #e3edf1; font-size: 14px; display: flex; justify-content: space-between; }
  .rule { font-size: 13px; color: #6b7f87; }
  .rule.passed { color: #166534; }
  .tabs { display: flex; gap: 12px; flex-wrap: wrap; font-size: 13px; color: #40606c; margin-bottom: 12px; }
  .tabs span { padding: 4px 10px; background: #e6f0f3; border-radius: 6px; }
  h1 { font-size: 20px; } h2 { font-size: 17px; } h3 { font-size: 15px; }
  .muted { color: #607c86; font-size: 13px; }
`;

function page(title, body, script = '') {
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>${style}</style></head><body>${body}<script>${script}</script></body></html>`;
}

const navHtml = `
<nav data-testid="app-nav">
  <strong>LearnAce</strong>
  <a href="/dashboard">Dashboard</a>
  <a href="/resumes/upload">อัปโหลด Resume</a>
  <a href="/jobs">Job Descriptions</a>
  <a href="/admin">Admin</a>
  <button class="linklike" data-testid="nav-logout" onclick="doLogout()">ออกจากระบบ</button>
</nav>`;

const loginScript = `
function getAuthToken(){ return localStorage.getItem('token') || ''; }
async function api(path, options){
  const headers = Object.assign({'Content-Type':'application/json'}, options && options.headers || {});
  const token = getAuthToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(path, Object.assign({}, options, { headers }));
  let body = null;
  try { body = await res.json(); } catch (e) { body = { success:false, message:'รูปแบบคำตอบไม่ถูกต้อง' }; }
  return { status: res.status, ok: res.ok, body };
}
function showError(id, message){
  const el = document.getElementById(id);
  if (!el) { alert(message); return; }
  el.textContent = message; el.hidden = false;
}
function doLogout(){
  localStorage.removeItem('token');
  location.href = '/sign-in';
}`;

/* ---------- หน้า Sign In ---------- */
function signInPage() {
  const body = `
<main>
  <div class="card" style="max-width:520px;margin:40px auto">
    <h1>เข้าสู่ระบบ</h1>
    <p class="muted">ยินดีต้อนรับกลับ เข้าสู่บัญชีของคุณเพื่อดำเนินการต่อ</p>
    <form id="login-form">
      <label for="email">อีเมล</label>
      <input id="email" name="email" type="email" placeholder="อีเมล" required />
      <label for="password">รหัสผ่าน</label>
      <input id="password" name="password" type="password" placeholder="รหัสผ่าน" />
      <div role="alert" id="login-error" hidden></div>
      <button type="submit" id="login-btn">เข้าสู่ระบบ</button>
      <button type="button" class="btn" style="background:#57606a" id="google-btn">ดำเนินการต่อด้วย Google</button>
    </form>
    <p><a href="/forgot-password">ลืมรหัสผ่าน?</a></p>
    <p class="muted">ยังไม่มีบัญชี? <a href="/register">สมัครสมาชิก</a> · <a href="/privacy">นโยบายความเป็นส่วนตัว</a></p>
  </div>
</main>`;
  const script = `
document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorBox = document.getElementById('login-error');
  errorBox.hidden = true;
  if (!email || !password) {
    errorBox.textContent = 'กรุณากรอกอีเมลและรหัสผ่าน';
    errorBox.hidden = false;
    return;
  }
  const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (result.status >= 400) {
    errorBox.textContent = result.body.message || 'เข้าสู่ระบบไม่สำเร็จ';
    errorBox.hidden = false;
    return;
  }
  localStorage.setItem('token', result.body.data.token);
  localStorage.setItem('user', JSON.stringify(result.body.data.user));
  location.href = '/dashboard';
});`;
  return page('เข้าสู่ระบบ — LearnAce', body, loginScript + script);
}

/* ---------- หน้า Register ---------- */
function registerPage() {
  const body = `
<main>
  <div class="card" style="max-width:560px;margin:40px auto">
    <h1>สมัครสมาชิก</h1>
    <form id="register-form">
      <label for="name">ชื่อนามสกุล</label>
      <input id="name" name="name" type="text" placeholder="ชื่อนามสกุล" />
      <label for="email">อีเเมล</label>
      <input id="email" name="email" type="email" placeholder="อีเเมล" />
      <label for="password">รหัสผ่าน</label>
      <input id="password" name="password" type="password" placeholder="รหัสผ่าน" />
      <div id="password-rules" style="margin:4px 0 8px">
        <div class="rule" data-rule="0">* อย่างน้อย 8 ตัวอักษร (ยังไม่ผ่าน)</div>
        <div class="rule" data-rule="1">* ตัวพิมพ์ใหญ่ (A–Z) (ยังไม่ผ่าน)</div>
        <div class="rule" data-rule="2">* ตัวพิมพ์เล็ก (a–z) (ยังไม่ผ่าน)</div>
        <div class="rule" data-rule="3">* ตัวเลข (0–9) (ยังไม่ผ่าน)</div>
      </div>
      <label for="confirm">ยืนยันรหัสผ่าน</label>
      <input id="confirm" name="confirmPassword" type="password" placeholder="ยืนยันรหัสผ่าน" />
      <div role="alert" id="register-error" hidden></div>
      <div role="status" id="register-success" hidden></div>
      <button type="submit" id="register-btn">สมัครสมาชิก</button>
      <button type="button" class="btn" style="background:#57606a">ดำเนินการต่อด้วย Google</button>
    </form>
    <p class="muted">มีบัญชีอยู่แล้ว? <a href="/sign-in">เข้าสู่ระบบ</a> · <a href="/privacy">นโยบายความเป็นส่วนตัว</a></p>
  </div>
</main>`;
  const script = `
const passwordInput = document.getElementById('password');
const RULES = [
  (value) => value.length >= 8,
  (value) => /[A-Z]/.test(value),
  (value) => /[a-z]/.test(value),
  (value) => /[0-9]/.test(value),
];
const RULE_LABELS = ['อย่างน้อย 8 ตัวอักษร', 'ตัวพิมพ์ใหญ่ (A–Z)', 'ตัวพิมพ์เล็ก (a–z)', 'ตัวเลข (0–9)'];
passwordInput.addEventListener('input', () => {
  const value = passwordInput.value;
  RULES.forEach((rule, index) => {
    const el = document.querySelector('.rule[data-rule="' + index + '"]');
    const passed = rule(value);
    el.textContent = '* ' + RULE_LABELS[index] + (passed ? '' : ' (ยังไม่ผ่าน)');
    el.classList.toggle('passed', passed);
  });
});
document.getElementById('register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorBox = document.getElementById('register-error');
  const successBox = document.getElementById('register-success');
  errorBox.hidden = true; successBox.hidden = true;
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = passwordInput.value;
  const confirm = document.getElementById('confirm').value;
  if (!name || !email || !password || !confirm) {
    errorBox.textContent = 'กรุณากรอกข้อมูลให้ครบถ้วน'; errorBox.hidden = false; return;
  }
  if (password !== confirm) {
    errorBox.textContent = 'รหัสผ่านไม่ตรงกัน'; errorBox.hidden = false; return;
  }
  if (!RULES.every((rule) => rule(password))) {
    errorBox.textContent = 'รหัสผ่านไม่เป็นไปตามกติกา'; errorBox.hidden = false; return;
  }
  const result = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, confirmPassword: confirm }) });
  if (result.status >= 400) {
    errorBox.textContent = result.body.message || 'สมัครสมาชิกไม่สำเร็จ'; errorBox.hidden = false; return;
  }
  successBox.textContent = 'สมัครสมาชิกสำเร็จ — กลับไปหน้าเข้าสู่ระบบเพื่อใช้งาน';
  successBox.hidden = false;
});`;
  return page('สมัครสมาชิก — LearnAce', body, loginScript + script);
}

/* ---------- หน้า Dashboard ---------- */
function dashboardPage() {
  const body = `
 ${navHtml}
<main>
  <div class="card" id="user-greeting"><h1>Dashboard</h1><p class="muted" id="greeting-text">กำลังโหลดข้อมูลผู้ใช้...</p></div>
  <div class="card">
    <h2>อัปโหลด Resume</h2>
    <form id="upload-form">
      <input type="file" id="resume-file" name="resume" accept=".pdf,.docx" />
      <button type="submit" id="upload-btn">อัปโหลด Resume</button>
    </form>
    <div class="upload-success" id="upload-success" hidden></div>
    <div role="alert" id="upload-error" hidden></div>
    <label for="job-select">เลือกตำแหน่งงาน (ถ้าต้องการเทียบ Job Description)</label>
    <select id="job-select">
      <option value="">— ไม่เลือก (วิเคราะห์ทั่วไป) —</option>
      <option>Frontend Developer</option>
      <option>Backend Developer</option>
      <option>QA Engineer</option>
    </select>
    <button type="button" class="btn" id="analyze-btn">วิเคราะห์ Resume</button>
    <div role="alert" id="analysis-error" hidden></div>
  </div>
  <div class="card" id="result-card" hidden>
    <h2>ผลการวิเคราะห์ด้วย AI</h2>
    <div>คะแนนรวม (Resume Score)</div>
    <div class="overall-score" data-testid="overall-score">—</div>
    <h3>Radar Chart</h3>
    <svg id="radar" data-testid="radar-chart" width="320" height="240" viewBox="0 0 320 240" style="background:#f8fbfc;border-radius:8px"></svg>
    <h3>Section Scores</h3>
    <ul class="scores" data-testid="section-scores" id="section-scores"></ul>
    <h3>จุดแข็ง (ข้อดี)</h3>
    <ul data-testid="strengths" id="strengths"></ul>
    <h3>จุดที่ควรปรับปรุง</h3>
    <ul data-testid="improvements" id="improvements"></ul>
    <p class="muted" id="analysis-summary"></p>
  </div>
  <div class="card">
    <h2>ประวัติการวิเคราะห์</h2>
    <table data-testid="history-table" id="history-table">
      <thead><tr><th>#</th><th>Resume</th><th>ตำแหน่ง</th><th>ประเภท</th><th>คะแนน</th><th>สถานะ</th><th>วันที่</th></tr></thead>
      <tbody id="history-body"></tbody>
    </table>
  </div>
</main>`;
  const script = `
let currentResumeId = null;
let historyRows = [];
const SCORE_LABELS = {
  contactInformation: 'ข้อมูลติดต่อ', professionalSummary: 'สรุปโปรไฟล์', skills: 'ทักษะ',
  experience: 'ประสบการณ์', projects: 'โปรเจกต์', education: 'การศึกษา', readability: 'ความอ่านง่าย'
};
async function initDashboard(){
  const me = await api('/api/auth/me');
  if (me.status >= 400) { location.href = '/sign-in'; return; }
  document.getElementById('greeting-text').textContent = 'ยินดีต้อนรับกลับ ' + me.body.data.user.name + ' (' + me.body.data.user.email + ')';
  const resumesResult = await api('/api/resumes');
  if (resumesResult.status < 400) {
    const resumes = resumesResult.body.data.resumes || [];
    if (resumes.length > 0) currentResumeId = resumes[resumes.length - 1].id;
    renderHistory(resumesResult.body.data.history || []);
  }
}
function renderHistory(rows){
  historyRows = rows;
  const tbody = document.getElementById('history-body');
  tbody.innerHTML = rows.map((row) => '<tr><td>' + row.id + '</td><td>' + row.resumeName + '</td><td>' + (row.jobTitle || '—') + '</td><td>' + row.analysisType + '</td><td>' + row.score + '</td><td>' + row.status + '</td><td>' + new Date(row.createdAt).toLocaleDateString('th-TH') + '</td></tr>').join('');
}
function renderRadar(radarData){
  const svg = document.getElementById('radar');
  const centerX = 160, centerY = 120, radius = 90;
  const points = radarData.map((item, index) => {
    const angle = (Math.PI * 2 * index) / radarData.length - Math.PI / 2;
    const value = (item.score / 100) * radius;
    return { x: centerX + value * Math.cos(angle), y: centerY + value * Math.sin(angle) };
  });
  const polygon = points.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  svg.innerHTML = '<polygon points="' + polygon + '" fill="rgba(27,107,122,0.35)" stroke="#1b6b7a" stroke-width="2"></polygon>' +
    points.map((p) => '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3" fill="#1b6b7a"></circle>').join('');
}
function renderAnalysis(analysis){
  document.getElementById('result-card').hidden = false;
  document.querySelector('[data-testid="overall-score"]').textContent = analysis.overallScore;
  renderRadar(analysis.radarData);
  const scoreList = document.getElementById('section-scores');
  scoreList.innerHTML = Object.entries(analysis.scores).map(([key, value]) =>
    '<li><span>' + (SCORE_LABELS[key] || key) + '</span><strong>' + value + '</strong></li>').join('');
  document.getElementById('strengths').innerHTML = (analysis.strengths || []).map((text) => '<li>' + text + '</li>').join('');
  document.getElementById('improvements').innerHTML = (analysis.improvements || []).map((text) => '<li>' + text + '</li>').join('');
  document.getElementById('analysis-summary').textContent = analysis.summary || '';
}
document.getElementById('upload-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const fileInput = document.getElementById('resume-file');
  const successBox = document.getElementById('upload-success');
  const errorBox = document.getElementById('upload-error');
  successBox.hidden = true; errorBox.hidden = true;
  if (!fileInput.files || fileInput.files.length === 0) {
    errorBox.textContent = 'กรุณาเลือกไฟล์ Resume ก่อน'; errorBox.hidden = false; return;
  }
  const formData = new FormData();
  formData.append('resume', fileInput.files[0]);
  const token = getAuthToken();
  const res = await fetch('/api/resumes/upload', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData });
  let body = {}; try { body = await res.json(); } catch (e) {}
  if (res.status >= 400) {
    errorBox.textContent = body.message || 'อัปโหลดไม่สำเร็จ'; errorBox.hidden = false; return;
  }
  currentResumeId = body.data.resume.id;
  successBox.textContent = 'อัปโหลดสำเร็จ: ' + body.data.resume.originalName;
  successBox.hidden = false;
});
document.getElementById('analyze-btn').addEventListener('click', async () => {
  const errorBox = document.getElementById('analysis-error');
  errorBox.hidden = true;
  if (!currentResumeId) {
    errorBox.textContent = 'กรุณาอัปโหลด Resume ก่อนวิเคราะห์'; errorBox.hidden = false; return;
  }
  const jobSelect = document.getElementById('job-select');
  const jobValue = jobSelect.value;
  const jobLabel = jobSelect.selectedIndex > 0 ? jobSelect.options[jobSelect.selectedIndex].text : null;
  const result = await api('/api/resumes/' + currentResumeId + '/analyses', { method: 'POST', body: JSON.stringify({ jobDescriptionId: jobValue || null }) });
  if (result.status >= 400) {
    errorBox.textContent = result.body.message || 'วิเคราะห์ไม่สำเร็จ'; errorBox.hidden = false; return;
  }
  const analysis = result.body.data.analysisRun;
  renderAnalysis(analysis);
  renderHistory([
    { id: analysis.id, resumeName: 'sample-resume.pdf', jobTitle: jobLabel || '—', analysisType: analysis.analysisType, score: analysis.overallScore, status: 'COMPLETED', createdAt: analysis.createdAt },
    ...historyRows.filter((row) => row.id !== analysis.id),
  ]);
});
initDashboard();`;
  return page('Dashboard — LearnAce', body, loginScript + script);
}

/* ---------- หน้า Upload (แยก) ---------- */
function uploadPage() {
  return dashboardPage().replace('<title>Dashboard — LearnAce</title>', '<title>อัปโหลด Resume — LearnAce</title>');
}

/* ---------- หน้า Jobs ---------- */
function jobsPage() {
  const body = `
 ${navHtml}
<main>
  <div class="card"><h1>Job Descriptions</h1>
    <form id="job-form">
      <label for="job-title">ชื่อตำแหน่งงาน</label>
      <input id="job-title" type="text" placeholder="เช่น Frontend Developer" />
      <label for="job-company">บริษัท</label>
      <input id="job-company" type="text" placeholder="เช่น Tech Corp" />
      <div role="alert" id="job-error" hidden></div>
      <button type="submit">เพิ่มตำแหน่งงาน</button>
    </form>
    <table id="jobs-table"><thead><tr><th>#</th><th>ตำแหน่ง</th><th>บริษัท</th><th>วันที่สร้าง</th></tr></thead><tbody id="jobs-body"></tbody></table>
  </div>
</main>`;
  const script = `
async function initJobs(){
  const result = await api('/api/jobs');
  if (result.status >= 400) { location.href = '/sign-in'; return; }
  render(result.body.data.jobs || []);
}
function render(jobs){
  document.getElementById('jobs-body').innerHTML = jobs.map((job) =>
    '<tr><td>' + job.id + '</td><td>' + job.title + '</td><td>' + (job.company || '—') + '</td><td>' + new Date(job.createdAt).toLocaleDateString('th-TH') + '</td></tr>').join('');
}
document.getElementById('job-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorBox = document.getElementById('job-error');
  errorBox.hidden = true;
  const title = document.getElementById('job-title').value.trim();
  const company = document.getElementById('job-company').value.trim();
  const result = await api('/api/jobs', { method: 'POST', body: JSON.stringify({ title, company }) });
  if (result.status >= 400) { errorBox.textContent = result.body.message || 'บันทึกไม่สำเร็จ'; errorBox.hidden = false; return; }
  document.getElementById('job-title').value = '';
  document.getElementById('job-company').value = '';
  await initJobs();
});
initJobs();`;
  return page('Job Descriptions — LearnAce', body, loginScript + script);
}

/* ---------- หน้า Admin ---------- */
function adminPage() {
  const body = `
 ${navHtml}
<main>
  <div class="card">
    <h1>Admin Panel</h1>
    <div class="tabs">
      <span>System Overview</span><span>Services</span><span>Data</span><span>Users</span><span>Analysis</span><span>Audit log</span><span>Session</span>
    </div>
    <div id="admin-gate">
      <p class="muted">ส่วนนี้สำหรับผู้ดูแลระบบ — กรุณาเข้าสู่ระบบ</p>
      <form id="admin-login-form">
        <label for="admin-email">อีเมล</label>
        <input id="admin-email" type="email" placeholder="อีเมล" />
        <label for="admin-password">รหัสผ่าน</label>
        <input id="admin-password" type="password" placeholder="รหัสผ่าน" />
        <div role="alert" id="admin-error" hidden></div>
        <button type="submit">เข้าสู่ระบบ</button>
      </form>
    </div>
    <div id="admin-content" hidden>
      <h2 data-testid="admin-overview">System Overview</h2>
      <p class="muted">สถิติและแนวโน้มการวิเคราะห์ Resume · อัตราความสำเร็จ = Success ÷ (Success + Failure)</p>
      <div class="stats-grid" id="stats-grid"></div>
      <h3>Service Status</h3>
      <p class="muted" data-testid="queue-status">ระบบคิวงาน: Queue Analysis (BullMQ) · auto-refresh ทุก 15 วินาที</p>
      <h3>แนวโน้มรายวัน (Trend)</h3>
      <table data-testid="trend-table"><thead><tr><th>วันที่</th><th>รวม</th><th>สำเร็จ</th><th>ล้มเหลว</th><th>Success Rate</th><th>เวลาเฉลี่ย (วินาที)</th></tr></thead><tbody id="trend-body"></tbody></table>
      <h2>Users</h2>
      <label for="user-search">ค้นหาผู้ใช้</label>
      <input id="user-search" data-testid="user-search" type="search" placeholder="ค้นหาด้วยชื่อหรืออีเมล" />
      <table data-testid="users-table"><thead><tr><th>User</th><th>Role</th><th>Registered When</th><th>Last Login</th><th>Resume/Analysis</th><th>Manage</th></tr></thead><tbody id="users-body"></tbody></table>
      <h2>Analysis</h2>
      <label for="analysis-filter">กรองตามสถานะ</label>
      <select id="analysis-filter" data-testid="analysis-filter">
        <option>All</option>
        <option>In progress (Queued)</option>
        <option>Abnormally long pending</option>
        <option>Success</option>
        <option>Failed</option>
      </select>
      <table data-testid="analysis-table"><thead><tr><th>#</th><th>User/Resume</th><th>Type</th><th>Status</th><th>Score</th><th>Created When</th><th>Manage</th></tr></thead><tbody id="analysis-body"></tbody></table>
      <h2 data-testid="audit-log">Audit log</h2>
      <table data-testid="audit-table"><thead><tr><th>Time</th><th>Operator</th><th>Action</th><th>Target</th><th>Details</th><th>IP</th></tr></thead><tbody id="audit-body"></tbody></table>
    </div>
  </div>
</main>`;
  const script = `
const AUDIT_LOG_ROWS = ${JSON.stringify(AUDIT_LOG)};
function fmt(n){ return Number(n).toLocaleString('en-US'); }
document.getElementById('admin-login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorBox = document.getElementById('admin-error');
  errorBox.hidden = true;
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  if (!email || !password) { errorBox.textContent = 'กรุณากรอกอีเมลและรหัสผ่าน'; errorBox.hidden = false; return; }
  const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (result.status >= 400) { errorBox.textContent = result.body.message || 'เข้าสู่ระบบไม่สำเร็จ'; errorBox.hidden = false; return; }
  localStorage.setItem('token', result.body.data.token);
  await loadAdmin();
});
async function loadAdmin(){
  const stats = await api('/api/admin/stats');
  if (stats.status >= 400) { return; }
  document.getElementById('admin-gate').hidden = true;
  document.getElementById('admin-content').hidden = false;
  const data = stats.body.data;
  const cards = [
    { label: 'Total Users', value: fmt(data.totalUsers) },
    { label: 'Total Resumes', value: fmt(data.totalResumes) },
    { label: 'Total Analyses', value: fmt(data.totalAnalyses) },
    { label: 'Average Score', value: data.averageScore },
    { label: 'Success Rate', value: data.successRate + '%' },
    { label: 'Analyses Today', value: fmt(data.analysesToday) },
  ];
  document.getElementById('stats-grid').innerHTML = cards.map((card) =>
    '<div class="stat-card" data-testid="admin-stat-card"><div class="value">' + card.value + '</div><div class="label">' + card.label + '</div></div>').join('');
  document.getElementById('trend-body').innerHTML = data.trend.map((row) =>
    '<tr><td>' + row.date + '</td><td>' + row.total + '</td><td>' + row.success + '</td><td>' + row.failed + '</td><td>' + row.successRate + '%</td><td>' + row.avgSeconds + '</td></tr>').join('');
  const usersResult = await api('/api/admin/users');
  const users = usersResult.status < 400 ? usersResult.body.data.users : [];
  document.getElementById('users-body').innerHTML = users.map((user) =>
    '<tr><td>' + user.name + ' (' + user.email + ')</td><td>' + user.role + '</td><td>' + new Date(user.registeredAt).toLocaleDateString('th-TH') + '</td><td>' + new Date(user.lastLoginAt).toLocaleString('th-TH') + '</td><td>' + user.resumeCount + ' / ' + user.analysisCount + '</td><td>' + (user.locked ? 'ปลดล็อก' : 'จัดการ') + '</td></tr>').join('');
  document.getElementById('analysis-body').innerHTML = data.history.map((row) =>
    '<tr><td>' + row.id + '</td><td>' + row.userName + ' / ' + row.resumeName + '</td><td>' + row.analysisType + '</td><td>' + row.status + '</td><td>' + row.score + '</td><td>' + new Date(row.createdAt).toLocaleString('th-TH') + '</td><td>จัดการ</td></tr>').join('');
  document.getElementById('audit-body').innerHTML = AUDIT_LOG_ROWS.map((row) =>
    '<tr><td>' + new Date(row.time).toLocaleString('th-TH') + '</td><td>' + row.operator + '</td><td>' + row.action + '</td><td>' + row.target + '</td><td>' + row.details + '</td><td>' + row.ip + '</td></tr>').join('');
  document.getElementById('user-search').addEventListener('input', (event) => {
    const keyword = event.target.value.toLowerCase();
    const filtered = users.filter((user) => user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword));
    document.getElementById('users-body').innerHTML = filtered.map((user) =>
      '<tr><td>' + user.name + ' (' + user.email + ')</td><td>' + user.role + '</td><td>' + new Date(user.registeredAt).toLocaleDateString('th-TH') + '</td><td>' + new Date(user.lastLoginAt).toLocaleString('th-TH') + '</td><td>' + user.resumeCount + ' / ' + user.analysisCount + '</td><td>' + (user.locked ? 'ปลดล็อก' : 'จัดการ') + '</td></tr>').join('');
  });
  document.getElementById('analysis-filter').addEventListener('change', (event) => {
    const value = event.target.value;
    const filtered = value === 'All' ? data.history : data.history.filter((row) => row.status.toLowerCase() === value.toLowerCase() || (value === 'Success' && row.status === 'COMPLETED'));
    document.getElementById('analysis-body').innerHTML = filtered.map((row) =>
      '<tr><td>' + row.id + '</td><td>' + row.userName + ' / ' + row.resumeName + '</td><td>' + row.analysisType + '</td><td>' + row.status + '</td><td>' + row.score + '</td><td>' + new Date(row.createdAt).toLocaleString('th-TH') + '</td><td>จัดการ</td></tr>').join('');
  });
}
(async function initAdmin(){
  const token = getAuthToken();
  if (!token) return;
  const me = await api('/api/auth/me');
  if (me.status < 400) await loadAdmin();
})();`;
  return page('Admin — LearnAce', body, loginScript + script);
}

/* ---------- หน้า placeholder สำหรับลิงก์รอง ---------- */
function simplePage(title, heading, detail) {
  const body = `
 ${navHtml}
<main><div class="card"><h1>${heading}</h1><p class="muted">${detail}</p></div></main>`;
  return page(title, body, loginScript);
}

/* ============================================================
 * HTTP Server
 * ============================================================ */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  try {
    /* favicon กัน noise */
    if (pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    /* API — ตามหลักฐานจริงของ learnace.tech */
    if (pathname.startsWith('/api/')) {
      const body = await readBody(req);
      await handleApi(req, res, pathname, body);
      return;
    }

    /* หน้าเว็บ */
    let html;
    switch (pathname) {
      case '/':
      case '/sign-in':
        html = signInPage();
        break;
      case '/register':
        html = registerPage();
        break;
      case '/dashboard':
        html = dashboardPage();
        break;
      case '/resumes/upload':
        html = uploadPage();
        break;
      case '/jobs':
        html = jobsPage();
        break;
      case '/admin':
        html = adminPage();
        break;
      case '/forgot-password':
        html = simplePage('ลืมรหัสผ่าน — LearnAce', 'ลืมรหัสผ่าน', 'กรุณากรอกอีเมลเพื่อรับลิงก์ตั้งรหัสผ่านใหม่ (หน้าจำลอง)');
        break;
      case '/privacy':
        html = simplePage('นโยบายความเป็นส่วนตัว — LearnAce', 'นโยบายความเป็นส่วนตัว', 'ข้อความนโยบายจำลองสำหรับการทดสอบ');
        break;
      default:
        /* สะท้อน BUG-001 ของเว็บจริง: URL ไม่มีจริง → แสดงหน้าเข้าสู่ระบบ (ไม่มี 404 page) */
        html = signInPage();
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
  } catch (error) {
    sendJson(res, 500, { success: false, message: 'Internal Server Error (mock)', code: 'INTERNAL_ERROR' });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    process.stdout.write(`Mock app server running at http://${HOST}:${PORT}\n`);
  });
}

module.exports = { server, PORT, HOST };