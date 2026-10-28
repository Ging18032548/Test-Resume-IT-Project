import type { APIRequestContext, APIResponse } from '@playwright/test';
import { expect } from '@playwright/test';
import { API_ENVELOPE_CODES } from '../config/config';

/**
 * ApiHelper — ตัวช่วยยิง API จริง (ไม่ผ่าน page.route) พร้อม assertion มาตรฐาน
 *
 * ใช้กับ tests/api/api-validation.spec.ts เพื่อ:
 *  - ตรวจ HTTP status code
 *  - ตรวจ JSON envelope: { success, message, code }
 *  - ตรวจการป้องกัน endpoint ที่ต้องยืนยันตัวตน (TOKEN_REQUIRED)
 *
 * ข้อจำกัดที่รายงานตรงไปตรงมา: การโพรบจาก sandbox ผ่าน WebFetch ได้พิสูจน์
 * พฤติกรรม GET ของเว็บจริงไว้แล้ว — assertion ในชุดนี้จึงตรงกับหลักฐาน
 * และเมื่อรันบนเครื่องผู้ใช้ (BASE_URL=learnace.tech) จะไปยืนยันซ้ำกับระบบจริง
 */

export interface Envelope {
  success: boolean;
  message: string;
  code?: string;
  data?: unknown;
}

export class ApiHelper {
  constructor(private readonly request: APIRequestContext) {}

  async get(path: string, token?: string): Promise<APIResponse> {
    return this.request.get(path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      failOnStatusCode: false,
    });
  }

  async post(path: string, data?: unknown, token?: string): Promise<APIResponse> {
    return this.request.post(path, {
      data,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      failOnStatusCode: false,
    });
  }

  /** อ่าน body เป็น JSON envelope — ถ้าไม่ใช่ JSON จะ throw พร้อมข้อความชัดเจน */
  async readEnvelope(response: APIResponse): Promise<Envelope> {
    const text = await response.text();
    try {
      return JSON.parse(text) as Envelope;
    } catch {
      throw new Error(
        `Response ไม่ใช่ JSON (status ${response.status()}): ${text.slice(0, 200)}`
      );
    }
  }

  /** ยืนยัน envelope แบบ TOKEN_REQUIRED ตามหลักฐานจริงของระบบ */
  async expectTokenRequired(response: APIResponse): Promise<Envelope> {
    expect(
      response.status(),
      'Endpoint ที่ต้องยืนยันตัวตนต้องคืน 401 เมื่อไม่มีโทเคน'
    ).toBe(401);

    const body = await this.readEnvelope(response);
    expect(body.success, 'envelope.success ต้องเป็น false').toBe(false);
    expect(body.code, 'envelope.code ต้องเป็น TOKEN_REQUIRED').toBe(
      API_ENVELOPE_CODES.tokenRequired
    );
    expect(body.message).toContain('เข้าสู่ระบบ');
    return body;
  }

  /** ยืนยัน envelope แบบ ENDPOINT_NOT_FOUND (เส้นที่ยืนยันแล้วว่าไม่มีอยู่จริง) */
  async expectEndpointNotFound(response: APIResponse, expectedPath: string): Promise<Envelope> {
    expect(response.status(), 'เส้นที่ไม่มีอยู่ต้องคืน 404').toBe(404);

    const body = await this.readEnvelope(response);
    expect(body.success).toBe(false);
    expect(body.code).toBe(API_ENVELOPE_CODES.endpointNotFound);
    expect(body.message).toContain(expectedPath);
    return body;
  }
}
