import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import Modal from './Modal';
import { useAsyncForm } from '../../hooks/useAsyncForm';
import { cn } from '../../utils';
import { evaluateCooldownActionWarning } from '../../lib/cooldownLogic';
import CooldownGuardNotice, {
  validateCooldownGuardState,
} from '../cooldown/CooldownGuardNotice';

const INITIAL_GUARD_STATE = {
  overrideReasonType: '',
  overrideNote: '',
  overrideConfirmed: false,
};

export default function DeleteMemberConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  memberName,
  memberEmail = '',
  familyName = '',
  isPersonal = false,
  cooldownSummary = null,
  historyError = null,
  onRetryHistory,
}) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const { busy, error, run } = useAsyncForm();
  const { t } = useLanguage();

  const [removalMode, setRemovalMode] = useState('google_leave');
  const [guardState, setGuardState] = useState(INITIAL_GUARD_STATE);
  const [validationError, setValidationError] = useState('');
  const safeCancelBtnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setRemovalMode('google_leave');
    setGuardState(INITIAL_GUARD_STATE);
    setValidationError('');
  }, [isOpen, memberEmail, memberName]);

  const evaluation = useMemo(() => {
    if (!isPersonal) return null;
    return evaluateCooldownActionWarning({
      summary: cooldownSummary,
      action: 'leave',
      currentFamilyName: familyName,
      historyLoadError: historyError,
    });
  }, [isPersonal, cooldownSummary, familyName, historyError]);

  const isCritical = evaluation?.level === 'critical_cooldown_locked';
  const isFailSafe = evaluation?.level === 'fail_safe_unverified';

  // NF-05: Fokus default pada tombol aman saat Peringatan Tingkat 2
  useEffect(() => {
    if (isOpen && (isCritical || isFailSafe)) {
      const timer = setTimeout(() => {
        safeCancelBtnRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen, isCritical, isFailSafe]);

  const guardCheck = useMemo(
    () => validateCooldownGuardState(evaluation, guardState, true),
    [evaluation, guardState],
  );

  const handleConfirmClick = () => {
    if (isPersonal) {
      const check = validateCooldownGuardState(evaluation, guardState, true);
      if (!check.canProceed) {
        setValidationError(check.error);
        return;
      }
      setValidationError('');
      const effectiveRemovalMode =
        isCritical && guardState.overrideReasonType === 'local_correction'
          ? 'local_correction'
          : removalMode;

      void run(() =>
        onConfirm({
          removalMode: effectiveRemovalMode,
          leaveReason:
            effectiveRemovalMode === 'local_correction'
              ? 'local_correction'
              : guardState.overrideReasonType === 'family_downgraded_free'
                ? 'family_downgraded_free'
                : 'manual_move',
          overrideReasonType: isCritical ? guardState.overrideReasonType : null,
          overrideNote: isCritical ? guardState.overrideNote?.trim() || null : null,
        }),
      );
      return;
    }

    void run(() => onConfirm());
  };

  const confirmDisabled = busy || (isPersonal && !guardCheck.canProceed);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={null}
      maxWidth={isPersonal ? 'max-w-md' : 'max-w-sm'}
    >
      <div className="text-center">
        {error && (
          <p role="alert" className="text-red-600 dark:text-red-400 text-xs mb-4 font-medium">
            {error}
          </p>
        )}

        <div className="flex justify-center mb-5">
          <div
            className={cn(
              'p-3.5 border',
              isCritical || isFailSafe
                ? isDark
                  ? 'border-red-500/40 bg-red-950/40 text-red-400'
                  : 'border-red-700/30 bg-red-50 text-red-700'
                : isDark
                  ? 'border-amber-500/40 bg-amber-950/30 text-amber-400'
                  : 'border-amber-700/30 bg-amber-50 text-amber-700',
            )}
          >
            {isCritical || isFailSafe ? (
              <ShieldAlert className="w-7 h-7" />
            ) : (
              <AlertTriangle className="w-7 h-7" />
            )}
          </div>
        </div>

        <h3
          className={cn(
            'text-xl font-serif font-bold mb-2',
            theme === 'light' ? 'text-stone-900' : 'text-stone-50',
          )}
        >
          {isPersonal
            ? isCritical
              ? 'Tahan — Akun Sedang Cooldown'
              : 'Keluarkan Akun Pribadi?'
            : t('dashboard.delete_modal.member_title') || 'Delete Member?'}
        </h3>

        <p
          className={cn(
            'text-sm mb-5 leading-relaxed',
            theme === 'light' ? 'text-stone-600' : 'text-stone-400',
          )}
        >
          <span className="font-bold">{memberName}</span>
          {memberEmail && memberEmail !== memberName && (
            <>
              <br />
              <span className="font-mono text-xs opacity-80">{memberEmail}</span>
            </>
          )}
          {!isPersonal && (
            <>
              <br />
              {t('dashboard.delete_modal.member_description') ||
                'This member will be removed from the family. This action cannot be undone.'}
            </>
          )}
        </p>

        {isPersonal && evaluation && (
          <div className="mb-6">
            <CooldownGuardNotice
              evaluation={evaluation}
              isDark={isDark}
              guardState={guardState}
              onChangeGuardState={(next) => {
                setGuardState(next);
                setValidationError('');
              }}
              onRetryHistory={onRetryHistory}
              allowLocalCorrection
              showRemovalModeSelector={!isCritical && !isFailSafe}
              removalMode={removalMode}
              onChangeRemovalMode={setRemovalMode}
              validationError={validationError}
            />
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {isCritical || isFailSafe ? (
            <>
              {/* Safe default button takes primary visual hierarchy on Critical Cooldown */}
              <button
                ref={safeCancelBtnRef}
                type="button"
                disabled={busy}
                onClick={onClose}
                className={cn(
                  'w-full py-3 font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer',
                  isDark
                    ? 'bg-stone-100 text-stone-950 hover:bg-white'
                    : 'bg-stone-900 text-stone-50 hover:bg-stone-800',
                )}
              >
                Batal &amp; Pertahankan di Family
              </button>
              <button
                type="button"
                disabled={confirmDisabled}
                onClick={handleConfirmClick}
                className={cn(
                  'w-full py-2.5 border font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                  isDark
                    ? 'border-red-500/50 text-red-300 hover:bg-red-950/60'
                    : 'border-red-700/40 text-red-800 hover:bg-red-50',
                )}
              >
                {busy
                  ? 'Memproses...'
                  : guardState.overrideReasonType === 'local_correction'
                    ? 'Koreksi Lokal (Hapus Tanpa Cooldown)'
                    : 'Tetap Keluarkan / Override'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={confirmDisabled}
                onClick={handleConfirmClick}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-40"
              >
                {busy
                  ? 'Memproses...'
                  : isPersonal
                    ? removalMode === 'local_correction'
                      ? 'Hapus (Koreksi Lokal)'
                      : 'Lanjutkan & Catat Keluar'
                    : t('dashboard.delete_modal.confirm_delete_member') || 'Yes, Delete Member'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className={cn(
                  'w-full py-3 font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer',
                  theme === 'light'
                    ? 'text-stone-500 hover:text-stone-900'
                    : 'text-stone-400 hover:text-stone-100',
                )}
              >
                {t('dashboard.delete_modal.cancel') || 'Batal'}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
