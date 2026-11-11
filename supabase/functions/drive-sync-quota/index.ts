import { ApiError, checkDb, endpoint, readBody, requireAdmin } from '../_shared/api.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { getDriveQuota, refreshAccessToken } from '../_shared/google.ts';
import { GoogleError } from '../_shared/drive-errors.ts';
import { encrypt, decrypt } from '../_shared/crypto.ts';
Deno.serve(endpoint(async req => {
  const actor = await requireAdmin(req); const body = await readBody(req); const svc = serviceClient();
  let query = svc.from('connected_accounts').select('id,access_token_encrypted,refresh_token_encrypted,token_expires_at').eq('user_id', actor.id).eq('provider', 'google_drive').eq('status', 'connected');
  if (body.all !== true) {
    if (typeof body.accountId !== 'string') throw new ApiError('INVALID_INPUT', 'Pilih akun.');
    query = query.eq('id', body.accountId);
  }
  const { data: accounts, error } = await query; checkDb(error);
  if (!accounts?.length) throw new ApiError('ACCOUNT_NOT_FOUND', 'Akun tidak ditemukan.', 404);
  const results = [];
  for (const account of accounts) {
    try {
      const save = async (values: Record<string, unknown>) => {
        const { data, error: writeError } = await svc.from('connected_accounts').update(values).eq('id', account.id).eq('user_id', actor.id).select('id').single();
        checkDb(writeError); if (!data) throw new ApiError('SAVE_FAILED', 'Hasil sinkronisasi tidak tersimpan.', 500);
      };
      const refresh = async () => {
        if (!account.refresh_token_encrypted) throw new ApiError('RECONNECT_REQUIRED', 'Hubungkan ulang akun.', 409);
        try {
          const refreshed = await refreshAccessToken(await decrypt(account.refresh_token_encrypted));
          await save({ access_token_encrypted: await encrypt(refreshed.access_token), token_expires_at: new Date(Date.now() + Number(refreshed.expires_in ?? 3600) * 1000).toISOString() });
          return refreshed.access_token;
        } catch (failure) {
          if (failure instanceof GoogleError && failure.revoked) { await save({ status: 'disconnected' }); throw new ApiError('RECONNECT_REQUIRED', 'Izin Google dicabut; hubungkan ulang.', 409); }
          throw failure;
        }
      };
      let refreshed = false;
      let token = account.access_token_encrypted && Date.parse(account.token_expires_at ?? '') > Date.now() + 60000 ? await decrypt(account.access_token_encrypted) : (refreshed = true, await refresh());
      let quota;
      try { quota = await getDriveQuota(token); }
      catch (failure) {
        if (!(failure instanceof GoogleError) || failure.status !== 401 || refreshed) throw failure;
        token = await refresh(); quota = await getDriveQuota(token);
      }
      await save({ ...quota, last_synced_at: new Date().toISOString() }); results.push({ id: account.id, ok: true });
    } catch (failure) {
      results.push({ id: account.id, ok: false, code: failure instanceof ApiError ? failure.code : 'SYNC_UNAVAILABLE', error: failure instanceof ApiError ? failure.message : 'Google sedang tidak tersedia. Coba lagi.' });
    }
  }
  return { results };
}));
