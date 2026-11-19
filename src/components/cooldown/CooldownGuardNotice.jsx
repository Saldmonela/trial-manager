import React from 'react';
import { AlertTriangle, ShieldAlert, Info, RefreshCw } from 'lucide-react';
import { cn } from '../../utils';

const OVERRIDE_OPTIONS = [
  {
    value: 'local_correction',
    label: 'Koreksi salah input di Trial Manager (tidak benar-benar keluar/pindah di Google)',
  },
  {
    value: 'family_downgraded_free',
    label: 'Family asal sudah mati / turun ke FREE — sadar risiko cooldown',
  },
  {
    value: 'emergency_other',
    label: 'Alasan darurat lainnya (wajib isi catatan)',
  },
];

/**
 * Validasi kelengkapan konfirmasi override sadar untuk peringatan Tingkat 2 / Fail-Safe (AC-03-02, AC-03-04).
 */
export function validateCooldownGuardState(evaluation, guardState, allowLocalCorrection = true) {
  if (!evaluation) return { canProceed: true, error: '' };
  if (evaluation.level === 'fail_safe_unverified') {
    return {
      canProceed: false,
      error: 'Status cooldown belum terverifikasi. Muat ulang data terlebih dahulu.',
    };
  }
  if (evaluation.level !== 'critical_cooldown_locked') {
    return { canProceed: true, error: '' };
  }

  const validReasons = allowLocalCorrection
    ? ['local_correction', 'family_downgraded_free', 'emergency_other']
    : ['family_downgraded_free', 'emergency_other'];

  if (!guardState?.overrideReasonType || !validReasons.includes(guardState.overrideReasonType)) {
    return { canProceed: false, error: 'Pilih alasan override terlebih dahulu.' };
  }

  if (guardState.overrideReasonType === 'emergency_other') {
    const trimmed = (guardState.overrideNote || '').trim();
    if (trimmed.length < 5 || trimmed.length > 200) {
      return {
        canProceed: false,
        error: 'Isi alasan minimal 5 karakter (maksimal 200 karakter).',
      };
    }
  } else if ((guardState.overrideNote || '').length > 200) {
    return { canProceed: false, error: 'Catatan maksimal 200 karakter.' };
  }

  if (!guardState.overrideConfirmed) {
    return { canProceed: false, error: 'Centang kotak konfirmasi sadar risiko terlebih dahulu.' };
  }

  return { canProceed: true, error: '' };
}

/**
 * Blok peringatan bertingkat reusable untuk Modal Hapus Member, Modal Tambah Member, dan Drawer Rekomendasi.
 * Memenuhi BR-03, BR-04, AC-03-01, AC-03-02, AC-03-04.
 */
