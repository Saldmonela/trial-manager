import { ApiError, checkDb, endpoint, hash, rateLimit, readBody, requireAdmin, textField } from '../_shared/api.ts';
import { redirectTarget } from '../_shared/origins.ts';
import { buildConsentUrl } from '../_shared/google.ts';
import { serviceClient } from '../_shared/supabase.ts';
Deno.serve(endpoint(async req => {
  const user = await requireAdmin(req); const body = await readBody(req);
  const nonce = textField(body.browserNonce, 'Sesi browser', 128);
  if (!/^[a-f0-9]{64}$/.test(nonce)) throw new ApiError('INVALID_NONCE', 'Sesi browser tidak valid.');
  let target: string;
  try { target = redirectTarget(textField(body.origin, 'Origin', 300), textField(body.redirectTo ?? '/storage', 'Tujuan', 32)); }
  catch { throw new ApiError('INVALID_REDIRECT', 'Tujuan koneksi tidak diizinkan.'); }
  await rateLimit('drive-connect:' + user.id, 10, 600);
  const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  const svc = serviceClient();
  const { error } = await svc.from('oauth_states').insert({ state, user_id: user.id, provider: 'google_drive', redirect_to: target, browser_nonce_hash: await hash(nonce) });
  checkDb(error);
  const { error: cleanError } = await svc.from('oauth_states').delete().lt('expires_at', new Date(Date.now() - 86400000).toISOString());
  checkDb(cleanError);
  return { state, url: buildConsentUrl(state, typeof body.loginHint === 'string' ? body.loginHint : undefined) };
}));
