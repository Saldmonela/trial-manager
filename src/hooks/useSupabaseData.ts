import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { dbFailure, invokeApi } from '../lib/api';
import type {
  ActionResult,
  AddMemberOptions,
  Family,
  FamilyInput,
  FamilyPlanStatus,
  Member,
  RemoveMemberOptions,
  UseSupabaseDataReturn,
} from '../types';

function mapFamily(row: Record<string, any>): Family {
  const safe = Object.fromEntries(Object.entries(row).filter(([key]) => !['owner_password','owner_password_v1','ownerPassword'].includes(key)));
  return { ...safe, id: row.id, name: row.name || '', ownerEmail: row.owner_email, expiryDate: row.expiry_date, storageUsed: Number(row.storage_used) || 0,
    createdAt: row.created_at, priceMonthly: Number(row.price_monthly) || 0, priceAnnual: Number(row.price_annual) || 0,
    priceSale: Number(row.price_sale) || 0, productType: row.product_type || 'slot', isBanned: !!row.is_banned, isPublic: row.is_public, isActive: row.is_active, soldAt: row.sold_at,
    planStatus: row.plan_status === 'downgraded_free' ? 'downgraded_free' : 'pro_active',
    downgradedAt: row.downgraded_at ?? null,
    downgradeNote: row.downgrade_note ?? null,
    credentialStatus: row.credential_status, credentialVersion: row.credential_version, members: (row.members || []).map((m: Member) => ({ ...m, addedAt: m.added_at, storageUsed: Number(m.storage_used) || 0, memberType: m.member_type, expiryDate: m.expiry_date })) };
}

function isRpcMissing(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = err.message || '';
  return err.code === '42883' || err.code === 'PGRST202' || msg.includes('Could not find the function');
}

