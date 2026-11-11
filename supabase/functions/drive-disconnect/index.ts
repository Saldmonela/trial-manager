import { ApiError, checkDb, endpoint, readBody, requireAdmin, textField } from '../_shared/api.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { decrypt } from '../_shared/crypto.ts';
Deno.serve(endpoint(async req => {
  const actor = await requireAdmin(req); const body = await readBody(req); const id = textField(body.accountId, 'Akun', 128); const svc = serviceClient();
  const { data, error } = await svc.from('connected_accounts').select('access_token_encrypted,refresh_token_encrypted').eq('id', id).eq('user_id', actor.id).single(); checkDb(error);
  if (!data) throw new ApiError('ACCOUNT_NOT_FOUND', 'Akun tidak ditemukan.', 404);
  const encrypted = data.refresh_token_encrypted ?? data.access_token_encrypted;
  if (encrypted) {
    const response = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: await decrypt(encrypted) }) });
    const detail = await response.json().catch(() => ({}));
    if (!response.ok && !(response.status === 400 && detail.error === 'invalid_token')) throw new ApiError('REVOCATION_FAILED', 'Izin Google belum dapat dicabut. Coba lagi.', 503);
  }
  const { data: deleted, error: deleteError } = await svc.from('connected_accounts').delete().eq('id', id).eq('user_id', actor.id).select('id').single(); checkDb(deleteError);
  if (!deleted) throw new ApiError('DELETE_FAILED', 'Koneksi belum dihapus.', 500);
  return { id };
}));
