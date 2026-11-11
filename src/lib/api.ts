import { supabase } from '../supabaseClient';
import type { ActionResult } from '../types';

// Edge Functions are the only path for credential and Drive operations. There is
// deliberately no direct-database fallback: if a function is unreachable the caller
// gets an error, never client-side encryption or raw ciphertext.
export async function invokeApi<T = unknown>(name: string, body: object): Promise<ActionResult<T>> {
  const client = supabase;
  if (!client) return { success: false, code: 'NOT_CONFIGURED', error: 'Supabase belum dikonfigurasi.' };
  try {
    const { data, error } = await client.functions.invoke(name, { body });
    if (error) {
      if (error.context instanceof Response) {
        const result = await error.context.json().catch(() => null);
        if (result?.success === false) return result;
        if (typeof result?.error === 'string') return { success: false, code: 'REQUEST_FAILED', error: result.error };
      }
      return { success: false, code: 'REQUEST_FAILED', error: 'Permintaan gagal. Coba lagi.' };
    }
    if (!data || typeof data !== 'object') return { success: false, code: 'INVALID_RESPONSE', error: 'Respons server tidak valid.' };
    if (typeof data.success === 'boolean') return data as ActionResult<T>;
    return { success: true, data: data as T };
  } catch {
    return { success: false, code: 'NETWORK_ERROR', error: 'Koneksi gagal. Coba lagi.' };
  }
}
export async function revealFamilyPassword(familyId: string) {
  return invokeApi<{ password: string }>('reveal-family-password', { familyId });
}
export function dbFailure(error: { message?: string; code?: string } | null, affected?: unknown[] | null): ActionResult {
  if (error) return { success: false, code: error.code, error: error.message || 'Penyimpanan gagal.' };
  if (affected !== undefined && affected?.length !== 1) return { success: false, code: 'NO_ROWS_CHANGED', error: 'Data tidak berubah. Muat ulang dan coba lagi.' };
  return { success: true };
}