function mapMemberRpcError(err: { code?: string; message?: string } | null, fallback: string): string {
  const msg = err?.message || '';
  if (msg.includes('ALREADY_IN_FAMILY')) return 'Akun ini sudah tercatat aktif di Family tersebut.';
  if (msg.includes('FAMILY_FULL')) return 'Slot anggota Family sudah penuh (maksimal 5 member).';
  if (msg.includes('FAMILY_NOT_FOUND')) return 'Data Family tidak ditemukan atau sudah diarsipkan.';
  if (msg.includes('MEMBER_NOT_FOUND')) return 'Data anggota sudah berubah atau dihapus di sesi lain.';
  if (msg.includes('ADMIN_REQUIRED') || msg.includes('UNAUTHORIZED')) {
    return 'Sesi login kamu sudah berakhir. Silakan masuk ulang untuk melanjutkan.';
  }
  return msg || fallback;
}
export function useSupabaseData(): UseSupabaseDataReturn {
  const [families, setFamilies] = useState<Family[]>([]); const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const refetch = useCallback(async () => {
    const id = ++sequence.current; setRefreshing(true); setError(null);
    try {
      if (!supabase) throw new Error();
      const result = await supabase.rpc('app_admin_families');
      if (result.error || !Array.isArray(result.data)) throw new Error();
      if (id === sequence.current) setFamilies(result.data.map(mapFamily));
    } catch { if (id === sequence.current) setError('Data admin tidak dapat dimuat. Coba lagi.'); }
    finally { if (id === sequence.current) { setLoading(false); setRefreshing(false); } }
  }, []);
  useEffect(() => {
    void refetch();
    const refresh = () => { if (document.visibilityState === 'visible') void refetch(); };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    // Credentials are not in Realtime publications; metadata refresh preserves forms.
    const timer = window.setInterval(refresh, 15000);
    const invalidate = () => { sequence.current++; }; return () => { invalidate(); clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [refetch]);
  async function saveFamily(family: FamilyInput, operation: 'create' | 'update'): Promise<ActionResult> {
    const result = await invokeApi('save-family', { ...family, operation });
    if (result.success) await refetch();
    return result;
  }
  async function rpcAction(name: string, params: object): Promise<ActionResult> {
    if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };
    try { const { error: requestError } = await supabase.rpc(name, params); const result = dbFailure(requestError); if (result.success) await refetch(); return result; }
    catch { return { success: false, error: 'Perubahan gagal. Coba lagi.' }; }
  }
  async function addMember(
    familyId: string,
    member: Omit<Member, 'family_id'>,
    options?: AddMemberOptions,
  ): Promise<ActionResult> {
    if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };
    const { id, name, email } = member;
    const memberType = member.memberType || member.member_type || 'pembeli';
    const expiryDate = memberType === 'pribadi' ? null : (member.expiryDate || member.expiry_date || null);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('add_personal_member_with_history', {
        p_family_id: familyId,
        p_member_id: id,
        p_name: name || '',
        p_email: email,
        p_storage_used: member.storageUsed ?? member.storage_used ?? 0,
        p_member_type: memberType,
        p_expiry_date: expiryDate,
        p_override_reason_type: options?.overrideReasonType ?? null,
        p_override_note: options?.overrideNote ?? null,
      });
      if (!rpcError && rpcData && typeof rpcData === 'object' && !Array.isArray(rpcData) && 'member_id' in rpcData) {
        await refetch();
        return { success: true, data: rpcData };
      }
      if (rpcError && !isRpcMissing(rpcError)) {
        return { success: false, code: rpcError.code, error: mapMemberRpcError(rpcError, 'Member tidak dapat ditambahkan.') };
      }
      // Fallback bila migrasi SQL 202611200001 belum dijalankan
      const { data, error: insertError } = await supabase.from('members').insert({ id, family_id: familyId, name, email, added_at: member.addedAt || new Date().toISOString(), storage_used: member.storageUsed ?? 0, member_type: memberType, expiry_date: expiryDate }).select('id');
      const result = dbFailure(insertError, data); if (result.success) await refetch(); return result;
    } catch { return { success: false, error: 'Koneksi terputus. Perubahan belum tersimpan, silakan coba lagi.' }; }
  }
  async function removeMember(
    familyId: string,
    memberId: string,
    options?: RemoveMemberOptions,
  ): Promise<ActionResult> {
    if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('remove_personal_member_with_history', {
        p_family_id: familyId,
        p_member_id: memberId,
        p_removal_mode: options?.removalMode || 'google_leave',
        p_leave_reason: options?.leaveReason ?? null,
        p_override_reason_type: options?.overrideReasonType ?? null,
        p_override_note: options?.overrideNote ?? null,
      });
      if (!rpcError && rpcData && typeof rpcData === 'object' && !Array.isArray(rpcData) && 'removed_member_id' in rpcData) {
        await refetch();
        return { success: true, data: rpcData };
      }
      if (rpcError && !isRpcMissing(rpcError)) {
        return { success: false, code: rpcError.code, error: mapMemberRpcError(rpcError, 'Member tidak dapat dihapus.') };
      }
      // Fallback bila migrasi SQL 202611200001 belum dijalankan
      const { data, error: removeError } = await supabase.from('members').delete().eq('id', memberId).select('id');
      const result = dbFailure(removeError, data); if (result.success) await refetch(); return result;
    } catch { return { success: false, error: 'Koneksi terputus. Perubahan belum tersimpan, silakan coba lagi.' }; }
  }
  async function setFamilyPlanStatus(
    familyId: string,
    planStatus: FamilyPlanStatus,
    downgradeNote?: string | null,
  ): Promise<ActionResult> {
    if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };
    try {
      const { data, error: rpcError } = await supabase.rpc('set_family_plan_status', {
        p_family_id: familyId,
        p_plan_status: planStatus,
        p_downgrade_note: downgradeNote ?? null,
      });
      if (rpcError) {
        if (isRpcMissing(rpcError)) {
          return {
            success: false,
            code: 'MIGRATION_MISSING',
            error: 'Fungsi status PRO/FREE belum tersedia di Supabase. Jalankan migrasi SQL 202611200001_add_family_cooldown_guard.sql.',
          };
        }
        return { success: false, code: rpcError.code, error: 'Gagal mengubah status Family. Periksa koneksi dan coba lagi.' };
      }
      await refetch();
      return { success: true, data };
    } catch {
      return { success: false, error: 'Gagal mengubah status Family. Periksa koneksi dan coba lagi.' };
    }
  }
  async function updateMember(_familyId: string, memberId: string, fields: Partial<Member>): Promise<ActionResult> {
    if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };
    const payload: Record<string, unknown> = {};
    for (const key of ['name','email','family_id'] as const) if (fields[key] !== undefined) payload[key] = fields[key];
    if (fields.storageUsed !== undefined || fields.storage_used !== undefined) payload.storage_used = fields.storageUsed ?? fields.storage_used;
    if (fields.memberType !== undefined || fields.member_type !== undefined) payload.member_type = fields.memberType ?? fields.member_type;
    if (fields.expiryDate !== undefined) payload.expiry_date = fields.expiryDate;
    else if (fields.expiry_date !== undefined) payload.expiry_date = fields.expiry_date;
    try { const { data, error: updateError } = await supabase.from('members').update(payload).eq('id', memberId).select('id'); const result = dbFailure(updateError, data); if (result.success) await refetch(); return result; }
    catch { return { success: false, error: 'Member tidak dapat disimpan.' }; }
  }
  return { families, loading, refreshing, error, refetch,
    addFamily: family => saveFamily(family, 'create'), updateFamily: family => saveFamily(family, 'update'),
    deleteFamily: id => rpcAction('app_archive_family', { p_id: id }), cancelSale: id => rpcAction('app_cancel_sale', { p_id: id }),
    setFamilyPlanStatus,
    addMember, removeMember, updateMember };
}
