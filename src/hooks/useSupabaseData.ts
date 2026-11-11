import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { dbFailure, invokeApi } from '../lib/api';
import type { ActionResult, Family, FamilyInput, Member, UseSupabaseDataReturn } from '../types';

function mapFamily(row: Record<string, any>): Family {
  const safe = Object.fromEntries(Object.entries(row).filter(([key]) => !['owner_password','owner_password_v1','ownerPassword'].includes(key)));
  return { ...safe, id: row.id, name: row.name || '', ownerEmail: row.owner_email, expiryDate: row.expiry_date, storageUsed: Number(row.storage_used) || 0,
    createdAt: row.created_at, priceMonthly: Number(row.price_monthly) || 0, priceAnnual: Number(row.price_annual) || 0,
    priceSale: Number(row.price_sale) || 0, productType: row.product_type || 'slot', isBanned: !!row.is_banned, isPublic: row.is_public, isActive: row.is_active, soldAt: row.sold_at,
    credentialStatus: row.credential_status, credentialVersion: row.credential_version, members: (row.members || []).map((m: Member) => ({ ...m, addedAt: m.added_at, storageUsed: Number(m.storage_used) || 0, memberType: m.member_type, expiryDate: m.expiry_date })) };
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
  async function addMember(familyId: string, member: Omit<Member, 'family_id'>): Promise<ActionResult> {
    if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };
    const { id, name, email } = member;
    try {
      const { data, error: insertError } = await supabase.from('members').insert({ id, family_id: familyId, name, email, added_at: member.addedAt || new Date().toISOString(), storage_used: member.storageUsed ?? 0, member_type: member.memberType || 'pembeli', expiry_date: member.memberType === 'pribadi' ? null : member.expiryDate || null }).select('id');
      const result = dbFailure(insertError, data); if (result.success) await refetch(); return result;
    } catch { return { success: false, error: 'Member tidak dapat ditambahkan.' }; }
  }
  async function removeMember(_familyId: string, memberId: string): Promise<ActionResult> {
    if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };
    try { const { data, error: removeError } = await supabase.from('members').delete().eq('id', memberId).select('id'); const result = dbFailure(removeError, data); if (result.success) await refetch(); return result; }
    catch { return { success: false, error: 'Member tidak dapat dihapus.' }; }
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
    addMember, removeMember, updateMember };
}