export default function CooldownGuardNotice({
  evaluation,
  isDark,
  guardState,
  onChangeGuardState,
  onRetryHistory,
  allowLocalCorrection = true,
  showRemovalModeSelector = false,
  removalMode = 'google_leave',
  onChangeRemovalMode,
  validationError = '',
}) {
  if (!evaluation) return null;

  // Fail-Safe Unverified (NF-04, AC-03-04)
  if (evaluation.level === 'fail_safe_unverified') {
    return (
      <div
        role="alert"
        className={cn(
          'border p-3.5 text-left space-y-2.5 text-xs leading-relaxed',
          isDark
            ? 'border-red-500/45 bg-red-950/40 text-red-200'
            : 'border-red-700/40 bg-red-50 text-red-900',
        )}
      >
        <div className="flex items-start gap-2 font-semibold">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{evaluation.title}</span>
        </div>
        <p>{evaluation.message}</p>
        {onRetryHistory && (
          <button
            type="button"
            onClick={onRetryHistory}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer',
              isDark
                ? 'border-red-400/50 hover:bg-red-900/40 text-red-100'
                : 'border-red-700/40 hover:bg-red-100 text-red-900',
            )}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Muat Ulang Status
          </button>
        )}
      </div>
    );
  }

  // OQ-02: Info masuk kembali ke Family yang sama (tidak dihitung Switch)
  if (evaluation.level === 'none' && evaluation.isSameFamilyRejoin) {
    return (
      <div
        role="status"
        className={cn(
          'border p-3 text-left text-xs leading-relaxed flex items-start gap-2',
          isDark
            ? 'border-stone-700 bg-stone-800/60 text-stone-200'
            : 'border-stone-300 bg-stone-100 text-stone-800',
        )}
      >
        <Info className="w-4 h-4 shrink-0 mt-0.5 opacity-80" />
        <div className="space-y-1">
          <p className="font-semibold">{evaluation.title}</p>
          <p className="opacity-90">{evaluation.message}</p>
        </div>
      </div>
    );
  }

  // Aman penuh (belum pernah gabung) — hanya tampilkan pemilih mode keluar bila di modal hapus
  if (evaluation.level === 'none') {
    if (!showRemovalModeSelector) return null;
    return (
      <div
        className={cn(
          'border p-3.5 text-left space-y-2 text-xs',
          isDark ? 'border-stone-800 bg-stone-900/60 text-stone-200' : 'border-stone-200 bg-stone-50 text-stone-800',
        )}
      >
        <p className="font-semibold">Jenis penghapusan data:</p>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            name="removal_mode"
            value="google_leave"
            checked={removalMode === 'google_leave'}
            onChange={() => onChangeRemovalMode?.('google_leave')}
            className="mt-0.5 accent-stone-900"
          />
          <span>Keluar / Pindah Family di Google (catat tanggal keluar di riwayat)</span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            name="removal_mode"
            value="local_correction"
            checked={removalMode === 'local_correction'}
            onChange={() => onChangeRemovalMode?.('local_correction')}
            className="mt-0.5 accent-stone-900"
          />
          <span>Koreksi salah input di Trial Manager (tidak keluar di Google — abaikan untuk cooldown)</span>
        </label>
      </div>
    );
  }

  // Tingkat 1 — Amber / Waspada (Jatah Pindah Terakhir)
  if (evaluation.level === 'caution_last_switch') {
    return (
      <div
        role="alert"
        className={cn(
          'border p-3.5 text-left space-y-2.5 text-xs leading-relaxed',
          isDark
            ? 'border-amber-500/45 bg-amber-950/35 text-amber-100'
            : 'border-amber-700/35 bg-amber-50 text-amber-950',
        )}
      >
        <div className="flex items-start gap-2 font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{evaluation.title}</span>
        </div>
        {evaluation.summaryLine && (
          <p className="font-medium opacity-90">{evaluation.summaryLine}</p>
        )}
        <p>{evaluation.message}</p>

        {showRemovalModeSelector && (
          <div
            className={cn(
              'pt-2.5 mt-1 border-t space-y-2',
              isDark ? 'border-amber-500/25' : 'border-amber-700/20',
            )}
          >
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="removal_mode"
                value="google_leave"
                checked={removalMode === 'google_leave'}
                onChange={() => onChangeRemovalMode?.('google_leave')}
                className="mt-0.5"
              />
              <span>Keluar / Pindah Family di Google (catat di riwayat)</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="removal_mode"
                value="local_correction"
                checked={removalMode === 'local_correction'}
                onChange={() => onChangeRemovalMode?.('local_correction')}
                className="mt-0.5"
              />
              <span>Koreksi salah input (tidak keluar di Google — jangan hitung cooldown)</span>
            </label>
          </div>
        )}
      </div>
    );
  }

  // Tingkat 2 — Merah / Kritis (Sedang Cooldown 12 Bulan + Override Sadar)
  const options = allowLocalCorrection
    ? OVERRIDE_OPTIONS
    : OVERRIDE_OPTIONS.filter((o) => o.value !== 'local_correction');

  return (
    <div
      role="alert"
      className={cn(
        'border p-4 text-left space-y-3 text-xs leading-relaxed',
        isDark
          ? 'border-red-500/50 bg-red-950/45 text-red-100'
          : 'border-red-700/45 bg-red-50 text-red-950',
      )}
    >
      <div className="flex items-start gap-2 font-bold text-sm">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{evaluation.title}</span>
      </div>
      {evaluation.summaryLine && (
        <p className="font-medium opacity-90">{evaluation.summaryLine}</p>
      )}
      <p>{evaluation.message}</p>

      <div
        className={cn(
          'pt-3 border-t space-y-2.5',
          isDark ? 'border-red-500/30' : 'border-red-700/20',
        )}
      >
        <p className="font-semibold">
          Tetap lanjutkan (Override sadar)? Pilih alasan:
        </p>

        <div className="space-y-1.5">
          {options.map((opt) => (
            <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="override_reason_type"
                value={opt.value}
                checked={guardState?.overrideReasonType === opt.value}
                onChange={() => {
                  onChangeGuardState?.({
                    ...guardState,
                    overrideReasonType: opt.value,
                  });
                  if (showRemovalModeSelector) {
                    onChangeRemovalMode?.(
                      opt.value === 'local_correction' ? 'local_correction' : 'google_leave',
                    );
                  }
                }}
                className="mt-0.5"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>

        {(guardState?.overrideReasonType === 'emergency_other' ||
          guardState?.overrideReasonType === 'family_downgraded_free') && (
          <div className="space-y-1">
            <label className="block font-medium">
              Catatan{' '}
              {guardState.overrideReasonType === 'emergency_other' ? '(wajib, 5–200 karakter)' : '(opsional)'}
            </label>
            <textarea
              rows={2}
              maxLength={200}
              value={guardState.overrideNote || ''}
              onChange={(e) =>
                onChangeGuardState?.({
                  ...guardState,
                  overrideNote: e.target.value,
                })
              }
              placeholder="Contoh: Family lama sudah turun ke FREE, sadar risiko tunggu cooldown..."
              className={cn(
                'w-full px-2.5 py-2 text-xs border resize-none',
                isDark
                  ? 'bg-stone-950/70 border-red-500/40 text-stone-100 placeholder:text-stone-500'
                  : 'bg-white border-red-700/30 text-stone-900 placeholder:text-stone-400',
              )}
            />
          </div>
        )}

        <label className="flex items-start gap-2 cursor-pointer pt-1 font-semibold">
          <input
            type="checkbox"
            checked={Boolean(guardState?.overrideConfirmed)}
            onChange={(e) =>
              onChangeGuardState?.({
                ...guardState,
                overrideConfirmed: e.target.checked,
              })
            }
            className="mt-0.5"
          />
          <span>
            {guardState?.overrideReasonType === 'local_correction'
              ? 'Saya konfirmasi ini hanya koreksi salah input lokal di Trial Manager (tidak keluar/pindah di Google).'
              : `Saya paham akun ini berisiko terkunci dari Family lain sampai ${evaluation.cooldownEndsLabel || 'masa cooldown berakhir'}.`}
          </span>
        </label>

        {validationError && (
          <p role="alert" className="font-semibold underline">
            {validationError}
          </p>
        )}
      </div>
    </div>
  );
}
