import {
  test as base,
  expect,
  type Page,
  type Route,
} from '@playwright/test';
import {
  APP,
  API_ENVELOPE_CODES,
} from '../config/config';
import {
  isPasswordPolicyCompliant,
  isDuplicateEmail,
  isLoginRejected,
  isUploadRejected,
} from '../helpers/validators';
import {
  ENV,
  MOCK_CREDENTIALS,
  hasTestAccount,
  findTeamUserByEmail,
} from './test-data';

/**
 * ============================================================
 * Mocked Persistence Strategy — Stateful API Mock via page.route()
 * ============================================================
 * เป้าหมาย: ทุก E2E เทสต์ทำงานโดย "ไม่มีข้อมูลใดเข้าฐานข้อมูลจริง"
 *  - ดักจับทุกเส้น "/api/**" ด้วย page.route() และตอบด้วย envelope จริงของระบบ:
 *      { success: boolean, message: string, data: ... }
 *  - state ทั้งหมดอยู่ในหน่วยความจำของ test process → หายไปเองเมื่อจบเทสต์
 *  - จำลองพฤติกรรมที่ยืนยันจากเว็บจริง:
 *      · เส้น protected ที่ยังไม่ยืนยันตัวตน → TOKEN_REQUIRED
 *      · GET /api/analyses (collection) → ENDPOINT_NOT_FOUND (ยืนยันว่าไม่มีจริง!)
 *  - MOCK_API=false → ปิด mock ทั้งหมด (ใช้เฉพาะกับ QA backend ที่แยกออกมา)
 *
 * ความต่างจาก fixtures เดิม (ai-cv-analyzer-e2e): เพิ่ม registration,
 * jobs CRUD, admin users และตรรกะ token guard ตามหลักฐาน live probe
 */

/* ---------- บัญชีสำหรับ MOCK mode ---------- */
export const MOCK_USER = {
  id: 101,
  name: 'สมชาย ใจดี',
  email: ENV.testEmail || MOCK_CREDENTIALS.email,
  role: 'ADMIN' as const,
  createdAt: '2026-10-01T03:00:00.000Z',
  lastLoginAt: new Date().toISOString(),
};

const tokenPayload = Buffer.from(
  JSON.stringify({
    sub: MOCK_USER.id,
    role: MOCK_USER.role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })
).toString('base64url');

export const MOCK_TOKEN = `mock.header.${tokenPayload}.mock-signature`;

/* ---------- Payload ตัวอย่าง (สอดคล้องกับ scripts/mock-app-server.js) ---------- */

export const MOCK_RESUME = {
  id: 201,
  userId: MOCK_USER.id,
  originalName: 'sample-resume.pdf',
  mimeType: 'application/pdf',
  fileSize: 2473,
  pageCount: 1,
  extractionStatus: 'COMPLETED',
  status: 'COMPLETED',
  uploadedAt: new Date().toISOString(),
};

export const MOCK_SECTION_SCORES: Record<string, number> = {
  contactInformation: 90,
  professionalSummary: 78,
  skills: 88,
  experience: 82,
  projects: 76,
  education: 85,
  readability: 80,
};

export const MOCK_RADAR_DATA: Array<{ subject: string; score: number }> = [
  { subject: 'ข้อมูลติดต่อ', score: 90 },
  { subject: 'สรุปโปรไฟล์', score: 78 },
  { subject: 'ทักษะ', score: 88 },
  { subject: 'ประสบการณ์', score: 82 },
  { subject: 'โปรเจกต์', score: 76 },
  { subject: 'การศึกษา', score: 85 },
  { subject: 'ความอ่านง่าย', score: 80 },
];

