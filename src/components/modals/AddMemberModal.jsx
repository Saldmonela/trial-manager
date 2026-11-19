import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { generateId, EXPIRY_PRESETS, addMonthsISODate } from '../../lib/familyUtils';
import {
  computeAccountCooldown,
  evaluateCooldownActionWarning,
  isPersonalAccountEmail,
} from '../../lib/cooldownLogic';
import Modal from './Modal';
import FormField from '../ui/FormField';
import { useAsyncForm } from '../../hooks/useAsyncForm';
import { cn } from '../../utils';
import CooldownGuardNotice, {
  validateCooldownGuardState,
} from '../cooldown/CooldownGuardNotice';

const INITIAL_GUARD_STATE = {
  overrideReasonType: '',
  overrideNote: '',
  overrideConfirmed: false,
};

export default function AddMemberModal({
  isOpen,
  onClose,
  onAdd,
  familyId,
  targetFamily = null,
  families = [],
  cockpitAccounts = [],
  historyEntries = [],
  historyError = null,
  onRetryHistory,
}) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const { busy, error, run } = useAsyncForm();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    storageUsed: '',
    memberType: 'pembeli',
    expiryDate: '',
  });
  const [guardState, setGuardState] = useState(INITIAL_GUARD_STATE);
  const [guardError, setGuardError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setGuardState(INITIAL_GUARD_STATE);
    setGuardError('');
  }, [isOpen, familyId]);

  // Reset guard confirmation whenever email changes
  useEffect(() => {
    setGuardState(INITIAL_GUARD_STATE);
    setGuardError('');
  }, [formData.email, formData.memberType]);

  const isPersonalTarget = useMemo(() => {
    if (!formData.email.trim()) return formData.memberType === 'pribadi';
    return isPersonalAccountEmail(
      formData.email,
      formData.memberType,
      cockpitAccounts,
      families,
    );
  }, [formData.email, formData.memberType, cockpitAccounts, families]);

  const cooldownSummary = useMemo(() => {
    if (!isPersonalTarget || !formData.email.trim()) return null;
    return computeAccountCooldown(formData.email, historyEntries, new Date());
  }, [isPersonalTarget, formData.email, historyEntries]);

  const warningEvaluation = useMemo(() => {
    if (!isPersonalTarget || !formData.email.trim()) return null;
    return evaluateCooldownActionWarning({
      summary: cooldownSummary,
      action: 'join',
      targetFamily: targetFamily
        ? {
            id: targetFamily.id,
            name: targetFamily.name || targetFamily.ownerEmail,
            ownerEmail: targetFamily.ownerEmail,
          }
        : null,
      historyLoadError: historyError,
    });
  }, [isPersonalTarget, formData.email, cooldownSummary, targetFamily, historyError]);

  const guardCheck = useMemo(
    () => validateCooldownGuardState(warningEvaluation, guardState, false),
    [warningEvaluation, guardState],
  );

  // Member baru: langganan mulai hari ini, jadi basis preset = hari ini.
  const setExpiryPreset = (months) => {
    setFormData((prev) => ({ ...prev, expiryDate: addMonthsISODate(new Date(), months) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email) return;

    if (isPersonalTarget && warningEvaluation) {
      const check = validateCooldownGuardState(warningEvaluation, guardState, false);
      if (!check.canProceed) {
        setGuardError(check.error);
        return;
      }
    }

    const isCritical = warningEvaluation?.level === 'critical_cooldown_locked';
    const saved = await run(() =>
      onAdd(
        familyId,
        {
          id: generateId(),
          name: formData.name,
          email: formData.email,
          storageUsed: Number(formData.storageUsed) || 0,
          addedAt: new Date().toISOString(),
          memberType: formData.memberType,
          expiryDate:
            formData.memberType === 'pribadi' ? null : formData.expiryDate || null,
        },
        isCritical
          ? {
              overrideReasonType: guardState.overrideReasonType || null,
              overrideNote: guardState.overrideNote?.trim() || null,
            }
          : undefined,
      ),
    );
    if (!saved) return;
    setFormData({ name: '', email: '', storageUsed: '', memberType: 'pembeli', expiryDate: '' });
    setGuardState(INITIAL_GUARD_STATE);
    setGuardError('');
    onClose();
  };

  const submitBlocked = busy || (isPersonalTarget && !guardCheck.canProceed);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t('dashboard.form.add_member_title')}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p role="alert" className="text-red-600 dark:text-red-400 text-xs font-medium">
            {error}
          </p>
        )}
        <fieldset disabled={busy} className="space-y-5">
          <FormField
            label={t('dashboard.form.member_name_label')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. John Doe, Kaka..."
          />

          <FormField
            label={t('dashboard.form.member_email_label')}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="member@gmail.com"
            required
          />

          <FormField
            label={`${t('dashboard.form.storage_label')} (GB)`}
            type="number"
            min="0"
            step="any"
            value={formData.storageUsed}
            onChange={(e) => {
              const val = e.target.value;
              if (val !== '' && Number(val) < 0) return;
              setFormData({ ...formData, storageUsed: val });
            }}
            placeholder="0"
          />

          <FormField
            label="Tipe Anggota"
            value={formData.memberType}
            onChange={(e) => setFormData({ ...formData, memberType: e.target.value })}
            type="select"
            options={[
              { value: 'pembeli', label: 'Akun Pembeli (Buyer)' },
              { value: 'pribadi', label: 'Akun Pribadi (Personal)' },
            ]}
          />

          {/* Live Cooldown Warning for Personal Accounts (US-03) */}
          {isPersonalTarget && warningEvaluation && warningEvaluation.level !== 'none' && (
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

          {isPersonalTarget && warningEvaluation?.isSameFamilyRejoin && (
            <CooldownGuardNotice evaluation={warningEvaluation} isDark={isDark} />
          )}

          {formData.memberType === 'pembeli' && (
            <div className="space-y-2">
              <FormField
                label="Expired Date"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              />
              <div className="flex flex-wrap gap-2 justify-start mt-1">
                {EXPIRY_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setExpiryPreset(p.months)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border transition-colors cursor-pointer',
                      theme === 'light'
                        ? 'border-stone-200 hover:bg-stone-100 text-stone-700 bg-transparent'
                        : 'border-stone-800 hover:bg-stone-850 text-stone-300 bg-transparent',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitBlocked}
            className={cn(
              'w-full py-3 font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
              warningEvaluation?.level === 'critical_cooldown_locked'
                ? 'bg-red-700 hover:bg-red-800 text-white'
                : theme === 'light'
                  ? 'bg-stone-900 text-stone-50 hover:bg-stone-800'
                  : 'bg-stone-50 text-stone-900 hover:bg-stone-200',
            )}
          >
            {busy
              ? 'Menyimpan...'
              : warningEvaluation?.level === 'critical_cooldown_locked'
                ? 'Tetap Tambahkan / Override'
                : t('dashboard.form.add_member_submit') || 'Add Member'}
          </button>
        </fieldset>
      </form>
    </Modal>
  );
}
