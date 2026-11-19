import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { normalizeEmail } from '../lib/cockpitParser';
import { diffCalendarDays, parseLocalDateParts } from '../lib/cooldownLogic';
import type {
  AccountCooldownLock,
  AccountFamilyHistoryEntry,
  ActionResult,
  ManualCooldownLockInput,
  ManualHistoryInput,
} from '../types';

const SELECT_COLUMNS =
  'id,user_id,account_email,family_id,family_name_snapshot,family_owner_email_snapshot,member_id,joined_at,left_at,source,leave_reason,counts_for_cooldown,override_reason_type,override_note,notes,created_at,updated_at';

const LOCK_SELECT_COLUMNS =
  'id,user_id,account_email,is_locked,locked_family_id,locked_family_name,locked_family_owner_email,cooldown_ends_at,notes,created_at,updated_at';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapLockRow(r: Record<string, any>): AccountCooldownLock {
  return {
    id: r.id,
    userId: r.user_id,
    accountEmail: normalizeEmail(r.account_email),
    isLocked: r.is_locked !== false,
    lockedFamilyId: r.locked_family_id ?? null,
    lockedFamilyName: r.locked_family_name ?? null,
    lockedFamilyOwnerEmail: r.locked_family_owner_email
      ? normalizeEmail(r.locked_family_owner_email)
      : null,
    cooldownEndsAt: r.cooldown_ends_at ?? null,
    notes: r.notes ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapHistoryRow(r: Record<string, any>): AccountFamilyHistoryEntry {
  return {
    id: r.id,
    userId: r.user_id,
    accountEmail: normalizeEmail(r.account_email),
    familyId: r.family_id ?? null,
    familyNameSnapshot: r.family_name_snapshot || 'Family Plan',
    familyOwnerEmailSnapshot: r.family_owner_email_snapshot
      ? normalizeEmail(r.family_owner_email_snapshot)
      : null,
    memberId: r.member_id ?? null,
    joinedAt: r.joined_at,
    leftAt: r.left_at ?? null,
    source: r.source || 'manual',
    leaveReason: r.leave_reason ?? null,
    countsForCooldown: r.counts_for_cooldown !== false,
    overrideReasonType: r.override_reason_type ?? null,
    overrideNote: r.override_note ?? null,
    notes: r.notes ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toIsoTimestamp(dateInput: string): string {
  const trimmed = dateInput.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    // Simpan tengah hari lokal agar tidak bergeser hari lintas zona waktu
    const [y, m, d] = trimmed.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).toISOString();
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function validateManualHistoryInput(input: {
  familyNameSnapshot?: string;
  familyOwnerEmailSnapshot?: string | null;
  joinedAt?: string;
  leftAt?: string | null;
  notes?: string | null;
}): string | null {
  const name = (input.familyNameSnapshot || '').trim();
  if (!name || name.length > 120) {
    return 'Nama Family wajib diisi (maksimal 120 karakter).';
  }

  const ownerEmail = (input.familyOwnerEmailSnapshot || '').trim().toLowerCase();
  if (ownerEmail && (ownerEmail.length > 254 || !EMAIL_REGEX.test(ownerEmail))) {
    return 'Format email owner Family tidak valid.';
  }

  if (!input.joinedAt || !parseLocalDateParts(input.joinedAt)) {
    return 'Tanggal masuk Family wajib diisi.';
  }

  const today = new Date();
  const joinDiffFromToday = diffCalendarDays(today, input.joinedAt);
  if (joinDiffFromToday !== null && joinDiffFromToday > 0) {
    return 'Tanggal masuk tidak boleh melebihi hari ini.';
  }

  if (input.leftAt) {
    if (!parseLocalDateParts(input.leftAt)) {
      return 'Format tanggal keluar tidak valid.';
    }
    const leftVsJoin = diffCalendarDays(input.joinedAt, input.leftAt);
    if (leftVsJoin !== null && leftVsJoin < 0) {
      return 'Tanggal keluar tidak boleh lebih awal dari tanggal masuk.';
    }
    const leftDiffFromToday = diffCalendarDays(today, input.leftAt);
    if (leftDiffFromToday !== null && leftDiffFromToday > 0) {
      return 'Tanggal keluar tidak boleh melebihi hari ini.';
    }
  }

  if (input.notes && input.notes.length > 300) {
    return 'Catatan maksimal 300 karakter.';
  }

  return null;
}

function mapWriteError(err: { code?: string; message?: string } | null): string {
  if (!err) return 'Gagal menyimpan riwayat Family.';
  const msg = err.message || '';
  if (err.code === '42501' || msg.includes('ADMIN_REQUIRED') || msg.includes('JWT')) {
    return 'Sesi login kamu sudah berakhir. Silakan masuk ulang untuk melanjutkan.';
  }
  if (err.code === '23505') {
    return 'Akun ini sudah tercatat aktif di Family tersebut.';
  }
  if (err.code === '23514') {
    if (msg.includes('chk_afh_left_valid')) {
      return 'Tanggal keluar tidak boleh lebih awal dari tanggal masuk.';
    }
    if (msg.includes('chk_afh_joined_not_future')) {
      return 'Tanggal masuk tidak boleh melebihi hari ini.';
    }
    return 'Data riwayat tidak memenuhi aturan validasi. Periksa kembali isian kamu.';
  }
  return 'Koneksi terputus atau server gagal merespons. Perubahan belum tersimpan, silakan coba lagi.';
}

export function useAccountFamilyHistory(enabled = true) {
  const [entries, setEntries] = useState<AccountFamilyHistoryEntry[]>([]);
  const [locks, setLocks] = useState<AccountCooldownLock[]>([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState<string | null>(null);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const seqRef = useRef(0);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const seq = ++seqRef.current;
    try {
      if (!supabase || typeof supabase.from !== 'function') {
        if (seq === seqRef.current) setLoading(false);
        return;
      }
      const [historyRes, locksRes] = await Promise.all([
        supabase
          .from('account_family_history')
          .select(SELECT_COLUMNS)
          .order('joined_at', { ascending: true }),
        supabase
          .from('account_cooldown_locks')
          .select(LOCK_SELECT_COLUMNS)
          .eq('is_locked', true),
      ]);

      if (seq !== seqRef.current) return;

      const fetchError = historyRes.error;
      if (fetchError) {
        const msg = fetchError.message || '';
        if (
          fetchError.code === '42P01' ||
          fetchError.code === 'PGRST205' ||
          msg.includes('account_family_history')
        ) {
          setMigrationMissing(true);
          setError(
            'Tabel account_family_history belum tersedia di Supabase. Jalankan migrasi SQL 202611200001_add_family_cooldown_guard.sql di Supabase SQL Editor.',
          );
          return;
        }
        throw fetchError;
      }

      setMigrationMissing(false);
      setEntries((historyRes.data || []).map(mapHistoryRow));

      // Jika tabel account_cooldown_locks belum dimigrasi, biarkan locks kosong tanpa memblokir timeline
      if (!locksRes.error && Array.isArray(locksRes.data)) {
        setLocks(locksRes.data.map(mapLockRow));
      } else {
        setLocks([]);
      }
      setError(null);
    } catch {
      if (seq === seqRef.current) {
        setError('Riwayat cooldown gagal dimuat. Harap muat ulang sebelum memindahkan akun.');
      }
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const addManualHistory = useCallback(
    async (input: ManualHistoryInput): Promise<ActionResult<AccountFamilyHistoryEntry>> => {
      if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };

      const validationErr = validateManualHistoryInput(input);
      if (validationErr) return { success: false, code: 'INVALID_INPUT', error: validationErr };

      const email = normalizeEmail(input.accountEmail);
      if (!email || !EMAIL_REGEX.test(email)) {
        return { success: false, code: 'INVALID_INPUT', error: 'Format email akun pribadi tidak valid.' };
      }

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) {
        return {
          success: false,
          code: 'UNAUTHORIZED',
          error: 'Sesi login kamu sudah berakhir. Silakan masuk ulang untuk melanjutkan.',
        };
      }

      const ownerClean = input.familyOwnerEmailSnapshot
        ? normalizeEmail(input.familyOwnerEmailSnapshot)
        : null;

      const payload = {
        user_id: user.id,
        account_email: email,
        family_id: input.familyId || null,
        family_name_snapshot: input.familyNameSnapshot.trim(),
        family_owner_email_snapshot: ownerClean || null,
        joined_at: toIsoTimestamp(input.joinedAt),
        left_at: input.leftAt ? toIsoTimestamp(input.leftAt) : null,
        source: 'manual',
        leave_reason: input.leftAt ? input.leaveReason || 'manual_move' : 'still_active',
        counts_for_cooldown: input.countsForCooldown !== false,
        notes: input.notes?.trim() || null,
      };

      const { data, error: insertErr } = await supabase
        .from('account_family_history')
        .insert(payload)
        .select(SELECT_COLUMNS)
        .single();

      if (insertErr || !data) {
        return { success: false, code: insertErr?.code, error: mapWriteError(insertErr) };
      }

      const mapped = mapHistoryRow(data);
      setEntries((prev) => [...prev, mapped]);
      return { success: true, data: mapped };
    },
    [],
  );

  const updateHistory = useCallback(
    async (
      id: string,
      expectedUpdatedAt: string | undefined,
      patch: Partial<ManualHistoryInput>,
    ): Promise<ActionResult<AccountFamilyHistoryEntry>> => {
      if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };

      const validationErr = validateManualHistoryInput({
        familyNameSnapshot: patch.familyNameSnapshot,
        familyOwnerEmailSnapshot: patch.familyOwnerEmailSnapshot,
        joinedAt: patch.joinedAt,
        leftAt: patch.leftAt,
        notes: patch.notes,
      });
      if (validationErr) return { success: false, code: 'INVALID_INPUT', error: validationErr };

      const ownerClean = patch.familyOwnerEmailSnapshot
        ? normalizeEmail(patch.familyOwnerEmailSnapshot)
        : null;

      const updatePayload: Record<string, unknown> = {
        family_id: patch.familyId ?? null,
        family_name_snapshot: patch.familyNameSnapshot?.trim(),
        family_owner_email_snapshot: ownerClean || null,
        joined_at: patch.joinedAt ? toIsoTimestamp(patch.joinedAt) : undefined,
        left_at: patch.leftAt ? toIsoTimestamp(patch.leftAt) : null,
        leave_reason: patch.leftAt ? patch.leaveReason || 'manual_move' : 'still_active',
        counts_for_cooldown: patch.countsForCooldown !== false,
        notes: patch.notes?.trim() || null,
      };

      let query = supabase
        .from('account_family_history')
        .update(updatePayload)
        .eq('id', id);

      // Optimistic concurrency check (AC-05-03)
      if (expectedUpdatedAt) {
        query = query.eq('updated_at', expectedUpdatedAt);
      }

      const { data, error: updErr } = await query.select(SELECT_COLUMNS);

      if (updErr) {
        return { success: false, code: updErr.code, error: mapWriteError(updErr) };
      }

      if (!data || data.length === 0) {
        await refetch();
        return {
          success: false,
          code: 'CONFLICT',
          error: 'Entri riwayat ini sudah berubah atau dihapus di sesi lain. Daftar diperbarui.',
        };
      }

      const mapped = mapHistoryRow(data[0]);
      setEntries((prev) => prev.map((e) => (e.id === id ? mapped : e)));
      return { success: true, data: mapped };
    },
    [refetch],
  );

  const deleteHistory = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };

      const { data, error: delErr } = await supabase
        .from('account_family_history')
        .delete()
        .eq('id', id)
        .select('id');

      if (delErr) {
        return { success: false, code: delErr.code, error: mapWriteError(delErr) };
      }

      if (!data || data.length === 0) {
        await refetch();
        return {
          success: false,
          code: 'CONFLICT',
          error: 'Entri riwayat ini sudah berubah atau dihapus di sesi lain. Daftar diperbarui.',
        };
      }

      setEntries((prev) => prev.filter((e) => e.id !== id));
      return { success: true };
    },
    [refetch],
  );

  const upsertManualLock = useCallback(
    async (input: ManualCooldownLockInput): Promise<ActionResult<AccountCooldownLock>> => {
      if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };

      const email = normalizeEmail(input.accountEmail);
      if (!email || !EMAIL_REGEX.test(email)) {
        return { success: false, code: 'INVALID_INPUT', error: 'Format email akun pribadi tidak valid.' };
      }

      const famName = (input.lockedFamilyName || '').trim();
      if (!famName || famName.length > 120) {
        return {
          success: false,
          code: 'INVALID_INPUT',
          error: 'Nama Family terakhir wajib diisi (maksimal 120 karakter).',
        };
      }

      const ownerClean = input.lockedFamilyOwnerEmail
        ? normalizeEmail(input.lockedFamilyOwnerEmail)
        : null;
      if (ownerClean && (ownerClean.length > 254 || !EMAIL_REGEX.test(ownerClean))) {
        return {
          success: false,
          code: 'INVALID_INPUT',
          error: 'Format email owner Family terakhir tidak valid.',
        };
      }

      if (input.notes && input.notes.length > 300) {
        return { success: false, code: 'INVALID_INPUT', error: 'Catatan maksimal 300 karakter.' };
      }

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) {
        return {
          success: false,
          code: 'UNAUTHORIZED',
          error: 'Sesi login kamu sudah berakhir. Silakan masuk ulang untuk melanjutkan.',
        };
      }

      const payload = {
        user_id: user.id,
        account_email: email,
        is_locked: true,
        locked_family_id: input.lockedFamilyId || null,
        locked_family_name: famName,
        locked_family_owner_email: ownerClean || null,
        cooldown_ends_at: input.cooldownEndsAt ? toIsoTimestamp(input.cooldownEndsAt) : null,
        notes: input.notes?.trim() || null,
      };

      const { data, error: upsertErr } = await supabase
        .from('account_cooldown_locks')
        .upsert(payload, { onConflict: 'user_id,account_email' })
        .select(LOCK_SELECT_COLUMNS)
        .single();

      if (upsertErr || !data) {
        return { success: false, code: upsertErr?.code, error: mapWriteError(upsertErr) };
      }

      const mapped = mapLockRow(data);
      setLocks((prev) => {
        const exists = prev.some((l) => l.accountEmail === email);
        return exists
          ? prev.map((l) => (l.accountEmail === email ? mapped : l))
          : [...prev, mapped];
      });
      return { success: true, data: mapped };
    },
    [],
  );

  const clearManualLock = useCallback(async (rawEmail: string): Promise<ActionResult> => {
    if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };
    const email = normalizeEmail(rawEmail);
    if (!email) return { success: false, error: 'Email tidak valid.' };

    const { error: delErr } = await supabase
      .from('account_cooldown_locks')
      .delete()
      .eq('account_email', email);

    if (delErr) {
      return { success: false, code: delErr.code, error: mapWriteError(delErr) };
    }

    setLocks((prev) => prev.filter((l) => l.accountEmail !== email));
    return { success: true };
  }, []);

  return {
    entries,
    locks,
    loading,
    error,
    migrationMissing,
    refetch,
    addManualHistory,
    updateHistory,
    deleteHistory,
    upsertManualLock,
    clearManualLock,
  };
}