export const MOCK_ANALYSIS = {
  id: 301,
  resumeId: MOCK_RESUME.id,
  userId: MOCK_USER.id,
  jobDescriptionId: null as string | null,
  analysisType: 'BASE' as const,
  status: 'COMPLETED' as const,
  overallScore: 82,
  baseResumeScore: 82,
  jobMatchScore: null as number | null,
  scores: MOCK_SECTION_SCORES,
  radarData: MOCK_RADAR_DATA,
  summary: 'Resume มีโครงสร้างชัดเจน อ่านง่าย และมีทักษะตรงกับสายงานที่สมัครเป็นอย่างดี',
  strengths: ['ประสบการณ์ทำงานเขียนได้ชัดเจน มีตัวเลขผลงานรองรับ'],
  weaknesses: ['ควรเพิ่ม keyword ของตำแหน่งงานที่สมัครให้มากขึ้น'],
  improvements: ['เพิ่มผลงานที่วัดผลได้ เช่น ลดเวลาโหลดหน้าเว็บลง 35%'],
  recommendations: ['ปรับหัวข้อ Summary ให้กระชับอยู่ใน 3 บรรทัด'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_HISTORY = [
  { id: 301, userName: 'สมชาย ใจดี', userEmail: MOCK_USER.email, resumeName: 'sample-resume.pdf', jobTitle: '—', analysisType: 'BASE', score: 82, status: 'COMPLETED', createdAt: '2026-10-21T02:30:00.000Z' },
  { id: 302, userName: 'สมหญิง รักงาน', userEmail: 'somying@example.test', resumeName: 'somying-cv-2026.pdf', jobTitle: 'Frontend Developer', analysisType: 'JOB_MATCH', score: 76, status: 'COMPLETED', createdAt: '2026-10-20T08:12:00.000Z' },
  { id: 303, userName: 'ปกรณ์ เก่งมาก', userEmail: 'pakorn@example.test', resumeName: 'pakorn-resume.pdf', jobTitle: 'Backend Developer', analysisType: 'JOB_MATCH', score: 64, status: 'COMPLETED', createdAt: '2026-10-19T04:45:00.000Z' },
  { id: 304, userName: 'มาลี สวยงาม', userEmail: 'malee@example.test', resumeName: 'malee-cv.pdf', jobTitle: '—', analysisType: 'BASE', score: 91, status: 'COMPLETED', createdAt: '2026-10-18T09:05:00.000Z' },
  { id: 305, userName: 'จิรายุ ใจเกินร้อย', userEmail: 'jirayu@example.test', resumeName: 'jirayu-cv-final.pdf', jobTitle: 'QA Engineer', analysisType: 'JOB_MATCH', score: 58, status: 'COMPLETED', createdAt: '2026-10-17T11:20:00.000Z' },
];

export const MOCK_ADMIN_STATS = {
  totalUsers: 1284,
  totalResumes: 2418,
  totalAnalyses: 3562,
  averageScore: 74.5,
  successRate: 96.4,
  analysesToday: 42,
  activeUsersToday: 89,
  // byStatus ต้องรวมกันเท่ากับ totalAnalyses (3417 + 127 + 18 = 3562)
  // — ยืนยันโดย tests/unit/mock-fixtures.test.ts
  byStatus: { success: 3417, failed: 127, queued: 18 },
  avgAnalysisSeconds: 47,
  trend: [
    { date: '2026-10-15', total: 44, success: 42, failed: 2, successRate: 95.5, avgSeconds: 51 },
    { date: '2026-10-16', total: 51, success: 50, failed: 1, successRate: 98.0, avgSeconds: 44 },
    { date: '2026-10-17', total: 39, success: 37, failed: 2, successRate: 94.9, avgSeconds: 49 },
  ],
  history: MOCK_HISTORY,
};

export const MOCK_ADMIN_USERS = [
  { id: 101, name: 'สมชาย ใจดี', email: MOCK_USER.email, role: 'ADMIN', registeredAt: '2026-10-01T03:00:00.000Z', lastLoginAt: new Date().toISOString(), resumeCount: 2, analysisCount: 5, locked: false },
  { id: 102, name: 'สมหญิง รักงาน', email: 'somying@example.test', role: 'USER', registeredAt: '2026-10-05T07:20:00.000Z', lastLoginAt: '2026-10-20T08:00:00.000Z', resumeCount: 3, analysisCount: 7, locked: false },
  { id: 103, name: 'ปกรณ์ เก่งมาก', email: 'pakorn@example.test', role: 'USER', registeredAt: '2026-10-08T10:00:00.000Z', lastLoginAt: '2026-10-19T04:00:00.000Z', resumeCount: 1, analysisCount: 3, locked: true },
];

export const MOCK_AUDIT_LOG = [
  { id: 1, time: '2026-10-21T03:15:00.000Z', operator: MOCK_USER.email, action: 'SET_ADMIN', target: 'pakorn@example.test', details: 'grant admin by email', ip: '203.0.113.10' },
  { id: 2, time: '2026-10-20T09:40:00.000Z', operator: MOCK_USER.email, action: 'RETRY_ANALYSIS', target: 'analysis #302', details: 'retry failed job', ip: '203.0.113.10' },
];

export const MOCK_JOBS = [
  { id: 501, title: 'Frontend Developer', company: 'Tech Corp', createdAt: '2026-10-10T00:00:00.000Z' },
  { id: 502, title: 'Backend Developer', company: 'Cloud Co', createdAt: '2026-10-11T00:00:00.000Z' },
];

/* ---------- Helpers ---------- */

function fulfillJson(route: Route, data: unknown, message = 'OK', status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ success: status < 400, message, data }),
  });
}

