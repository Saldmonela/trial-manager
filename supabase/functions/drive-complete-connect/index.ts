import { ApiError, checkDb, endpoint, hash, readBody, resolveDriveActor, textField } from '../_shared/api.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { DRIVE_SCOPES, exchangeCode, getDriveQuota, getUserInfo } from '../_shared/google.ts';
import { encrypt } from '../_shared/crypto.ts';
import { expireFamiliesForLowStorage } from '../_shared/low-storage.ts';
Deno.serve(endpoint(async req => {
  const body = await readBody(req);
  const actor = await resolveDriveActor(req, body);
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

  // Jika email belum terhubung ke family aktif mana pun (baik sebagai owner maupun member),
  // otomatis buat family baru dengan password kosong (diisi manual oleh admin nanti).
  let createdFamily: { id: string; name: string } | null = null;
  const normalizedEmail = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
  if (normalizedEmail) {
    const { data: existingFamilies, error: famFetchError } = await svc
      .from('families')
      .select('id,name,owner_email,members(email)')
      .is('archived_at', null);
    checkDb(famFetchError);

    const rows = (existingFamilies ?? []) as Array<{
      id: string;
      name: string | null;
      owner_email: string | null;
      members?: Array<{ email?: string | null }> | null;
    }>;

    const alreadyLinked = rows.some((f) => {
      if (typeof f.owner_email === 'string' && f.owner_email.trim().toLowerCase() === normalizedEmail) {
        return true;
      }
      return (f.members ?? []).some(
        (m) => typeof m?.email === 'string' && m.email.trim().toLowerCase() === normalizedEmail,
      );
    });

    if (!alreadyLinked) {
      let maxNum = 0;
      for (const f of rows) {
        const match = typeof f.name === 'string' ? f.name.trim().match(/^Family\s+(\d+)$/i) : null;
        if (match) {
          const num = Number(match[1]);
          if (Number.isFinite(num) && num > maxNum) maxNum = num;
        }
      }
      const nextName = `Family ${maxNum + 1}`;
      const newFamilyId = crypto.randomUUID();
      const { error: createFamilyError } = await svc.from('families').insert({
        id: newFamilyId,
        user_id: actor.id,
        name: nextName,
        owner_email: normalizedEmail,
        owner_password: null,
        owner_password_v1: null,
        expiry_date: null,
        storage_used: 0,
        notes: '',
        product_type: 'slot',
        currency: 'IDR',
        is_banned: false,
        is_public: true,
        is_active: true,
      });
      checkDb(createFamilyError);

      await svc.from('app_audit_log').insert({
        actor_id: actor.id,
        object_type: 'family',
        object_id: newFamilyId,
        action: 'auto_created_from_drive',
        details: { email: normalizedEmail, name: nextName },
      });

      createdFamily = { id: newFamilyId, name: nextName };
    }
  }

  const detection = await expireFamiliesForLowStorage(svc, {
    actorId: actor.id,
    email: profile.email ?? null,
    totalBytes: quota.total_bytes,
  });
  return {
    id: data.id,
    email: profile.email ?? null,
    displayName: profile.name ?? null,
    totalBytes: quota.total_bytes,
    usedBytes: quota.used_bytes,
    createdFamily,
    lowStorageTier: detection.lowStorageTier,
    expiredFamilies: detection.expiredFamilies,
  };
}));
