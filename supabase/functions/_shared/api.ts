import { corsHeaders, jsonResponse } from './cors.ts';
import { serviceClient, userClient } from './supabase.ts';

export class ApiError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export type JsonRecord = Record<string, unknown>;
export async function readBody(req: Request, maxBytes = 8192): Promise<JsonRecord> {
  if (req.method !== 'POST') throw new ApiError('METHOD_NOT_ALLOWED', 'Gunakan POST.', 405);
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError('INVALID_BODY', 'Permintaan kosong.');
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new ApiError('BODY_TOO_LARGE', 'Permintaan terlalu besar.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new ApiError('INVALID_BODY', 'Format permintaan tidak valid.'); }
}
export function textField(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new ApiError('INVALID_INPUT', `${label} tidak valid.`);
  }
  return value.trim();
}
export function emailField(value: unknown): string {
  const email = textField(value, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError('INVALID_EMAIL', 'Email tidak valid.');
  return email;
}
export async function hash(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
export async function requireAdmin(req: Request) {
  const { data: { user }, error } = await userClient(req).auth.getUser();
  if (error || !user) throw new ApiError('UNAUTHORIZED', 'Silakan login.', 401);
  const { data: profile, error: profileError } = await serviceClient().from('profiles').select('role').eq('id', user.id).single();
  if (profileError || profile?.role !== 'admin') throw new ApiError('ADMIN_REQUIRED', 'Akses admin diperlukan.', 403);
  return user;
}
const dbMessages: Record<string, string> = {
  FAMILY_FULL: 'Family sudah penuh.', DUPLICATE_PENDING: 'Sudah ada pesanan pending untuk email dan produk ini.',
  PRODUCT_UNAVAILABLE: 'Produk tidak tersedia.', PRICE_UNAVAILABLE: 'Harga belum tersedia.',
  ORDERS_DISABLED: 'Pemesanan belum diaktifkan.', INVALID_OAUTH_STATE: 'Sesi koneksi tidak valid atau kedaluwarsa.',
  FAMILY_NOT_FOUND: 'Family tidak ditemukan.', ORDER_NOT_FOUND: 'Pesanan tidak ditemukan.',
  APPROVED_ORDER_REQUIRED: 'Kode hanya tersedia setelah pesanan disetujui.',
};
export function checkDb(error: { message?: string; code?: string } | null) {
  if (!error) return;
  const code = error.message && Object.keys(dbMessages).find(k => error.message!.includes(k));
  if (code) throw new ApiError(code, dbMessages[code], 409);
  if (error.code === '23505') throw new ApiError('DUPLICATE', 'Data tersebut sudah ada.', 409);
  throw new ApiError('DATABASE_ERROR', 'Data tidak dapat disimpan. Coba lagi.', 500);
}
export async function rateLimit(bucket: string, limit: number, seconds: number) {
  const { data, error } = await serviceClient().rpc('app_consume_rate', { p_bucket: bucket, p_limit: limit, p_seconds: seconds });
  checkDb(error);
  if (data !== true) throw new ApiError('RATE_LIMITED', 'Terlalu banyak permintaan. Coba lagi nanti.', 429);
}
export function endpoint(handler: (req: Request) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    const cors = corsHeaders(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try { return jsonResponse({ success: true, data: await handler(req) }, 200, cors); }
    catch (error) {
      const known = error instanceof ApiError;
      // Never log payloads, ciphertext, provider responses, or credential values.
      console.error('request_failed', known ? error.code : 'INTERNAL_ERROR');
      return jsonResponse({ success: false, code: known ? error.code : 'INTERNAL_ERROR', error: known ? error.message : 'Permintaan gagal. Coba lagi.' }, known ? error.status : 500, cors);
    }
  };
}