function fulfillEnvelope(route: Route, body: Record<string, unknown>, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function parseBody(route: Route): Record<string, unknown> {
  try {
    return JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function pathnameOf(route: Route): string {
  const url = new URL(route.request().url());
  return url.pathname.replace(/^.*\/api/, '');
}

/** โทเคนที่ mock ออกให้ — ถือว่า request แนบโทเคนนี้ = ยืนยันตัวตนแล้ว */
function isAuthed(route: Route): boolean {
  const auth = route.request().headers()['authorization'] ?? '';
  return auth.includes('mock.header') || auth.length > 10;
}

function requireAuth(route: Route): Promise<void> {
  return fulfillEnvelope(route, {
    success: false,
    message: API_ENVELOPE_CODES.unauthorizedMessage,
    code: API_ENVELOPE_CODES.tokenRequired,
  }, 401);
}

/**
 * แปลงค่าจาก request body เป็น string อย่างปลอดภัย
 * (กฎ SonarLint S6551: String(value) กับ object จะได้ "[object Object]" จึงใช้ JSON.stringify แทน)
 */
function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return JSON.stringify(value);
}

/* ---------- Mock State (ในหน่วยความจำ — No DB Persistence Side-Effects) ---------- */

function createMockState() {
  return {
    resumes: [{ ...MOCK_RESUME }] as Array<Record<string, unknown>>,
    analyses: [...MOCK_HISTORY] as Array<Record<string, unknown>>,
    users: MOCK_ADMIN_USERS.map((u) => ({ ...u })),
    jobs: MOCK_JOBS.map((j) => ({ ...j })),
    nextResumeId: MOCK_RESUME.id + 1,
    nextAnalysisId: 400,
    nextJobId: 503,
    nextUserId: 104, // ต่อจาก user seed id 101-103 — ใช้กับ user ที่สมัคร/ล็อกอินระหว่างเทสต์
    // ตัวตนของคนที่ล็อกอิน/สมัครล่าสุด — /api/auth/me ต้องคืนค่านี้
    // (มิฉะนั้น Dashboard จะทักทายด้วยชื่อ seed แม้ล็อกอินด้วยบัญชีอื่น)
    currentUser: { name: MOCK_USER.name, email: MOCK_USER.email },
  };
}

type MockState = ReturnType<typeof createMockState>;

/* ---------- Handlers: Authentication ---------- */

async function handleLogin(route: Route, state: MockState): Promise<boolean> {
  const body = parseBody(route);
  const email = asString(body.email);
  const password = asString(body.password);

  // รองรับ negative testing: อีเมลที่มี ".invalid" / รหัสผ่านขึ้นต้น "Wrong" / ค่าว่าง → 401
  // (กติกาอยู่ใน helpers/validators.ts — unit test ครอบคลุมที่ tests/unit/validators.test.ts)
  if (isLoginRejected(email, password)) {
    await fulfillJson(route, null, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 401);
    return true;
  }

  // สะท้อนผลล็อกอินลง state ที่ /admin ใช้แสดง: อัปเดต lastLoginAt ถ้ามี user นี้อยู่แล้ว
  // ถ้ายังไม่มี (mock ยอมรับทุกอีเมลที่ไม่โดนกฎ negative) ให้เพิ่มเข้ารายชื่อ —
  // มิฉะนั้นหน้า /admin จะไม่เห็น user ที่เพิ่งล็อกอินสำเร็จ (อาการ "ข้อมูล user ไม่แสดงใน /admin")
  // บัญชีทีมงาน (TEAM_USERS) ใช้ชื่อที่แสดงจริงแทน email prefix เช่น "Kanyarat Patthanan"
  // แทน "kanyarat.p.hr" เพื่อให้ตาราง Users ของ /admin แสดงตัวตนตรงกับคนจริง
  const teamMember = findTeamUserByEmail(email);
  touchMockUser(state, email, teamMember?.displayName);

  // จำตัวตนผู้ใช้ปัจจุบันไว้ให้ /api/auth/me ใช้ — ชื่อต้องตรงกับที่แสดงใน /admin
  const userNow = state.users.find((u) => u.email === email);
  state.currentUser = {
    name: (userNow?.name as string | undefined) || email.split('@')[0],
    email,
  };

  await fulfillJson(
    route,
    { user: { ...MOCK_USER, email }, token: MOCK_TOKEN },
    'เข้าสู่ระบบสำเร็จ'
  );
  return true;
}

/** เพิ่ม/อัปเดต user ใน state.users ให้ตรงกับสิ่งที่ auth ตอบว่า "มีตัวตน" */
function touchMockUser(state: MockState, email: string, name?: string): void {
  const now = new Date().toISOString();
  const existing = state.users.find((u) => u.email === email);
  if (existing) {
    existing.lastLoginAt = now;
    return;
  }
  state.users.push({
    id: state.nextUserId++,
    name: name?.trim() || email.split('@')[0],
    email,
    role: 'USER',
    registeredAt: now,
    lastLoginAt: now,
    resumeCount: 0,
    analysisCount: 0,
    locked: false,
  });
}

async function handleRegister(route: Route, state: MockState): Promise<boolean> {
  const body = parseBody(route);
  const email = asString(body.email);
  const name = asString(body.name);
  const password = asString(body.password);
  const confirmPassword = asString(body.confirmPassword);

  if (!email || !password) {
    await fulfillJson(route, null, 'กรุณากรอกข้อมูลให้ครบถ้วน', 400);
    return true;
  }
  if (password !== confirmPassword) {
    await fulfillJson(route, null, 'รหัสผ่านไม่ตรงกัน', 400);
    return true;
  }
  if (!isPasswordPolicyCompliant(password)) {
    await fulfillJson(route, null, 'รหัสผ่านไม่เป็นไปตามกติกา', 400);
    return true;
  }
  if (isDuplicateEmail(email) || state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    await fulfillJson(route, null, 'อีเมลนี้ถูกใช้สมัครแล้ว', 409);
    return true;
  }

  // เก็บ user ใหม่ลง state ให้หน้า /admin เห็น (จำลอง persistence ของระบบจริง —
  // ข้อมูลยังคงอยู่เฉพาะภายในเทสต์นี้ เพราะ state ถูกสร้างใหม่ทุกเทสต์ ไม่มีผลต่อ DB จริง)
  touchMockUser(state, email, name);

  // จำตัวตนผู้ใช้ปัจจุบันไว้ให้ /api/auth/me ใช้
  const userNow = state.users.find((u) => u.email === email);
  state.currentUser = {
    name: (userNow?.name as string | undefined) || name || email.split('@')[0],
    email,
  };

  await fulfillJson(route, { user: { ...MOCK_USER, email }, token: MOCK_TOKEN }, 'สมัครสมาชิกสำเร็จ', 201);
  return true;
}

async function handleAuthApi(route: Route, state: MockState, path: string, method: string): Promise<boolean> {
  if (path === '/auth/login' && method === 'POST') return handleLogin(route, state);
  if (path === '/auth/register' && method === 'POST') return handleRegister(route, state);
  if (path === '/auth/me' && method === 'GET') {
    if (!isAuthed(route)) {
      await requireAuth(route);
      return true;
    }
    // คืนตัวตนของคนที่ล็อกอิน/สมัครล่าสุดใน state นี้ — ไม่ใช่ MOCK_USER ตายตัว
    await fulfillJson(route, {
      user: { ...MOCK_USER, name: state.currentUser.name, email: state.currentUser.email },
    }, 'ดึงข้อมูลผู้ใช้สำเร็จ');
    return true;
  }
  if (path === '/auth/logout' && method === 'POST') {
    await fulfillJson(route, null, 'ออกจากระบบสำเร็จ');
    return true;
  }
  return false;
}

/* ---------- Handlers: Resumes ---------- */

async function handleUploadResume(route: Route, state: MockState): Promise<boolean> {
  if (!isAuthed(route)) {
    await requireAuth(route);
    return true;
  }
  const raw = route.request().postDataBuffer()?.toString('latin1') ?? '';
  const contentLength = Number(route.request().headers()['content-length'] ?? 0);

  if (isUploadRejected(raw, contentLength)) {
    await fulfillJson(route, null, 'ไฟล์ไม่ถูกต้องหรือมีขนาดใหญ่เกินกำหนด (สูงสุด 5MB)', 400);
    return true;
  }
  // สะท้อนชื่อไฟล์จริงที่ผู้ใช้อัปโหลด (multipart Content-Disposition)
  // — ระบบจริงเก็บ originalName ตามไฟล์ของผู้ใช้ เช่น resume-Kanyarat-Patthanan.pdf
  const fileNameMatch = /filename="([^"]*)"/i.exec(raw);
  const originalName = fileNameMatch?.[1]?.trim() || MOCK_RESUME.originalName;
  const resume = {
    ...MOCK_RESUME,
    id: state.nextResumeId++,
    originalName,
    uploadedAt: new Date().toISOString(),
  };
  state.resumes.push(resume);
  await fulfillJson(route, { resume }, 'อัปโหลดสำเร็จ', 201);
  return true;
}

