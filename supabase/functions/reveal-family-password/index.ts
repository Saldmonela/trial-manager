import { ApiError, checkDb, endpoint, readBody, requireAdmin, textField } from '../_shared/api.ts';
import { decryptCredential, decryptLegacy } from '../_shared/credentials.ts';
import { serviceClient } from '../_shared/supabase.ts';

Deno.serve(endpoint(async req => {
  const actor = await requireAdmin(req); const body = await readBody(req);
  const id = textField(body.familyId, 'Family', 128);
  const { data, error } = await serviceClient().from('families').select('id,user_id,owner_password,owner_password_v1').eq('id', id).is('archived_at', null).single();
  checkDb(error); if (!data) throw new ApiError('FAMILY_NOT_FOUND', 'Family tidak ditemukan.', 404);
  if (!data.owner_password_v1 && !data.owner_password) throw new ApiError('MISSING_CREDENTIAL', 'Password belum tersedia.', 409);
  const password = data.owner_password_v1 ? await decryptCredential(data.owner_password_v1, id) : await decryptLegacy(data.owner_password, data.user_id);
  const { error: auditError } = await serviceClient().from('app_audit_log').insert({ actor_id: actor.id, object_type: 'family', object_id: id, action: 'credential_revealed' });
  checkDb(auditError); return { password };
}));
