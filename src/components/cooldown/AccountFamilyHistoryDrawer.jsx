import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Clock,
  ShieldAlert,
  ShieldCheck,
  History,
  RefreshCw,
  Check,
  Lock,
  Unlock,
} from 'lucide-react';
import { cn } from '../../utils';
import {
  addCalendarMonths,
  computeAccountCooldown,
  diffCalendarDays,
  formatDateId,
  formatPartsToIsoDate,
  parseLocalDateParts,
} from '../../lib/cooldownLogic';
import { normalizeEmail } from '../../lib/cockpitParser';
import { validateManualHistoryInput } from '../../hooks/useAccountFamilyHistory';

const LOCK_DATE_PRESETS = [
  { label: 'Lupa / Tanpa Tanggal', months: null },
  { label: '+3 Bln', months: 3 },
  { label: '+6 Bln', months: 6 },
  { label: '+9 Bln', months: 9 },
  { label: '+12 Bln', months: 12 },
];

const LEAVE_REASON_LABELS = {
  still_active: 'Masih Aktif',
  family_downgraded_free: 'Family Turun ke FREE',
  family_expired: 'Family Expired',
  manual_move: 'Pindah Family',
  local_correction: 'Koreksi Lokal',
  other: 'Lainnya',
};

const SOURCE_LABELS = {
  auto_assign: 'Otomatis (Cockpit)',
  auto_admin: 'Otomatis (Admin)',
  auto_seed: 'Sinkronisasi Awal',
  manual: 'Input Manual',
};

function todayIsoDate() {
  const parts = parseLocalDateParts(new Date());
  return parts ? formatPartsToIsoDate(parts) : '';
}

function toDateInputValue(iso) {
  const parts = parseLocalDateParts(iso);
  return parts ? formatPartsToIsoDate(parts) : '';
}

function buildEmptyForm(families) {
  const firstFamily = families?.[0] || null;
  return {
    familySelectionMode: firstFamily ? 'existing_family' : 'custom_family',
    familyId: firstFamily ? firstFamily.id : '',
    familyNameSnapshot: firstFamily ? firstFamily.name || firstFamily.ownerEmail || '' : '',
    familyOwnerEmailSnapshot: firstFamily ? firstFamily.ownerEmail || '' : '',
    joinedAt: todayIsoDate(),
    leftAt: '',
    leaveReason: 'manual_move',
    countsForCooldown: true,
    notes: '',
  };
}

/**
 * Slide-over kanan Timeline Riwayat Family & Backfill/Edit/Hapus Manual (US-04, US-05).
 * Desain serasi dengan FamilyRecommendationDrawer.jsx (Editorial Operate Mode).
 */