async function handleResumeApi(route: Route, state: MockState, path: string, method: string): Promise<boolean> {
  if (path === '/resumes/upload' && method === 'POST') return handleUploadResume(route, state);
  if (path === '/resumes' && method === 'GET') {
    if (!isAuthed(route)) {
      await requireAuth(route);
      return true;
    }
    // ประวัติการวิเคราะห์แนบมากับ response นี้ — GET /api/analyses ไม่มีจริงตามหลักฐาน
    await fulfillJson(route, { resumes: state.resumes, history: state.analyses.slice(0, 10) });
    return true;
  }
  return false;
}

/* ---------- Handlers: Analysis ----------
 * ข้อควรระวังตามหลักฐานจริง: GET /api/analyses (collection) "ไม่มีอยู่จริง"
 * บน learnace.tech — mock ต้องสะท้อนพฤติกรรม ENDPOINT_NOT_FOUND เหมือนกัน
 */

async function handleCreateAnalysis(route: Route, state: MockState, resumeId: number): Promise<boolean> {
  if (!isAuthed(route)) {
    await requireAuth(route);
    return true;
  }
  const body = parseBody(route);
  const jobDescriptionId = body.jobDescriptionId == null ? null : asString(body.jobDescriptionId);
  // ประวัติต้องโชว์ "ของคนนั้น กับไฟล์นั้น" — หา resume ที่เพิ่งอัปโหลดและตัวตนปัจจุบัน
  const resumeRow = state.resumes.find((r) => (r as { id: number }).id === resumeId);
  const resumeName =
    (resumeRow as { originalName?: string } | undefined)?.originalName ?? MOCK_RESUME.originalName;
  const jobRow = jobDescriptionId
    ? state.jobs.find((j) => String((j as { id: number }).id) === jobDescriptionId)
    : undefined;
  const jobTitle = jobDescriptionId
    ? ((jobRow as { title?: string } | undefined)?.title ?? jobDescriptionId)
    : '—';
  const analysis = {
    ...MOCK_ANALYSIS,
    id: state.nextAnalysisId++,
    resumeId,
    jobDescriptionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // ฟิลด์แสดงผลสำหรับตารางประวัติ (หน้า Dashboard และ /admin)
    userName: state.currentUser.name,
    userEmail: state.currentUser.email,
    resumeName,
    jobTitle,
    score: MOCK_ANALYSIS.overallScore,
  };
  state.analyses.unshift(analysis);
  await fulfillJson(route, { analysisRun: analysis, analysis }, 'วิเคราะห์สำเร็จ', 201);
  return true;
}

