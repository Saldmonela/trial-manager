import { ApiError, checkDb, endpoint, hash, readBody, requireAdmin, textField } from '../_shared/api.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { DRIVE_SCOPES, exchangeCode, getDriveQuota, getUserInfo } from '../_shared/google.ts';
import { encrypt } from '../_shared/crypto.ts';
Deno.serve(endpoint(async req => {
  const actor = await requireAdmin(req); const body = await readBody(req);
  const state = textField(body.state, 'Sesi', 128); const nonce = textField(body.browserNonce, 'Browser', 128); const code = textField(body.code, 'Code', 2048);
  const svc = serviceClient();
  const { error } = await svc.rpc('app_consume_oauth_state', { p_state: state, p_actor: actor.id, p_nonce_hash: await hash(nonce) }); checkDb(error);
  const tokens = await exchangeCode(code); const scopes = (tokens.scope ?? '').split(' ').filter(Boolean);
  if (!scopes.includes(DRIVE_SCOPES[3])) throw new ApiError('INSUFFICIENT_SCOPE', 'Izin membaca kuota belum diberikan.', 403);
  const [profile, quota] = await Promise.all([getUserInfo(tokens.access_token), getDriveQuota(tokens.access_token)]);
  const { data: previous, error: previousError } = await svc.from('connected_accounts').select('refresh_token_encrypted').eq('user_id', actor.id).eq('provider', 'google_drive').eq('provider_account_id', profile.sub).maybeSingle(); checkDb(previousError);
  if (!tokens.refresh_token && !previous?.refresh_token_encrypted) throw new ApiError('RECONNECT_REQUIRED', 'Google tidak mengirim akses offline; ulangi koneksi.', 409);
  const { data, error: saveError } = await svc.from('connected_accounts').upsert({
    user_id: actor.id, provider: 'google_drive', provider_account_id: profile.sub, email: profile.email ?? null,
    display_name: profile.name ?? null, avatar_url: profile.picture ?? null, access_token_encrypted: await encrypt(tokens.access_token),
    refresh_token_encrypted: tokens.refresh_token ? await encrypt(tokens.refresh_token) : previous!.refresh_token_encrypted,
    token_expires_at: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString(),
    scopes, status: 'connected', ...quota, last_synced_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider,provider_account_id' }).select('id').single();
  checkDb(saveError); if (!data) throw new ApiError('SAVE_FAILED', 'Koneksi tidak tersimpan.', 500);
  return { id: data.id };
}));