export default function AccountFamilyHistoryDrawer({
  isOpen,
  isDark,
  accountEmail,
  families = [],
  historyEntries = [],
  cooldownLocks = [],
  historyLoading = false,
  historyError = null,
  onRetryHistory,
  onClose,
  onAddManual,
  onUpdateEntry,
  onDeleteEntry,
  onUpsertManualLock,
  onClearManualLock,
  onFeedback,
}) {
  const [formMode, setFormMode] = useState(null); // null | 'create' | 'edit' | 'lock'
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState(() => buildEmptyForm(families));
  const [lockForm, setLockForm] = useState({
    familySelectionMode: 'existing_family',
    lockedFamilyId: '',
    lockedFamilyName: '',
    lockedFamilyOwnerEmail: '',
    cooldownEndsAt: '',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFormMode(null);
    setEditingEntry(null);
    setFormError('');
    setConfirmDeleteId(null);
  }, [isOpen, accountEmail]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting && !deletingId && !unlocking) {
        if (formMode) {
          setFormMode(null);
          setEditingEntry(null);
          setFormError('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, submitting, deletingId, unlocking, formMode, onClose]);

  const liveActiveHint = useMemo(() => {
    if (!accountEmail) return null;
    const norm = normalizeEmail(accountEmail);
    for (const fam of families) {
      const m = (fam.members || []).find((mem) => normalizeEmail(mem.email) === norm);
      if (m) {
        return {
          familyId: fam.id,
          familyName: fam.name || fam.ownerEmail || 'Family Plan',
          ownerEmail: fam.ownerEmail ?? null,
          joinedAt: m.addedAt || m.added_at || null,
        };
      }
    }
    return null;
  }, [accountEmail, families]);

  const activeManualLock = useMemo(() => {
    if (!accountEmail) return null;
    const norm = normalizeEmail(accountEmail);
    return (cooldownLocks || []).find((l) => normalizeEmail(l.accountEmail) === norm) || null;
  }, [accountEmail, cooldownLocks]);

  const summary = useMemo(() => {
    if (!accountEmail) return null;
    return computeAccountCooldown(
      accountEmail,
      historyEntries,
      new Date(),
      liveActiveHint,
      activeManualLock,
    );
  }, [accountEmail, historyEntries, liveActiveHint, activeManualLock]);

  if (!isOpen || !accountEmail) return null;

  const openLockForm = () => {
    const existingLock = summary?.manualLock;
    const defaultFamId =
      existingLock?.lockedFamilyId ||
      summary?.lockedFamilyId ||
      liveActiveHint?.familyId ||
      families[0]?.id ||
      '';
    const matchedFam = defaultFamId ? families.find((f) => f.id === defaultFamId) || null : null;
    const defaultFamName =
      existingLock?.lockedFamilyName ||
      summary?.lockedFamilyName ||
      liveActiveHint?.familyName ||
      matchedFam?.name ||
      matchedFam?.ownerEmail ||
      '';
    const defaultOwner =
      existingLock?.lockedFamilyOwnerEmail ||
      summary?.lockedFamilyOwnerEmail ||
      liveActiveHint?.ownerEmail ||
      matchedFam?.ownerEmail ||
      '';

    setLockForm({
      familySelectionMode: matchedFam ? 'existing_family' : 'custom_family',
      lockedFamilyId: matchedFam ? matchedFam.id : '',
      lockedFamilyName: defaultFamName,
      lockedFamilyOwnerEmail: defaultOwner,
      cooldownEndsAt: existingLock?.cooldownEndsAt ? toDateInputValue(existingLock.cooldownEndsAt) : '',
      notes: existingLock?.notes || '',
    });
    setFormError('');
    setConfirmDeleteId(null);
    setFormMode('lock');
  };

  const handleSubmitLockForm = async (e) => {
    e.preventDefault();
    if (submitting || !onUpsertManualLock) return;

    const famName = lockForm.lockedFamilyName.trim();
    if (!famName || famName.length > 120) {
      setFormError('Nama Family terakhir wajib diisi (maksimal 120 karakter).');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const res = await onUpsertManualLock({
        accountEmail,
        lockedFamilyId:
          lockForm.familySelectionMode === 'existing_family' ? lockForm.lockedFamilyId || null : null,
        lockedFamilyName: famName,
        lockedFamilyOwnerEmail: lockForm.lockedFamilyOwnerEmail.trim() || null,
        cooldownEndsAt: lockForm.cooldownEndsAt || null,
        notes: lockForm.notes.trim() || null,
      });
      if (res.success) {
        onFeedback?.(
          `Akun ${accountEmail} ditandai terkunci cooldown — hanya bisa menetap di ${famName}.`,
          'warning',
        );
        setFormMode(null);
      } else {
        setFormError(res.error || 'Gagal menyimpan status terkunci.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearManualLock = async () => {
    if (unlocking || !onClearManualLock) return;
    setUnlocking(true);
    try {
      const res = await onClearManualLock(accountEmail);
      if (res.success) {
        onFeedback?.(`Kunci manual untuk ${accountEmail} dibuka.`, 'success');
      } else {
        onFeedback?.(res.error || 'Gagal membuka kunci manual.', 'error');
      }
    } finally {
      setUnlocking(false);
    }
  };

  const openCreateForm = () => {
    setForm(buildEmptyForm(families));
    setEditingEntry(null);
    setFormError('');
    setConfirmDeleteId(null);
    setFormMode('create');
  };

  const openEditForm = (entry) => {
    const matchedFamily = entry.familyId
      ? families.find((f) => f.id === entry.familyId) || null
      : null;
    setEditingEntry(entry);
    setForm({
      familySelectionMode: matchedFamily ? 'existing_family' : 'custom_family',
      familyId: matchedFamily ? matchedFamily.id : '',
      familyNameSnapshot: entry.familyNameSnapshot || '',
      familyOwnerEmailSnapshot: entry.familyOwnerEmailSnapshot || '',
      joinedAt: toDateInputValue(entry.joinedAt),
      leftAt: entry.leftAt ? toDateInputValue(entry.leftAt) : '',
      leaveReason: entry.leaveReason || (entry.leftAt ? 'manual_move' : 'still_active'),
      countsForCooldown: entry.countsForCooldown !== false,
      notes: entry.notes || '',
    });
    setFormError('');
    setConfirmDeleteId(null);
    setFormMode('edit');
  };

  const handleSelectExistingFamily = (familyId) => {
    const fam = families.find((f) => f.id === familyId);
    setForm((prev) => ({
      ...prev,
      familyId,
      familyNameSnapshot: fam ? fam.name || fam.ownerEmail || 'Family Plan' : '',
      familyOwnerEmailSnapshot: fam?.ownerEmail || '',
    }));
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const payload = {
      accountEmail,
      familyId: form.familySelectionMode === 'existing_family' ? form.familyId || null : null,
      familyNameSnapshot: form.familyNameSnapshot.trim(),
      familyOwnerEmailSnapshot: form.familyOwnerEmailSnapshot.trim() || null,
      joinedAt: form.joinedAt,
      leftAt: form.leftAt || null,
      leaveReason: form.leftAt ? form.leaveReason || 'manual_move' : 'still_active',
      countsForCooldown: form.countsForCooldown,
      notes: form.notes.trim() || null,
    };

    const validationErr = validateManualHistoryInput(payload);
    if (validationErr) {
      setFormError(validationErr);
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const res =
        formMode === 'edit' && editingEntry
          ? await onUpdateEntry(editingEntry.id, editingEntry.updatedAt, payload)
          : await onAddManual(payload);

      if (res.success) {
        onFeedback?.(
          formMode === 'edit'
            ? 'Entri riwayat diperbarui.'
            : 'Riwayat Family berhasil ditambahkan. Status cooldown diperbarui.',
          'success',
        );
        setFormMode(null);
        setEditingEntry(null);
      } else {
        setFormError(res.error || 'Gagal menyimpan riwayat Family.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async (entryId) => {
    if (deletingId) return;
    setDeletingId(entryId);
    try {
      const res = await onDeleteEntry(entryId);
      if (res.success) {
        setConfirmDeleteId(null);
        onFeedback?.('Entri riwayat dihapus. Status cooldown dihitung ulang.', 'info');
      } else {
        onFeedback?.(res.error || 'Gagal menghapus entri riwayat.', 'error');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const statusBanner = (() => {
    if (historyError || !summary) {
      return {
        tone: isDark
          ? 'border-red-500/40 bg-red-950/40 text-red-200'
          : 'border-red-700/35 bg-red-50 text-red-900',
        Icon: ShieldAlert,
        headline: 'Status Cooldown Gagal Dimuat',
        detail: historyError || 'Muat ulang data untuk memverifikasi riwayat akun ini.',
      };
    }
    if (summary.status === 'cooldown_active') {
      const hasDate = Boolean(summary.cooldownEndsAt && summary.cooldownDaysRemaining !== null);
      const ends = hasDate ? formatDateId(summary.cooldownEndsAt) : null;
      const days = summary.cooldownDaysRemaining ?? 0;
      const homeFamily = summary.lockedFamilyName || summary.currentFamilyName || 'Family terakhir';
      return {
        tone: summary.isUnlockingSoon
          ? isDark
            ? 'border-amber-500/45 bg-amber-950/35 text-amber-100'
            : 'border-amber-700/35 bg-amber-50 text-amber-950'
          : isDark
            ? 'border-red-500/45 bg-red-950/45 text-red-100'
            : 'border-red-700/40 bg-red-50 text-red-950',
        Icon: summary.isUnlockingSoon ? Clock : Lock,
        headline: hasDate
          ? summary.isUnlockingSoon
            ? `Hampir Bebas Cooldown · ${days} hari lagi`
            : `Terkunci Cooldown · ${days} hari lagi`
          : 'Terkunci Cooldown · Hanya Bisa di Family Terakhir',
        detail: hasDate
          ? `Tidak bisa pindah ke Family lain sampai ${ends}. Hanya boleh menetap atau kembali di ${homeFamily}.`
          : `Akun ini ditandai sudah tidak bisa pindah ke Family lain dan hanya boleh menetap atau kembali di ${homeFamily} (tanggal bebas belum dicatat).`,
      };
    }
    if (summary.status === 'ready_last_switch') {
      return {
        tone: isDark
          ? 'border-amber-500/40 bg-amber-950/30 text-amber-100'
          : 'border-amber-700/35 bg-amber-50 text-amber-950',
        Icon: Clock,
        headline: 'Siap Masuk Family ke-2 (Jatah Terakhir)',
        detail:
          'Akun sudah keluar dari Family ke-1. Begitu masuk Family baru, akun akan masuk masa cooldown 12 bulan.',
      };
    }
    if (summary.status === 'safe_first_family') {
      return {
        tone: isDark
          ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
          : 'border-emerald-700/30 bg-emerald-50 text-emerald-900',
        Icon: ShieldCheck,
        headline: 'Aman · Sisa 1x Jatah Pindah',
        detail: summary.firstFamilyName
          ? `Tergabung pertama di ${summary.firstFamilyName} (${formatDateId(summary.firstJoinedAt)}). Masih bisa pindah 1x jika diperlukan.`
          : 'Masih tersisa 1x jatah pindah Google Family dalam 12 bulan.',
      };
    }
    return {
      tone: isDark
        ? 'border-stone-700 bg-stone-800/60 text-stone-200'
        : 'border-stone-300 bg-stone-100 text-stone-800',
      Icon: History,
      headline: 'Belum Pernah Gabung Family',
      detail: 'Belum ada riwayat tercatat. Jika akun ini pernah masuk Family sebelumnya, catat manual di bawah.',
    };
  })();

  const BannerIcon = statusBanner.Icon;
  const chronologicalEntries = summary?.entries || [];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-stone-950/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting && !deletingId) onClose();
      }}
    >
      <aside
        className={cn(
          'w-full max-w-lg h-full flex flex-col border-l shadow-2xl',
          isDark
            ? 'bg-stone-900 border-stone-800 text-stone-100'
            : 'bg-paper border-stone-200 text-stone-900',
        )}
      >
        {/* Sticky Header */}
        <div
          className={cn(
            'flex items-start justify-between gap-4 px-6 py-5 border-b shrink-0',
            isDark ? 'border-stone-800' : 'border-stone-200',
          )}
        >
          <div className="min-w-0">
            <h2
              id="history-drawer-title"
              className={cn('font-serif text-xl font-bold tracking-tight', isDark ? 'text-white' : 'text-stone-900')}
            >
              Riwayat Family &amp; Cooldown
            </h2>
            <p className={cn('text-xs mt-1 font-mono truncate', isDark ? 'text-gold-400' : 'text-gold-700')}>
              {accountEmail}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || Boolean(deletingId)}
            aria-label="Tutup drawer riwayat Family"
            className={cn(
              'p-1.5 transition-colors disabled:opacity-40 cursor-pointer',
              isDark
                ? 'text-stone-400 hover:text-stone-100 hover:bg-stone-800'
                : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200',
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Status Summary Banner */}
          <div className={cn('border p-4 space-y-2', statusBanner.tone)}>
            <div className="flex items-center gap-2 font-semibold text-sm tabular-nums">
              <BannerIcon className="w-4 h-4 shrink-0" />
              <span>{statusBanner.headline}</span>
            </div>
            <p className="text-xs leading-relaxed opacity-90">{statusBanner.detail}</p>
            {summary?.manualLock?.notes && (
              <p className="text-xs italic opacity-85">Catatan: {summary.manualLock.notes}</p>
            )}
            {historyError && onRetryHistory && (
              <button
                type="button"
                onClick={onRetryHistory}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-current cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Coba Lagi
              </button>
            )}

            {/* Quick Lock / Unlock Controls for Already-Locked Accounts */}
            {!historyError && onUpsertManualLock && formMode !== 'lock' && (
              <div className="pt-2 flex flex-wrap items-center gap-2">
                {summary?.isManualLock ? (
                  <>
                    <button
                      type="button"
                      onClick={openLockForm}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border border-current hover:opacity-85 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      Ubah Info Kunci
                    </button>
                    {onClearManualLock && (
                      <button
                        type="button"
                        disabled={unlocking}
                        onClick={handleClearManualLock}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border border-current hover:opacity-85 cursor-pointer disabled:opacity-40"
                      >
                        <Unlock className="w-3 h-3" />
                        {unlocking ? 'Membuka...' : 'Buka Kunci Manual'}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={openLockForm}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer',
                      isDark
                        ? 'border-red-400/50 bg-red-950/40 text-red-200 hover:bg-red-950/70'
                        : 'border-red-700/40 bg-white text-red-900 hover:bg-red-50',
                    )}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Tandai Sudah Tidak Bisa Pindah (Terkunci)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Inline Manual Cooldown Lock Form (Untuk akun lama yang sudah mentok sebelum fitur dibuat) */}
          {formMode === 'lock' && (
            <form
              onSubmit={handleSubmitLockForm}
              className={cn(
                'border p-4 space-y-4',
                isDark ? 'border-red-500/40 bg-stone-950/70' : 'border-red-700/35 bg-white',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-serif text-base font-bold">
                  Tandai Akun Tidak Bisa Pindah ke Family Lain
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setFormMode(null);
                    setFormError('');
                  }}
                  disabled={submitting}
                  className={cn(
                    'text-xs underline cursor-pointer',
                    isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-600 hover:text-stone-900',
                  )}
                >
                  Batal
                </button>
              </div>

              <p className={cn('text-xs leading-relaxed', isDark ? 'text-stone-400' : 'text-stone-600')}>
                Gunakan ini untuk akun yang <strong>sudah terkena limit 12 bulan Google</strong> sebelum fitur ini ada. Akun akan dikunci agar hanya menetap atau kembali ke <strong>Family terakhirnya</strong>.
              </p>

              {formError && (
                <p
                  role="alert"
                  className={cn(
                    'border px-3 py-2 text-xs font-medium',
                    isDark
                      ? 'border-red-500/40 bg-red-950/40 text-red-200'
                      : 'border-red-700/35 bg-red-50 text-red-800',
                  )}
                >
                  {formError}
                </p>
              )}

              <fieldset disabled={submitting} className="space-y-3.5 text-xs">
                <div className="space-y-1.5">
                  <span className="block font-semibold">
                    Family Terakhir (Satu-satunya Family yang Boleh Ditempati) *
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const fam = families.find((f) => f.id === lockForm.lockedFamilyId) || families[0];
                        setLockForm((prev) => ({
                          ...prev,
                          familySelectionMode: 'existing_family',
                          lockedFamilyId: fam?.id || '',
                          lockedFamilyName: fam ? fam.name || fam.ownerEmail || 'Family Plan' : prev.lockedFamilyName,
                          lockedFamilyOwnerEmail: fam?.ownerEmail || prev.lockedFamilyOwnerEmail,
                        }));
                      }}
                      disabled={families.length === 0}
                      className={cn(
                        'py-2 px-2.5 border font-semibold text-center transition-colors cursor-pointer disabled:opacity-40',
                        lockForm.familySelectionMode === 'existing_family'
                          ? isDark
                            ? 'bg-stone-100 text-stone-950 border-stone-100'
                            : 'bg-stone-900 text-stone-50 border-stone-900'
                          : isDark
                            ? 'border-stone-700 text-stone-300 hover:bg-stone-800'
                            : 'border-stone-300 text-stone-700 hover:bg-stone-100',
                      )}
                    >
                      Pilih dari Family
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setLockForm((prev) => ({
                          ...prev,
                          familySelectionMode: 'custom_family',
                          lockedFamilyId: '',
                        }))
                      }
                      className={cn(
                        'py-2 px-2.5 border font-semibold text-center transition-colors cursor-pointer',
                        lockForm.familySelectionMode === 'custom_family'
                          ? isDark
                            ? 'bg-stone-100 text-stone-950 border-stone-100'
                            : 'bg-stone-900 text-stone-50 border-stone-900'
                          : isDark
                            ? 'border-stone-700 text-stone-300 hover:bg-stone-800'
                            : 'border-stone-300 text-stone-700 hover:bg-stone-100',
                      )}
                    >
                      Ketik Nama Family
                    </button>
                  </div>
                </div>

                {lockForm.familySelectionMode === 'existing_family' ? (
                  <select
                    aria-label="Pilih Family terakhir tempat akun terkunci"
                    value={lockForm.lockedFamilyId}
                    onChange={(e) => {
                      const fam = families.find((f) => f.id === e.target.value);
                      setLockForm((prev) => ({
                        ...prev,
                        lockedFamilyId: e.target.value,
                        lockedFamilyName: fam ? fam.name || fam.ownerEmail || 'Family Plan' : '',
                        lockedFamilyOwnerEmail: fam?.ownerEmail || '',
                      }));
                    }}
                    className={cn(
                      'w-full px-3 py-2 border text-xs',
                      isDark
                        ? 'bg-stone-900 border-stone-700 text-stone-100'
                        : 'bg-paper border-stone-300 text-stone-900',
                    )}
                  >
                    <option value="">— Pilih Family Terakhir —</option>
                    {families.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name || f.ownerEmail || 'Family Plan'}
                        {f.ownerEmail ? ` (${f.ownerEmail})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      maxLength={120}
                      required
                      value={lockForm.lockedFamilyName}
                      onChange={(e) =>
                        setLockForm((prev) => ({ ...prev, lockedFamilyName: e.target.value }))
                      }
                      placeholder="Nama Family terakhir tempat akun ini menetap"
                      className={cn(
                        'w-full px-3 py-2 border text-xs',
                        isDark
                          ? 'bg-stone-900 border-stone-700 text-stone-100 placeholder:text-stone-500'
                          : 'bg-paper border-stone-300 text-stone-900 placeholder:text-stone-400',
                      )}
                    />
                    <input
                      type="email"
                      maxLength={254}
                      value={lockForm.lockedFamilyOwnerEmail}
                      onChange={(e) =>
                        setLockForm((prev) => ({ ...prev, lockedFamilyOwnerEmail: e.target.value }))
                      }
                      placeholder="Email owner Family terakhir (opsional)"
                      className={cn(
                        'w-full px-3 py-2 border text-xs font-mono',
                        isDark
                          ? 'bg-stone-900 border-stone-700 text-stone-100 placeholder:text-stone-500'
                          : 'bg-paper border-stone-300 text-stone-900 placeholder:text-stone-400',
                      )}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="lock-ends-at" className="block font-semibold">
                    Perkiraan Tanggal Bebas Cooldown (opsional — kosongkan jika lupa)
                  </label>
                  <input
                    id="lock-ends-at"
                    type="date"
                    value={lockForm.cooldownEndsAt}
                    onChange={(e) =>
                      setLockForm((prev) => ({ ...prev, cooldownEndsAt: e.target.value }))
                    }
                    className={cn(
                      'w-full px-2.5 py-2 border text-xs tabular-nums',
                      isDark
                        ? 'bg-stone-900 border-stone-700 text-stone-100'
                        : 'bg-paper border-stone-300 text-stone-900',
                    )}
                  />
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {LOCK_DATE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setLockForm((prev) => ({
                            ...prev,
                            cooldownEndsAt:
                              preset.months === null
                                ? ''
                                : addCalendarMonths(new Date(), preset.months) || '',
                          }))
                        }
                        className={cn(
                          'px-2 py-1 text-[11px] font-semibold border transition-colors cursor-pointer',
                          isDark
                            ? 'border-stone-700 text-stone-300 hover:bg-stone-800'
                            : 'border-stone-300 text-stone-700 hover:bg-stone-100',
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="lock-notes" className="block font-semibold">
                    Catatan (opsional)
                  </label>
                  <textarea
                    id="lock-notes"
                    rows={2}
                    maxLength={300}
                    value={lockForm.notes}
                    onChange={(e) => setLockForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Contoh: Ditolak Google saat pindah sebelumnya, harus tetap di Family ini"
                    className={cn(
                      'w-full px-3 py-2 border text-xs resize-none',
                      isDark
                        ? 'bg-stone-900 border-stone-700 text-stone-100 placeholder:text-stone-500'
                        : 'bg-paper border-stone-300 text-stone-900 placeholder:text-stone-400',
                    )}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFormMode(null);
                      setFormError('');
                    }}
                    className={cn(
                      'px-3.5 py-2 border font-semibold cursor-pointer',
                      isDark
                        ? 'border-stone-700 text-stone-300 hover:bg-stone-800'
                        : 'border-stone-300 text-stone-700 hover:bg-stone-100',
                    )}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {submitting ? 'Menyimpan...' : 'Simpan Status Terkunci'}
                  </button>
                </div>
              </fieldset>
            </form>
          )}

          {/* Primary Action Bar */}
          {!formMode && !historyError && (
            <div className="flex items-center justify-between gap-3">
              <h3 className={cn('font-serif text-base font-bold', isDark ? 'text-stone-100' : 'text-stone-900')}>
                Jejak Keanggotaan ({chronologicalEntries.length})
              </h3>
              <button
                type="button"
                onClick={openCreateForm}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer',
                  isDark
                    ? 'bg-stone-100 text-stone-950 hover:bg-white'
                    : 'bg-stone-900 text-stone-50 hover:bg-stone-800',
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                Catat Riwayat Lama
              </button>
            </div>
          )}

          {/* Inline Create / Edit Form (US-04, US-05) */}
          {(formMode === 'create' || formMode === 'edit') && (
            <form
              onSubmit={handleSubmitForm}
              className={cn(
                'border p-4 space-y-4',
                isDark ? 'border-stone-700 bg-stone-950/60' : 'border-stone-300 bg-white',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-serif text-base font-bold">
                  {formMode === 'edit' ? 'Edit Entri Riwayat' : 'Catat Riwayat Family Lama'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setFormMode(null);
                    setEditingEntry(null);
                    setFormError('');
                  }}
                  disabled={submitting}
                  className={cn(
                    'text-xs underline cursor-pointer',
                    isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-600 hover:text-stone-900',
                  )}
                >
                  Batal
                </button>
              </div>

              {formError && (
                <p
                  role="alert"
                  className={cn(
                    'border px-3 py-2 text-xs font-medium',
                    isDark
                      ? 'border-red-500/40 bg-red-950/40 text-red-200'
                      : 'border-red-700/35 bg-red-50 text-red-800',
                  )}
                >
                  {formError}
                </p>
              )}

              <fieldset disabled={submitting} className="space-y-3.5 text-xs">
                {/* Sumber Family */}
                <div className="space-y-1.5">
                  <span className="block font-semibold">Pilih Family</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const first = families[0];
                        setForm((prev) => ({
                          ...prev,
                          familySelectionMode: 'existing_family',
                          familyId: prev.familyId || first?.id || '',
                          familyNameSnapshot:
                            prev.familyId
                              ? prev.familyNameSnapshot
                              : first?.name || first?.ownerEmail || '',
                          familyOwnerEmailSnapshot:
                            prev.familyId ? prev.familyOwnerEmailSnapshot : first?.ownerEmail || '',
                        }));
                      }}
                      disabled={families.length === 0}
                      className={cn(
                        'py-2 px-2.5 border font-semibold text-center transition-colors cursor-pointer disabled:opacity-40',
                        form.familySelectionMode === 'existing_family'
                          ? isDark
                            ? 'bg-stone-100 text-stone-950 border-stone-100'
                            : 'bg-stone-900 text-stone-50 border-stone-900'
                          : isDark
                            ? 'border-stone-700 text-stone-300 hover:bg-stone-800'
                            : 'border-stone-300 text-stone-700 hover:bg-stone-100',
                      )}
                    >
                      Family yang Ada
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          familySelectionMode: 'custom_family',
                          familyId: '',
                        }))
                      }
                      className={cn(
                        'py-2 px-2.5 border font-semibold text-center transition-colors cursor-pointer',
                        form.familySelectionMode === 'custom_family'
                          ? isDark
                            ? 'bg-stone-100 text-stone-950 border-stone-100'
                            : 'bg-stone-900 text-stone-50 border-stone-900'
                          : isDark
                            ? 'border-stone-700 text-stone-300 hover:bg-stone-800'
                            : 'border-stone-300 text-stone-700 hover:bg-stone-100',
                      )}
                    >
                      Ketik Nama Lama
                    </button>
                  </div>
                </div>

                {form.familySelectionMode === 'existing_family' ? (
                  <div className="space-y-1">
                    <label htmlFor="hist-existing-family" className="block font-semibold">
                      Daftar Family di Trial Manager
                    </label>
                    <select
                      id="hist-existing-family"
                      value={form.familyId}
                      onChange={(e) => handleSelectExistingFamily(e.target.value)}
                      className={cn(
                        'w-full px-3 py-2 border text-xs',
                        isDark
                          ? 'bg-stone-900 border-stone-700 text-stone-100'
                          : 'bg-paper border-stone-300 text-stone-900',
                      )}
                    >
                      <option value="">— Pilih Family —</option>
                      {families.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name || f.ownerEmail || 'Family Plan'}
                          {f.ownerEmail ? ` (${f.ownerEmail})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="hist-custom-name" className="block font-semibold">
                        Nama Family Lama *
                      </label>
                      <input
                        id="hist-custom-name"
                        type="text"
                        maxLength={120}
                        required
                        value={form.familyNameSnapshot}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, familyNameSnapshot: e.target.value }))
                        }
                        placeholder="Contoh: Family PRO #01 (Jan 2026)"
                        className={cn(
                          'w-full px-3 py-2 border text-xs',
                          isDark
                            ? 'bg-stone-900 border-stone-700 text-stone-100 placeholder:text-stone-500'
                            : 'bg-paper border-stone-300 text-stone-900 placeholder:text-stone-400',
                        )}
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="hist-owner-email" className="block font-semibold">
                        Email Owner Family (opsional)
                      </label>
                      <input
                        id="hist-owner-email"
                        type="email"
                        maxLength={254}
                        value={form.familyOwnerEmailSnapshot}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            familyOwnerEmailSnapshot: e.target.value,
                          }))
                        }
                        placeholder="owner-lama@gmail.com"
                        className={cn(
                          'w-full px-3 py-2 border text-xs font-mono',
                          isDark
                            ? 'bg-stone-900 border-stone-700 text-stone-100 placeholder:text-stone-500'
                            : 'bg-paper border-stone-300 text-stone-900 placeholder:text-stone-400',
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="hist-joined-at" className="block font-semibold">
                      Tanggal Masuk *
                    </label>
                    <input
                      id="hist-joined-at"
                      type="date"
                      max={todayIsoDate()}
                      required
                      value={form.joinedAt}
                      onChange={(e) => setForm((prev) => ({ ...prev, joinedAt: e.target.value }))}
                      className={cn(
                        'w-full px-2.5 py-2 border text-xs tabular-nums',
                        isDark
                          ? 'bg-stone-900 border-stone-700 text-stone-100'
                          : 'bg-paper border-stone-300 text-stone-900',
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="hist-left-at" className="block font-semibold">
                      Tanggal Keluar (kosong jika aktif)
                    </label>
                    <input
                      id="hist-left-at"
                      type="date"
                      min={form.joinedAt || undefined}
                      max={todayIsoDate()}
                      value={form.leftAt}
                      onChange={(e) => setForm((prev) => ({ ...prev, leftAt: e.target.value }))}
                      className={cn(
                        'w-full px-2.5 py-2 border text-xs tabular-nums',
                        isDark
                          ? 'bg-stone-900 border-stone-700 text-stone-100'
                          : 'bg-paper border-stone-300 text-stone-900',
                      )}
                    />
                  </div>
                </div>

                {form.leftAt && (
                  <div className="space-y-1">
                    <label htmlFor="hist-leave-reason" className="block font-semibold">
                      Alasan Keluar
                    </label>
                    <select
                      id="hist-leave-reason"
                      value={form.leaveReason}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, leaveReason: e.target.value }))
                      }
                      className={cn(
                        'w-full px-3 py-2 border text-xs',
                        isDark
                          ? 'bg-stone-900 border-stone-700 text-stone-100'
                          : 'bg-paper border-stone-300 text-stone-900',
                      )}
                    >
                      <option value="family_downgraded_free">Family PRO turun ke FREE</option>
                      <option value="family_expired">Family expired</option>
                      <option value="manual_move">Pindah ke Family lain</option>
                      <option value="other">Lainnya</option>
                    </select>
                  </div>
                )}

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.countsForCooldown}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, countsForCooldown: e.target.checked }))
                    }
                    className="mt-0.5"
                  />
                  <span>
                    Hitung untuk aturan cooldown 12 bulan Google Family{' '}
                    <span className="opacity-70">(hapus centang jika hanya koreksi lokal)</span>
                  </span>
                </label>

                <div className="space-y-1">
                  <label htmlFor="hist-notes" className="block font-semibold">
                    Catatan (opsional, maks 300 karakter)
                  </label>
                  <textarea
                    id="hist-notes"
                    rows={2}
                    maxLength={300}
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Contoh: PRO hilang di tengah bulan, terpaksa pindah ke Family B"
                    className={cn(
                      'w-full px-3 py-2 border text-xs resize-none',
                      isDark
                        ? 'bg-stone-900 border-stone-700 text-stone-100 placeholder:text-stone-500'
                        : 'bg-paper border-stone-300 text-stone-900 placeholder:text-stone-400',
                    )}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFormMode(null);
                      setEditingEntry(null);
                      setFormError('');
                    }}
                    className={cn(
                      'px-3.5 py-2 border font-semibold cursor-pointer',
                      isDark
                        ? 'border-stone-700 text-stone-300 hover:bg-stone-800'
                        : 'border-stone-300 text-stone-700 hover:bg-stone-100',
                    )}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-4 py-2 font-semibold transition-colors cursor-pointer disabled:opacity-50',
                      isDark
                        ? 'bg-stone-100 text-stone-950 hover:bg-white'
                        : 'bg-stone-900 text-stone-50 hover:bg-stone-800',
                    )}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {submitting
                      ? 'Menyimpan...'
                      : formMode === 'edit'
                        ? 'Simpan Perubahan'
                        : 'Simpan Riwayat'}
                  </button>
                </div>
              </fieldset>
            </form>
          )}

          {/* Timeline List */}
          {historyLoading ? (
            <div className="space-y-3" aria-busy="true" aria-label="Memuat timeline riwayat">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'border p-4 animate-pulse space-y-2',
                    isDark ? 'border-stone-800 bg-stone-950/40' : 'border-stone-200 bg-white',
                  )}
                >
                  <div className={cn('h-4 w-40', isDark ? 'bg-stone-800' : 'bg-stone-200')} />
                  <div className={cn('h-3 w-56', isDark ? 'bg-stone-800/70' : 'bg-stone-200/70')} />
                </div>
              ))}
            </div>
          ) : chronologicalEntries.length === 0 ? (
            <div
              className={cn(
                'border border-dashed px-5 py-10 text-center space-y-3',
                isDark ? 'border-stone-800 bg-stone-950/30' : 'border-stone-300 bg-white/70',
              )}
            >
              <p className="text-sm font-medium">
                Belum ada catatan riwayat Family untuk akun ini.
              </p>
              <p className={cn('text-xs max-w-xs mx-auto', isDark ? 'text-stone-400' : 'text-stone-600')}>
                Jika akun ini sudah pernah masuk Family sebelum fitur ini aktif, tambahkan riwayat lamanya agar hitungan cooldown 12 bulan akurat.
              </p>
              {!formMode && (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold cursor-pointer',
                    isDark
                      ? 'bg-stone-100 text-stone-950 hover:bg-white'
                      : 'bg-stone-900 text-stone-50 hover:bg-stone-800',
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Catat Riwayat Lama
                </button>
              )}
            </div>
          ) : (
            <ol
              className={cn(
                'relative pl-5 space-y-3 border-l',
                isDark ? 'border-stone-700' : 'border-stone-300',
              )}
            >
              {chronologicalEntries.map((entry) => {
                const isConfirmingDelete = confirmDeleteId === entry.id;
                const durationDays = entry.leftAt
                  ? diffCalendarDays(entry.joinedAt, entry.leftAt)
                  : diffCalendarDays(entry.joinedAt, new Date());

                return (
                  <li key={entry.id} className="relative">
                    {/* Timeline Node Dot */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute -left-[25px] top-4 w-2.5 h-2.5 border',
                        !entry.countsForCooldown
                          ? isDark
                            ? 'bg-stone-800 border-stone-600'
                            : 'bg-stone-200 border-stone-400'
                          : entry.isSwitchEvent
                            ? isDark
                              ? 'bg-red-500 border-red-300'
                              : 'bg-red-700 border-red-900'
                            : !entry.leftAt
                              ? isDark
                                ? 'bg-emerald-400 border-emerald-200'
                                : 'bg-emerald-700 border-emerald-900'
                              : isDark
                                ? 'bg-gold-400 border-gold-300'
                                : 'bg-gold-700 border-gold-900',
                      )}
                    />

                    <div
                      className={cn(
                        'border p-3.5 space-y-2',
                        !entry.countsForCooldown && 'opacity-75',
                        isDark
                          ? 'border-stone-800 bg-stone-950/60'
                          : 'border-stone-200 bg-white',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {entry.sequenceNumber && (
                              <span
                                className={cn(
                                  'font-mono text-[11px] font-bold tabular-nums',
                                  isDark ? 'text-gold-400' : 'text-gold-700',
                                )}
                              >
                                #{entry.sequenceNumber}
                              </span>
                            )}
                            <span className="font-semibold text-sm truncate">
                              {entry.familyNameSnapshot}
                            </span>
                          </div>
                          {entry.familyOwnerEmailSnapshot && (
                            <p className={cn('text-[11px] font-mono truncate', isDark ? 'text-stone-400' : 'text-stone-500')}>
                              {entry.familyOwnerEmailSnapshot}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditForm(entry)}
                            aria-label={`Edit riwayat ${entry.familyNameSnapshot}`}
                            className={cn(
                              'p-1 transition-colors cursor-pointer',
                              isDark
                                ? 'text-stone-400 hover:text-gold-400'
                                : 'text-stone-500 hover:text-gold-700',
                            )}
                            title="Edit entri"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteId(isConfirmingDelete ? null : entry.id)
                            }
                            aria-label={`Hapus riwayat ${entry.familyNameSnapshot}`}
                            className={cn(
                              'p-1 transition-colors cursor-pointer',
                              isDark
                                ? 'text-stone-400 hover:text-red-400'
                                : 'text-stone-500 hover:text-red-700',
                            )}
                            title="Hapus entri"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Date range */}
                      <div
                        className={cn(
                          'text-xs tabular-nums flex items-center gap-1.5 flex-wrap',
                          isDark ? 'text-stone-300' : 'text-stone-700',
                        )}
                      >
                        <span>Masuk: {formatDateId(entry.joinedAt)}</span>
                        <span className="opacity-40">→</span>
                        <span>
                          {entry.leftAt ? `Keluar: ${formatDateId(entry.leftAt)}` : 'Masih Aktif'}
                        </span>
                        {durationDays !== null && durationDays >= 0 && (
                          <span className={cn('text-[11px]', isDark ? 'text-stone-400' : 'text-stone-500')}>
                            ({durationDays} hari)
                          </span>
                        )}
                      </div>

                      {/* Event Tags */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!entry.countsForCooldown ? (
                          <span
                            className={cn(
                              'px-1.5 py-0.5 text-[10px] font-semibold border',
                              isDark
                                ? 'border-stone-700 bg-stone-800 text-stone-300'
                                : 'border-stone-300 bg-stone-100 text-stone-700',
                            )}
                          >
                            Koreksi Lokal (Non-Switch)
                          </span>
                        ) : entry.isSwitchEvent ? (
                          <span
                            className={cn(
                              'px-1.5 py-0.5 text-[10px] font-semibold border',
                              isDark
                                ? 'border-red-500/40 bg-red-950/50 text-red-200'
                                : 'border-red-700/35 bg-red-50 text-red-800',
                            )}
                          >
                            Pindah / Switch (Picu Cooldown 12 Bln)
                          </span>
                        ) : entry.sequenceNumber === 1 ? (
                          <span
                            className={cn(
                              'px-1.5 py-0.5 text-[10px] font-semibold border',
                              isDark
                                ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-300'
                                : 'border-emerald-700/30 bg-emerald-50 text-emerald-800',
                            )}
                          >
                            Gabung Awal
                          </span>
                        ) : null}

                        {entry.leaveReason && entry.leaveReason !== 'still_active' && (
                          <span
                            className={cn(
                              'px-1.5 py-0.5 text-[10px] font-medium border',
                              entry.leaveReason === 'family_downgraded_free'
                                ? isDark
                                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                                  : 'border-amber-700/35 bg-amber-50 text-amber-900'
                                : isDark
                                  ? 'border-stone-700 text-stone-400'
                                  : 'border-stone-300 text-stone-600',
                            )}
                          >
                            {LEAVE_REASON_LABELS[entry.leaveReason] || entry.leaveReason}
                          </span>
                        )}

                        <span className={cn('text-[10px]', isDark ? 'text-stone-500' : 'text-stone-500')}>
                          {SOURCE_LABELS[entry.source] || entry.source}
                        </span>
                      </div>

                      {(entry.notes || entry.overrideNote) && (
                        <p className={cn('text-xs italic', isDark ? 'text-stone-400' : 'text-stone-600')}>
                          {entry.notes || entry.overrideNote}
                        </p>
                      )}

                      {/* Inline Delete Confirmation (AC-05-01) */}
                      {isConfirmingDelete && (
                        <div
                          className={cn(
                            'mt-2 p-3 border space-y-2 text-xs',
                            isDark
                              ? 'border-red-500/40 bg-red-950/35 text-red-200'
                              : 'border-red-700/35 bg-red-50 text-red-900',
                          )}
                        >
                          <p>
                            Menghapus catatan riwayat ini hanya mempengaruhi histori &amp; hitungan cooldown, bukan keanggotaan aktif saat ini.
                          </p>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={Boolean(deletingId)}
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 border border-current font-semibold cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === entry.id}
                              onClick={() => handleConfirmDelete(entry.id)}
                              className="px-2.5 py-1 bg-red-700 text-white font-semibold hover:bg-red-800 cursor-pointer disabled:opacity-50"
                            >
                              {deletingId === entry.id ? 'Menghapus...' : 'Ya, Hapus'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