async function handleAnalysisApi(route: Route, state: MockState, path: string, method: string): Promise<boolean> {
  if (path === '/analyses' && method === 'GET') {
    await fulfillEnvelope(route, {
      success: false,
      message: `ไม่พบ API ${method} /api/analyses`,
      code: API_ENVELOPE_CODES.endpointNotFound,
    }, 404);
    return true;
  }

  const createMatch = /^\/resumes\/(\d+)\/analyses$/.exec(path);
  if (createMatch && method === 'POST') return handleCreateAnalysis(route, state, Number(createMatch[1]));

  const getMatch = /^\/analyses\/(\d+)$/.exec(path);
  if (getMatch && method === 'GET') {
    if (!isAuthed(route)) {
      await requireAuth(route);
      return true;
    }
    const id = Number(getMatch[1]);
    const found = state.analyses.find((item) => (item as { id: number }).id === id);
    await fulfillJson(route, { analysisRun: found ?? { ...MOCK_ANALYSIS, id } });
    return true;
  }
  return false;
}

/* ---------- Handlers: Jobs (Job Description CRUD) ---------- */

async function handleJobApi(route: Route, state: MockState, path: string, method: string): Promise<boolean> {
  if (path === '/jobs' && method === 'GET') {
    if (!isAuthed(route)) {
      await requireAuth(route);
      return true;
    }
    await fulfillJson(route, { jobs: state.jobs });
    return true;
  }
  if (path === '/jobs' && method === 'POST') {
    if (!isAuthed(route)) {
      await requireAuth(route);
      return true;
    }
    const body = parseBody(route);
    const title = asString(body.title).trim();
    if (!title) {
      await fulfillJson(route, null, 'กรุณาระบุชื่อตำแหน่งงาน', 400);
      return true;
    }
    const job = { id: state.nextJobId++, title, company: asString(body.company), createdAt: new Date().toISOString() };
    state.jobs.push(job);
    await fulfillJson(route, { job }, 'สร้างตำแหน่งงานสำเร็จ', 201);
    return true;
  }
  return false;
}

