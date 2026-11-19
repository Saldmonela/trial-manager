import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { invokeApi } from '../lib/api';
import {
  deriveArgonStatus,
  deriveEligibilityStatus,
  normalizeEmail,
  normalizeTags,
  parseArgonStatus,
} from '../lib/cockpitParser';
import type {
  ActionResult,
  CockpitAccount,
  CockpitArgonStatus,
  CockpitAssignResult,
  CockpitImportAccountInput,
  CockpitImportResult,
  CockpitPlanTier,
} from '../types';

const SELECT_COLUMNS =
  'id,user_id,email,plan_tier,eligibility_status,argon_status,raw_tags,is_current,switch_time,quotas,available_ai_credits,notes,last_synced_at,created_at,updated_at';

const SELECT_COLUMNS_LEGACY =
  'id,user_id,email,plan_tier,eligibility_status,raw_tags,is_current,switch_time,quotas,available_ai_credits,notes,last_synced_at,created_at,updated_at';

function mapRow(r: Record<string, any>): CockpitAccount {
  const rawTags = Array.isArray(r.raw_tags) ? r.raw_tags : [];
  const quotas = Array.isArray(r.quotas) ? r.quotas : [];
  const argonStatus =
    parseArgonStatus(r.argon_status) ?? deriveArgonStatus(quotas, rawTags);

  return {
    id: r.id,
    userId: r.user_id,
    email: r.email,
    planTier: r.plan_tier || 'AUTO_FAMILY',
    eligibilityStatus: r.eligibility_status || 'untagged',
    argonStatus,
    rawTags,
    isCurrent: Boolean(r.is_current),
    switchTime: r.switch_time || null,
    quotas,
    availableAiCredits:
      r.available_ai_credits === null || r.available_ai_credits === undefined
        ? null
        : Number(r.available_ai_credits),
    notes: r.notes ?? null,
    lastSyncedAt: r.last_synced_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapAssignError(rawMsg: string, familyName?: string): string {
  const targetLabel = familyName || 'Family tujuan';
  if (rawMsg.includes('FAMILY_CONFLICT') || rawMsg.includes('FAMILY_FULL')) {
    return `Gagal mencatat akun: ${targetLabel} sudah terisi akun pribadi lain atau slot-nya baru saja penuh.`;
  }
  if (rawMsg.includes('ALREADY_IN_FAMILY')) {
    return `Akun ini sudah terdaftar di ${targetLabel}.`;
  }
  if (rawMsg.includes('FAMILY_INVALID')) {
    return `${targetLabel} sudah tidak aktif, kedaluwarsa, atau ditandai banned.`;
  }
  if (rawMsg.includes('INVALID_INPUT')) {
    return 'Nama anggota wajib diisi (maksimal 80 karakter).';
  }
  if (rawMsg.includes('ADMIN_REQUIRED') || rawMsg.includes('UNAUTHORIZED')) {
    return 'Sesi admin Anda telah berakhir. Silakan masuk kembali.';
  }
  if (rawMsg.includes('ACCOUNT_INELIGIBLE')) {
    return 'Akun berstatus ban atau need verif tidak dapat ditempatkan ke Family PRO.';
  }
  return 'Gagal mencatat penempatan akun ke Family. Periksa koneksi Anda lalu coba lagi.';
}

export function useCockpitAccounts() {
  const [accounts, setAccounts] = useState<CockpitAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationMissing, setMigrationMissing] = useState(false);

  const refetch = useCallback(async () => {
    try {
      if (!supabase) throw new Error('NOT_CONFIGURED');
      let { data, error: fetchError } = await supabase
        .from('cockpit_accounts')
        .select(SELECT_COLUMNS)
        .order('email', { ascending: true });

      if (
        fetchError &&
        (fetchError.code === '42703' ||
          fetchError.code === 'PGRST204' ||
          (fetchError.message || '').includes('argon_status'))
      ) {
        const legacyRes = await supabase
          .from('cockpit_accounts')
          .select(SELECT_COLUMNS_LEGACY)
          .order('email', { ascending: true });
        data = legacyRes.data as typeof data;
        fetchError = legacyRes.error;
      }

      if (fetchError) {
        const msg = fetchError.message || '';
        if (
          fetchError.code === '42P01' ||
          fetchError.code === 'PGRST205' ||
          msg.includes('cockpit_accounts')
        ) {
          setMigrationMissing(true);
          setError(
            'Tabel cockpit_accounts belum tersedia di Supabase. Jalankan migrasi SQL 202611190001_add_cockpit_accounts.sql di Supabase SQL Editor.',
          );
          return;
        }
        throw fetchError;
      }

      setMigrationMissing(false);
      setAccounts((data || []).map(mapRow));
      setError(null);
    } catch {
      setError('Gagal memuat daftar akun Cockpit. Periksa koneksi Anda lalu coba muat ulang.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const importSnapshot = useCallback(
    async (
      sanitizedAccounts: CockpitImportAccountInput[],
      clientSkippedCount = 0,
    ): Promise<ActionResult<CockpitImportResult>> => {
      if (!supabase) {
        return { success: false, error: 'Supabase belum dikonfigurasi.' };
      }

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) {
        return {
          success: false,
          code: 'UNAUTHORIZED',
          error: 'Sesi admin Anda telah berakhir. Silakan masuk kembali untuk mengimpor data.',
        };
      }

      // Jalur utama: Edge Function cockpit-import (PRD Section 3)
      const edgeResult = await invokeApi<CockpitImportResult>('cockpit-import', {
        accounts: sanitizedAccounts,
      });

      if (edgeResult.success && edgeResult.data) {
        await refetch();
        return edgeResult;
      }

      // Jika sesi/otorisasi ditolak server, jangan fallback
      if (edgeResult.code === 'UNAUTHORIZED' || edgeResult.code === 'ADMIN_REQUIRED') {
        return {
          success: false,
          code: edgeResult.code,
          error: 'Sesi admin Anda telah berakhir. Silakan masuk kembali untuk mengimpor data.',
        };
      }

      // Fallback aman via authenticated RLS upsert (jika Edge Function belum di-deploy di project Supabase)
      if (edgeResult.code === 'REQUEST_FAILED' || edgeResult.code === 'NETWORK_ERROR') {
        try {
          const emails = sanitizedAccounts.map((a) => normalizeEmail(a.email));
          let existingRows: Array<Record<string, any>> | null = null;
          let hasArgonColumn = true;
          const existingRes = await supabase
            .from('cockpit_accounts')
            .select('email, plan_tier, argon_status, notes')
            .eq('user_id', user.id)
            .in('email', emails);

          if (
            existingRes.error &&
            (existingRes.error.code === '42703' ||
              existingRes.error.code === 'PGRST204' ||
              (existingRes.error.message || '').includes('argon_status'))
          ) {
            hasArgonColumn = false;
            const legacyExisting = await supabase
              .from('cockpit_accounts')
              .select('email, plan_tier, notes')
              .eq('user_id', user.id)
              .in('email', emails);
            if (legacyExisting.error) throw legacyExisting.error;
            existingRows = legacyExisting.data;
          } else if (existingRes.error) {
            throw existingRes.error;
          } else {
            existingRows = existingRes.data;
          }

          const existingMap = new Map<
            string,
            { plan_tier: string; argon_status?: string; notes: string | null }
          >();
          for (const row of existingRows || []) {
            existingMap.set(row.email, {
              plan_tier: row.plan_tier,
              argon_status: row.argon_status,
              notes: row.notes,
            });
          }

          const syncedAt = new Date().toISOString();
          let created = 0;
          let updated = 0;

          const upsertRows = sanitizedAccounts.map((item) => {
            const email = normalizeEmail(item.email);
            const prev = existingMap.get(email);
            if (prev) updated += 1;
            else created += 1;

            const tags = normalizeTags(item.tags);
            const quotas = Array.isArray(item.quotas) ? item.quotas : [];
            const resolvedPlanTier =
              item.plan_tier && item.plan_tier !== 'AUTO_FAMILY'
                ? item.plan_tier
                : prev?.plan_tier || 'AUTO_FAMILY';
            const incomingArgon = item.argon_status ?? deriveArgonStatus(quotas, tags);
            const resolvedArgonStatus: CockpitArgonStatus =
              incomingArgon !== 'unknown'
                ? incomingArgon
                : (parseArgonStatus(prev?.argon_status) ?? 'unknown');

            const row: Record<string, unknown> = {
              user_id: user.id,
              email,
              plan_tier: resolvedPlanTier,
              eligibility_status: deriveEligibilityStatus(tags),
              raw_tags: tags,
              is_current: Boolean(item.is_current),
              switch_time: item.switch_time || null,
              quotas,
              available_ai_credits: item.available_ai_credits ?? null,
              notes: item.notes ?? prev?.notes ?? null,
              last_synced_at: syncedAt,
            };
            if (hasArgonColumn) {
              row.argon_status = resolvedArgonStatus;
            }
            return row;
          });

          const { error: upsertErr } = await supabase
            .from('cockpit_accounts')
            .upsert(upsertRows, { onConflict: 'user_id,email' });

          if (upsertErr) throw upsertErr;

          await refetch();
          return {
            success: true,
            data: {
              imported: upsertRows.length,
              created,
              updated,
              skipped: Array.from({ length: clientSkippedCount }, (_, index) => ({
                index,
                reason: 'Format email tidak valid',
              })),
              synced_at: syncedAt,
            },
          };
        } catch {
          return {
            success: false,
            code: 'NETWORK_ERROR',
            error:
              'Gagal menyimpan data karena koneksi terputus. Tidak ada perubahan yang disimpan, silakan coba lagi.',
          };
        }
      }

      return edgeResult;
    },
    [refetch],
  );

  const updatePlanTier = useCallback(
    async (id: string, planTier: CockpitPlanTier): Promise<ActionResult> => {
      if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };
      const { error: updErr } = await supabase
        .from('cockpit_accounts')
        .update({ plan_tier: planTier })
        .eq('id', id);

      if (updErr) {
        return { success: false, error: 'Gagal memperbarui status paket akun.' };
      }
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, planTier } : a)));
      return { success: true };
    },
    [],
  );

  const updateArgonStatus = useCallback(
    async (id: string, argonStatus: CockpitArgonStatus): Promise<ActionResult> => {
      if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };
      const { error: updErr } = await supabase
        .from('cockpit_accounts')
        .update({ argon_status: argonStatus })
        .eq('id', id);

      if (updErr) {
        if (
          updErr.code === '42703' ||
          updErr.code === 'PGRST204' ||
          (updErr.message || '').includes('argon_status')
        ) {
          return {
            success: false,
            error:
              'Kolom argon_status belum ada di Supabase. Jalankan migrasi SQL 202611190002_add_cockpit_argon_status.sql di Supabase SQL Editor.',
          };
        }
        return { success: false, error: 'Gagal memperbarui status kuota Argon akun.' };
      }
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, argonStatus } : a)));
      return { success: true };
    },
    [],
  );

  const deleteAccount = useCallback(async (id: string): Promise<ActionResult> => {
    if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };
    const { error: delErr } = await supabase.from('cockpit_accounts').delete().eq('id', id);
    if (delErr) {
      return { success: false, error: 'Gagal menghapus akun dari daftar pantauan.' };
    }
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    return { success: true };
  }, []);

  const assignToFamily = useCallback(
    async (
      cockpitAccountId: string,
      familyId: string,
      memberName: string,
      familyName?: string,
    ): Promise<ActionResult<CockpitAssignResult>> => {
      if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };

      const trimmedName = memberName.trim();
      if (!trimmedName || trimmedName.length > 80) {
        return {
          success: false,
          code: 'INVALID_INPUT',
          error: 'Nama anggota wajib diisi (maksimal 80 karakter).',
        };
      }

      const { data, error: rpcErr } = await supabase.rpc('assign_cockpit_account_to_family', {
        p_cockpit_account_id: cockpitAccountId,
        p_family_id: familyId,
        p_member_name: trimmedName,
      });

      if (rpcErr) {
        return {
          success: false,
          code: rpcErr.code || 'ASSIGN_FAILED',
          error: mapAssignError(rpcErr.message || '', familyName),
        };
      }

      return { success: true, data: data as CockpitAssignResult };
    },
    [],
  );

  return {
    accounts,
    loading,
    error,
    migrationMissing,
    refetch,
    importSnapshot,
    updatePlanTier,
    updateArgonStatus,
    deleteAccount,
    assignToFamily,
  };
}
