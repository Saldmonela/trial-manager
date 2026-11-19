import { ApiError, checkDb, endpoint, hash, readBody, requireAdmin, textField } from '../_shared/api.ts';
import { serviceClient } from '../_shared/supabase.ts';

const SETTING_KEY = 'drive_connect_pin';

type PinSettingValue = {
  hash?: string;
  salt?: string;
  owner_user_id?: string;
  updated_at?: string;
};

Deno.serve(endpoint(async req => {
  const admin = await requireAdmin(req);
  const body = await readBody(req);
  const action = textField(body.action ?? 'status', 'Aksi', 16);
  const svc = serviceClient();
  const envConfigured = Boolean(Deno.env.get('DRIVE_CONNECT_PIN')?.trim());

  if (action === 'status') {
    const { data, error } = await svc
      .from('settings')
      .select('value,updated_at')
      .eq('key', SETTING_KEY)
      .maybeSingle();
    checkDb(error);
    const val = (data?.value ?? null) as PinSettingValue | null;
    if (val?.hash && val?.salt) {
      return { configured: true, source: 'db', updatedAt: val.updated_at ?? data?.updated_at ?? null };
    }
    if (envConfigured) {
      return { configured: true, source: 'env', updatedAt: null };
    }
    return { configured: false, source: 'none', updatedAt: null };
  }

  if (action === 'set') {
    const pin = textField(body.pin, 'PIN', 64);
    if (pin.length < 4) {
      throw new ApiError('PIN_TOO_SHORT', 'PIN minimal 4 karakter.', 400);
    }
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    const pinHash = await hash(`${salt}:${pin}`);
    const now = new Date().toISOString();
    const { error } = await svc.from('settings').upsert({
      key: SETTING_KEY,
      value: { hash: pinHash, salt, owner_user_id: admin.id, updated_at: now },
      updated_at: now,
    }, { onConflict: 'key' });
    checkDb(error);
    await svc.from('app_audit_log').insert({
      actor_id: admin.id,
      object_type: 'settings',
      object_id: SETTING_KEY,
      action: 'updated',
    });
    return { configured: true, source: 'db', updatedAt: now };
  }

  if (action === 'clear') {
    const { error } = await svc.from('settings').delete().eq('key', SETTING_KEY);
    checkDb(error);
    await svc.from('app_audit_log').insert({
      actor_id: admin.id,
      object_type: 'settings',
      object_id: SETTING_KEY,
      action: 'cleared',
    });
    return { configured: envConfigured, source: envConfigured ? 'env' : 'none', updatedAt: null };
  }

  throw new ApiError('INVALID_ACTION', 'Aksi tidak dikenali.', 400);
}));
