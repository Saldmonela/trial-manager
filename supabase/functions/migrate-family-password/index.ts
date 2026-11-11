import { ApiError, checkDb, endpoint, readBody, requireAdmin, textField } from '../_shared/api.ts';
import { decryptCredential, decryptLegacy, encryptCredential } from '../_shared/credentials.ts';
import { serviceClient } from '../_shared/supabase.ts';
Deno.serve(endpoint(async req => {
  const actor=await requireAdmin(req);const body=await readBody(req);const id=textField(body.familyId,'Family',128);const svc=serviceClient();
  const {data,error}=await svc.from('families').select('user_id,owner_password,owner_password_v1').eq('id',id).is('archived_at',null).single();checkDb(error);
  if(!data)throw new ApiError('FAMILY_NOT_FOUND','Family tidak ditemukan.',404);
  if(data.owner_password_v1?.startsWith('v1:'))return {migrated:false,version:'v1'};
  const plaintext=await decryptLegacy(data.owner_password||'',data.user_id);
  if(body.dryRun===true)return {recoverable:true};
  const ciphertext=await encryptCredential(plaintext,id);
  if(await decryptCredential(ciphertext,id)!==plaintext)throw new ApiError('VERIFICATION_FAILED','Verifikasi enkripsi gagal.',500);
  const {error:saveError}=await svc.rpc('app_migrate_credential',{p_actor:actor.id,p_id:id,p_expected_legacy:data.owner_password,p_ciphertext:ciphertext});checkDb(saveError);
  return {migrated:true,version:'v1'};
}));
