import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  HardDrive,
  Users,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { cn } from '../../utils';
import { MAX_FAMILY_SLOTS } from '../../lib/familyUtils';
import { revealFamilyPassword } from '../../lib/api';
import { evaluateCooldownActionWarning } from '../../lib/cooldownLogic';
import CooldownGuardNotice, {
  validateCooldownGuardState,
} from '../cooldown/CooldownGuardNotice';

const INITIAL_GUARD_STATE = {
  overrideReasonType: '',
  overrideNote: '',
  overrideConfirmed: false,
};

function defaultMemberName(email) {
  if (!email) return '';
  const prefix = email.split('@')[0] || email;
  return prefix.slice(0, 80);
}

export default function FamilyRecommendationDrawer({
  isOpen,
  isDark,
  targetAccount,
  cooldownSummary = null,
  historyError = null,
  onRetryHistory,
  leavePreviousFamilyId = null,
  leavePreviousFamilyName = null,
  recommendations,
  onClose,
  onAssignSuccess,
  onAssign,
  onCopyFeedback,
}) {
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [memberName, setMemberName] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [revealedPassword, setRevealedPassword] = useState(null);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [guardState, setGuardState] = useState(INITIAL_GUARD_STATE);
  const [guardError, setGuardError] = useState('');

  useEffect(() => {
    if (!isOpen || !targetAccount) return;
    setSelectedFamilyId(recommendations[0]?.family?.id || null);
    setMemberName(defaultMemberName(targetAccount.email));
    setCopiedKey('');
    setRevealedPassword(null);
    setPasswordError('');
    setSubmitError('');
    setGuardState(INITIAL_GUARD_STATE);
    setGuardError('');
  }, [isOpen, targetAccount, recommendations]);

  useEffect(() => {
    setRevealedPassword(null);
    setPasswordError('');
    setSubmitError('');
    setGuardState(INITIAL_GUARD_STATE);
    setGuardError('');
  }, [selectedFamilyId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, submitting, onClose]);

  const selectedRec = recommendations.find((r) => r.family.id === selectedFamilyId) || null;
  const isLastSwitchCandidate = Boolean(
    cooldownSummary &&
      (cooldownSummary.status === 'safe_first_family' ||
        cooldownSummary.status === 'ready_last_switch'),
  );

  const warningEvaluation = useMemo(() => {
    if (!targetAccount || !selectedRec) return null;
    return evaluateCooldownActionWarning({
      summary: cooldownSummary,
      action: leavePreviousFamilyId ? 'move' : 'join',
      targetFamily: {
        id: selectedRec.family.id,
        name: selectedRec.family.name || selectedRec.family.ownerEmail,
        ownerEmail: selectedRec.family.ownerEmail,
      },
      currentFamilyName: leavePreviousFamilyName,
      historyLoadError: historyError,
    });
  }, [
    targetAccount,
    selectedRec,
    cooldownSummary,
    leavePreviousFamilyId,
    leavePreviousFamilyName,
    historyError,
  ]);

  const guardCheck = useMemo(
    () => validateCooldownGuardState(warningEvaluation, guardState, false),
    [warningEvaluation, guardState],
  );

  if (!isOpen || !targetAccount) return null;

  const copyText = async (key, text, label) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      onCopyFeedback?.(label);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? '' : prev)), 2000);
    } catch {
      onCopyFeedback?.('Gagal menyalin ke clipboard.', 'error');
    }
  };

  const handleRevealPassword = async () => {
    if (!selectedRec || loadingPassword) return;
    if (revealedPassword !== null) {
      setRevealedPassword(null);
      return;
    }
    setLoadingPassword(true);
    setPasswordError('');
    try {
      const res = await revealFamilyPassword(selectedRec.family.id);
      if (res.success && res.data?.password) {
        setRevealedPassword(res.data.password);
      } else {
        setPasswordError(res.error || 'Sandi owner tidak tersedia untuk family ini.');
      }
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleConfirmAssign = async () => {
    if (!selectedRec || submitting) return;
    const trimmed = memberName.trim();
    if (!trimmed || trimmed.length > 80) {
      setSubmitError('Nama anggota wajib diisi (maksimal 80 karakter).');
      return;
    }

    if (warningEvaluation) {
      const check = validateCooldownGuardState(warningEvaluation, guardState, false);
      if (!check.canProceed) {
        setGuardError(check.error);
        return;
      }
    }

    setSubmitting(true);
    setSubmitError('');
    setGuardError('');
    try {
      const isCritical = warningEvaluation?.level === 'critical_cooldown_locked';
      const res = await onAssign(
        targetAccount.id,
        selectedRec.family.id,
        trimmed,
        selectedRec.family.name,
        {
          leavePreviousFamilyId: leavePreviousFamilyId || null,
          overrideReasonType: isCritical
            ? guardState.overrideReasonType || null
            : leavePreviousFamilyId
              ? 'family_downgraded_free'
              : null,
          overrideNote: isCritical ? guardState.overrideNote?.trim() || null : null,
        },
      );
      if (res.success) {
        onAssignSuccess?.(targetAccount.email, selectedRec.family.name);
        onClose();
      } else {
        setSubmitError(res.error || 'Gagal mencatat akun ke Family.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-stone-950/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="family-rec-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <aside
        className={cn(
          'w-full max-w-lg h-full flex flex-col border-l shadow-2xl',
          isDark ? 'bg-stone-900 border-stone-800 text-stone-100' : 'bg-paper border-stone-200 text-stone-900',
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-start justify-between gap-4 px-6 py-5 border-b shrink-0',
            isDark ? 'border-stone-800' : 'border-stone-200',
          )}
        >
          <div className="min-w-0">
            <h2
              id="family-rec-title"
              className={cn('font-serif text-xl font-bold tracking-tight', isDark ? 'text-white' : 'text-stone-900')}
            >
              Cari Family PRO Unik
            </h2>
            <p className={cn('text-xs mt-1 font-mono truncate', isDark ? 'text-gold-400' : 'text-gold-700')}>
              {targetAccount.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup panel rekomendasi"
            className={cn(
              'p-1.5 transition-colors disabled:opacity-40',
              isDark ? 'text-stone-400 hover:text-stone-100 hover:bg-stone-800' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200',
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {recommendations.length === 0 ? (
            <div
              className={cn(
                'border border-dashed px-5 py-10 text-center space-y-3',
                isDark ? 'border-stone-700 bg-stone-950/40' : 'border-stone-300 bg-white',
              )}
            >
              <ShieldAlert className={cn('w-8 h-8 mx-auto', isDark ? 'text-stone-500' : 'text-stone-400')} />
              <p className="text-sm font-semibold">
                Belum ada Family PRO yang memenuhi syarat
              </p>
              <p className={cn('text-xs leading-relaxed max-w-sm mx-auto', isDark ? 'text-stone-400' : 'text-stone-600')}>
                Belum ada Family PRO aktif yang aman untuk ditempati saat ini. Jangan keluarkan akun dulu agar jatah pindah 12 bulan tidak terbuang.
              </p>
            </div>
          ) : (
            <>
              {/* US-07: Banner konteks jatah pindah terakhir */}
              {isLastSwitchCandidate && (
                <div
                  className={cn(
                    'border px-3.5 py-2.5 text-xs leading-relaxed flex items-start gap-2',
                    isDark
                      ? 'border-amber-500/40 bg-amber-950/30 text-amber-100'
                      : 'border-amber-700/35 bg-amber-50 text-amber-950',
                  )}
                >
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Jatah pindah terakhir dalam 12 bulan — disarankan pilih Family dengan masa aktif paling panjang &amp; storage lega.
                  </span>
                </div>
              )}

              {/* Step 1: Pilih Family */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-sans text-xs font-bold uppercase tracking-wider opacity-75">
                    1. Pilih Family PRO Bebas Konflik ({recommendations.length})
                  </h3>
                  <span className={cn('text-xs', isDark ? 'text-stone-400' : 'text-stone-500')}>
                    {isLastSwitchCandidate ? 'Urut paling stabil' : 'Urut sisa Drive terbesar'}
                  </span>
                </div>

                <div
                  className={cn(
                    'border divide-y',
                    isDark ? 'border-stone-800 divide-stone-800 bg-stone-950/40' : 'border-stone-200 divide-stone-200 bg-white',
                  )}
                >
                  {recommendations.map((rec, idx) => {
                    const isSelected = rec.family.id === selectedFamilyId;
                    const showTopStableBadge = isLastSwitchCandidate && idx === 0;
                    return (
                      <button
                        key={rec.family.id}
                        type="button"
                        onClick={() => setSelectedFamilyId(rec.family.id)}
                        className={cn(
                          'w-full text-left px-4 py-3 transition-colors duration-150 flex items-start justify-between gap-3 cursor-pointer',
                          isSelected
                            ? isDark
                              ? 'bg-gold-500/12 text-stone-50'
                              : 'bg-gold-500/12 text-stone-950'
                            : isDark
                              ? 'hover:bg-stone-800/60 text-stone-200'
                              : 'hover:bg-stone-50 text-stone-800',
                        )}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">
                              {rec.family.name || rec.family.ownerEmail}
                            </span>
                            {showTopStableBadge && (
                              <span
                                className={cn(
                                  'inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold border',
                                  isDark
                                    ? 'border-gold-400/50 bg-gold-500/15 text-gold-300'
                                    : 'border-gold-700/40 bg-gold-300/30 text-gold-700',
                                )}
                              >
                                Paling Stabil
                              </span>
                            )}
                            {rec.isStorageLega && (
                              <span
                                className={cn(
                                  'inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold border',
                                  isDark
                                    ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300'
                                    : 'border-emerald-700/30 bg-emerald-50 text-emerald-800',
                                )}
                              >
                                Storage Lega
                              </span>
                            )}
                          </div>
                          <p className={cn('text-xs font-mono truncate', isDark ? 'text-stone-400' : 'text-stone-500')}>
                            Owner: {rec.family.ownerEmail || '—'}
                          </p>
                          <div className="flex items-center gap-3 text-xs tabular-nums flex-wrap pt-0.5">
                            <span className="inline-flex items-center gap-1">
                              <HardDrive className="w-3.5 h-3.5 opacity-70" />
                              {rec.storageLabel}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 opacity-70" />
                              {rec.slotsUsed}/{MAX_FAMILY_SLOTS} slot terisi
                            </span>
                            {rec.daysRemaining !== null && (
                              <span className={cn(isDark ? 'text-stone-400' : 'text-stone-500')}>
                                {rec.daysRemaining}h tersisa
                              </span>
                            )}
                          </div>
                          {!rec.hasLiveDrive && (
                            <p className={cn('text-[11px]', isDark ? 'text-stone-400' : 'text-stone-500')}>
                              Data penyimpanan Google Drive belum terhubung — menampilkan sisa kapasitas manual.
                            </p>
                          )}
                        </div>
                        <span
                          aria-hidden="true"
                          className={cn(
                            'mt-0.5 w-4 h-4 rounded-full border shrink-0 flex items-center justify-center',
                            isSelected
                              ? isDark
                                ? 'border-gold-400 bg-gold-400 text-stone-950'
                                : 'border-gold-700 bg-gold-700 text-white'
                              : isDark
                                ? 'border-stone-600'
                                : 'border-stone-400',
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Panduan Invite Manual Google Family */}
              {selectedRec && (
                <div
                  className={cn(
                    'border px-4 py-4 space-y-3.5',
                    isDark ? 'border-stone-800 bg-stone-950/60' : 'border-stone-200 bg-white',
                  )}
                >
                  <h3 className="font-sans text-xs font-bold uppercase tracking-wider opacity-75">
                    2. Undang & Accept Manual di Google Family
                  </h3>
                  <p className={cn('text-xs leading-relaxed', isDark ? 'text-stone-400' : 'text-stone-600')}>
                    Kirim undangan dari akun Owner <strong>{selectedRec.family.ownerEmail}</strong>, lalu terima (<em>accept</em>)
                    dari akun <strong>{targetAccount.email}</strong> sebelum mencatatnya di bawah.
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs opacity-75">Email akun FREE yang diundang</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            'free-email',
                            targetAccount.email,
                            `Email ${targetAccount.email} berhasil disalin. Tempelkan di halaman undangan Google Family.`,
                          )
                        }
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border transition-colors',
                          isDark
                            ? 'border-stone-700 hover:bg-stone-800 text-stone-200'
                            : 'border-stone-300 hover:bg-stone-100 text-stone-800',
                        )}
                      >
                        {copiedKey === 'free-email' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === 'free-email' ? 'Tersalin' : 'Salin Email FREE'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs opacity-75">Akun Owner Family tujuan</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              'owner-email',
                              selectedRec.family.ownerEmail,
                              `Email owner ${selectedRec.family.ownerEmail} berhasil disalin.`,
                            )
                          }
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border transition-colors',
                            isDark
                              ? 'border-stone-700 hover:bg-stone-800 text-stone-200'
                              : 'border-stone-300 hover:bg-stone-100 text-stone-800',
                          )}
                        >
                          {copiedKey === 'owner-email' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          Salin Owner
                        </button>
                        <button
                          type="button"
                          onClick={handleRevealPassword}
                          disabled={loadingPassword}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border transition-colors disabled:opacity-50',
                            isDark
                              ? 'border-stone-700 hover:bg-stone-800 text-stone-200'
                              : 'border-stone-300 hover:bg-stone-100 text-stone-800',
                          )}
                        >
                          {revealedPassword !== null ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          {loadingPassword ? 'Memuat…' : revealedPassword !== null ? 'Tutup Sandi' : 'Lihat Sandi'}
                        </button>
                      </div>
                    </div>

                    {revealedPassword !== null && (
                      <div
                        className={cn(
                          'flex items-center justify-between gap-2 border px-3 py-2 text-xs font-mono',
                          isDark ? 'border-stone-800 bg-stone-900' : 'border-stone-200 bg-stone-50',
                        )}
                      >
                        <span className="truncate">{revealedPassword}</span>
                        <button
                          type="button"
                          onClick={() => copyText('owner-pass', revealedPassword, 'Sandi owner berhasil disalin.')}
                          className="shrink-0 underline font-sans font-semibold"
                        >
                          {copiedKey === 'owner-pass' ? 'Tersalin' : 'Salin'}
                        </button>
                      </div>
                    )}

                    {passwordError && (
                      <p className={cn('text-xs', isDark ? 'text-amber-300' : 'text-amber-800')}>
                        {passwordError}
                      </p>
                    )}

                    <a
                      href="https://families.google.com/families"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'mt-1 w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold border transition-colors',
                        isDark
                          ? 'border-gold-500/40 bg-gold-500/10 text-gold-300 hover:bg-gold-500/20'
                          : 'border-gold-700/35 bg-gold-500/10 text-gold-700 hover:bg-gold-500/20',
                      )}
                    >
                      Buka Pengaturan Google Family
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* Step 3: Catat di Trial Manager */}
              {selectedRec && (
                <div className="space-y-2.5">
                  <h3 className="font-sans text-xs font-bold uppercase tracking-wider opacity-75">
                    3. Catat di Trial Manager Setelah Accept
                  </h3>
                  <div>
                    <label
                      htmlFor="cockpit-member-name"
                      className={cn('block text-xs font-semibold mb-1.5', isDark ? 'text-stone-300' : 'text-stone-700')}
                    >
                      Nama Anggota (ditandai sebagai Pribadi)
                    </label>
                    <input
                      id="cockpit-member-name"
                      type="text"
                      maxLength={80}
                      value={memberName}
                      disabled={submitting}
                      onChange={(e) => {
                        setSubmitError('');
                        setMemberName(e.target.value);
                      }}
                      placeholder="Mis. qulhu09"
                      className={cn(
                        'w-full text-sm border px-3 py-2 transition-colors',
                        isDark
                          ? 'bg-stone-950 border-stone-800 text-stone-100 focus:border-gold-500'
                          : 'bg-white border-stone-300 text-stone-900 focus:border-gold-700',
                      )}
                    />
                  </div>

                  {/* AC-07-02: Catatan kehati-hatian bila pilih Family dengan masa aktif singkat saat jatah terakhir */}
                  {isLastSwitchCandidate &&
                    selectedRec.daysRemaining !== null &&
                    selectedRec.daysRemaining <= 30 && (
                      <p
                        className={cn(
                          'border px-3 py-2 text-xs',
                          isDark
                            ? 'border-amber-500/35 bg-amber-950/25 text-amber-200'
                            : 'border-amber-700/30 bg-amber-50 text-amber-900',
                        )}
                      >
                        Masa aktif sisa {selectedRec.daysRemaining} hari — pastikan Family ini stabil sebelum memakai jatah pindah terakhir.
                      </p>
                    )}

                  {/* US-03: Peringatan Cooldown Bertingkat sebelum Catat Masuk */}
                  {warningEvaluation &&
                    (warningEvaluation.level !== 'none' || warningEvaluation.isSameFamilyRejoin) && (
                      <CooldownGuardNotice
                        evaluation={warningEvaluation}
                        isDark={isDark}
                        guardState={guardState}
                        onChangeGuardState={(next) => {
                          setGuardState(next);
                          setGuardError('');
                        }}
                        onRetryHistory={onRetryHistory}
                        allowLocalCorrection={false}
                        validationError={guardError}
                      />
                    )}

                  {submitError && (
                    <div
                      role="alert"
                      className={cn(
                        'flex items-start gap-2 border px-3.5 py-2.5 text-xs',
                        isDark
                          ? 'border-red-500/40 bg-red-500/10 text-red-200'
                          : 'border-red-600/35 bg-red-50 text-red-800',
                      )}
                    >
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className={cn(
            'flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0',
            isDark ? 'border-stone-800 bg-stone-950/40' : 'border-stone-200 bg-stone-50',
          )}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={cn(
              'px-4 py-2 text-xs font-semibold border transition-colors disabled:opacity-50 cursor-pointer',
              isDark
                ? 'border-stone-700 text-stone-300 hover:bg-stone-800'
                : 'border-stone-300 text-stone-700 hover:bg-stone-200',
            )}
          >
            Batal
          </button>
          {selectedRec && (
            <button
              type="button"
              onClick={handleConfirmAssign}
              disabled={submitting || !guardCheck.canProceed}
              className={cn(
                'inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer',
                warningEvaluation?.level === 'critical_cooldown_locked'
                  ? 'bg-red-700 text-white hover:bg-red-800'
                  : isDark
                    ? 'bg-stone-50 text-stone-900 hover:bg-stone-200'
                    : 'bg-stone-900 text-stone-50 hover:bg-stone-800',
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {submitting
                ? 'Mencatat…'
                : warningEvaluation?.level === 'critical_cooldown_locked'
                  ? 'Tetap Catat / Override'
                  : leavePreviousFamilyId
                    ? 'Catat Sudah Pindah'
                    : 'Catat Sudah Masuk Family'}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
