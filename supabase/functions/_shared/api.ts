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
async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([hash(a), hash(b)]);
  let diff = ha.length ^ hb.length;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}
export async function requireAdmin(req: Request) {
  const { data: { user }, error } = await userClient(req).auth.getUser();
  if (error || !user) throw new ApiError('UNAUTHORIZED', 'Silakan login.', 401);
  const { data: profile, error: profileError } = await serviceClient().from('profiles').select('role').eq('id', user.id).single();
  if (profileError || profile?.role !== 'admin') throw new ApiError('ADMIN_REQUIRED', 'Akses admin diperlukan.', 403);
  return user;
}
/**
 * Mengizinkan akses Drive Connect via dua jalur:
 * 1. Sesi admin Supabase yang sudah login (jalur /admin dan /storage), ATAU
 * 2. PIN rahasia (`DRIVE_CONNECT_PIN`) untuk koneksi langsung tanpa login admin (jalur /connect).
 */
export async function resolveDriveActor(req: Request, body: JsonRecord): Promise<{ id: string; via: 'admin' | 'pin' }> {
  const svc = serviceClient();
  const { data: { user } } = await userClient(req).auth.getUser();
  if (user) {
    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role === 'admin') return { id: user.id, via: 'admin' };
  }

  const passcode = typeof body.passcode === 'string' ? body.passcode.trim() : '';
  if (!passcode) {
    if (user) throw new ApiError('ADMIN_REQUIRED', 'Akses admin diperlukan.', 403);
    throw new ApiError('UNAUTHORIZED', 'Silakan login admin atau masukkan PIN koneksi.', 401);
  }
  if (passcode.length > 128) throw new ApiError('INVALID_PIN', 'PIN tidak valid.', 400);

  const clientIp = req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  await rateLimit('drive-pin:' + await hash(clientIp), 10, 600);

  let preferredOwnerId = Deno.env.get('DRIVE_OWNER_USER_ID')?.trim() || '';
  const { data: pinSetting, error: pinSettingError } = await svc
    .from('settings')
    .select('value')
    .eq('key', 'drive_connect_pin')
    .maybeSingle();
  checkDb(pinSettingError);

  const dbPin = pinSetting?.value as { hash?: string; salt?: string; owner_user_id?: string } | null;
  if (dbPin?.hash && dbPin?.salt) {
    const candidateHash = await hash(`${dbPin.salt}:${passcode}`);
    if (!await constantTimeEqual(candidateHash, dbPin.hash)) {
      throw new ApiError('INVALID_PIN', 'PIN salah. Coba lagi.', 401);
    }
    if (typeof dbPin.owner_user_id === 'string' && dbPin.owner_user_id.trim()) {
      preferredOwnerId = dbPin.owner_user_id.trim();
    }
  } else {
    const expectedPin = Deno.env.get('DRIVE_CONNECT_PIN')?.trim();
    if (!expectedPin) {
      throw new ApiError('PIN_NOT_CONFIGURED', 'PIN koneksi langsung belum diatur. Atur di /admin → Settings.', 503);
    }
    if (!await constantTimeEqual(passcode, expectedPin)) {
      throw new ApiError('INVALID_PIN', 'PIN salah. Coba lagi.', 401);
    }
  }

  if (preferredOwnerId) {
    const { data: owner, error: ownerError } = await svc
      .from('profiles')
      .select('id')
      .eq('id', preferredOwnerId)
      .eq('role', 'admin')
      .maybeSingle();
    checkDb(ownerError);
    if (owner) return { id: owner.id, via: 'pin' };
  }

  const { data: owner, error: ownerError } = await svc
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  checkDb(ownerError);
  if (!owner) throw new ApiError('ADMIN_NOT_FOUND', 'Akun admin pemilik tidak ditemukan.', 500);
  return { id: owner.id, via: 'pin' };
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