/* ---------- Handlers: Admin ---------- */

async function handleAdminApi(route: Route, state: MockState, path: string, method: string): Promise<boolean> {
  if (!path.startsWith('/admin') || method !== 'GET') return false;
  if (!isAuthed(route)) {
    await requireAuth(route);
    return true;
  }
  if (path === '/admin/users') {
    await fulfillJson(route, { users: state.users });
    return true;
  }
  await fulfillJson(route, MOCK_ADMIN_STATS, 'ดึงสถิติผู้ดูแลระบบสำเร็จ');
  return true;
}

/* ---------- Router ---------- */

/** ติดตั้ง route interception บน page (เรียกเองได้เมื่อต้องการควบคุมเอง) */
export async function installMockApi(page: Page): Promise<void> {
  if (process.env.MOCK_API === 'false') return;

  // state ในหน่วยความจำ — No DB Persistence Side-Effects
  const state = createMockState();

  await page.route('**/api/**', async (route) => {
    const path = pathnameOf(route);
    const method = route.request().method();

    const handled =
      (await handleAuthApi(route, state, path, method)) ||
      (await handleResumeApi(route, state, path, method)) ||
      (await handleAnalysisApi(route, state, path, method)) ||
      (await handleJobApi(route, state, path, method)) ||
      (await handleAdminApi(route, state, path, method));

    /* Fallback: ไม่ให้ SPA พังกับเส้นที่ mock ไม่รองรับ */
    if (!handled) {
      await fulfillJson(route, {}, 'OK (mock fallback)');
    }
  });
}

/* ---------- Extended fixtures ---------- */

type Fixtures = {
  mockApi: void;
  /** หน้าที่ล็อกอินแล้วผ่าน UI (ใช้ MOCK credentials เสมอเมื่ออยู่โหมด mock) */
  authedPage: Page;
};

/**
 * `test` สำหรับ E2E — ติดตั้ง mock API อัตโนมัติทุกเทสต์ (auto fixture)
 * `expect` และ fixture `authedPage` ใช้สำหรับ flow ที่ต้องยืนยันตัวตน
 */
export const test = base.extend<Fixtures>({
  mockApi: [
    async ({ page }, use) => {
      await installMockApi(page);
      await use();
      await page.unroute('**/api/**');
    },
    { auto: true },
  ],

  authedPage: async ({ page }, use) => {
    // ตัดสินใจที่ runtime ว่าจะล็อกอินด้วยบัญชีจริง (เมื่อปิด mock) หรือบัญชี mock
    const useMock = APP.mockApi;
    const email = useMock || !hasTestAccount() ? MOCK_CREDENTIALS.email : ENV.testEmail;
    const password = useMock || !hasTestAccount() ? MOCK_CREDENTIALS.password : ENV.testPassword;

    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
    await emailInput.fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page
      .locator('button[type="submit"], form button:has-text("เข้าสู่ระบบ")')
      .first()
      .click();

    await expect(page).toHaveURL(/\/dashboard/i, { timeout: 30_000 });
    await use(page);
  },
});

export { expect } from '@playwright/test';