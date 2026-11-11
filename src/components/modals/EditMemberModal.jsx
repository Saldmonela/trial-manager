import React, { useState, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import Modal from './Modal';
import FormField from '../ui/FormField';
import { useAsyncForm } from '../../hooks/useAsyncForm';
import { cn } from '../../utils';
import {
  EXPIRY_PRESETS, addMonthsISODate, getPresetBaseDate,
  getSlotsUsed, isFamilyFull, MAX_FAMILY_SLOTS,
} from '../../lib/familyUtils';

function EditMemberForm({ isOpen, onClose, onUpdate, familyId, member, families }) {
  const { theme } = useTheme();
  const { busy, error, run } = useAsyncForm();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: member?.name || '',
    email: member?.email || '',
    storageUsed: member?.storageUsed ?? member?.storage_used ?? '',
    memberType: member?.memberType || member?.member_type || 'pembeli',
    expiryDate: (member?.expiryDate || member?.expiry_date || '').slice(0,10),
    familyId: familyId || '',
  });

  // Basis preset diambil dari data member asli (bukan formData) supaya stabil:
  // klik "6 Bulan" lalu "1 Tahun" hasilnya tetap 1 tahun dari awal langganan.
  const presetBase = useMemo(
    () => getPresetBaseDate(member?.addedAt || member?.added_at, member?.expiryDate || member?.expiry_date),
    [member],
  );

  const setExpiryPreset = (months) => {
    setFormData((prev) => ({ ...prev, expiryDate: addMonthsISODate(presetBase, months) }));
  };

  // Pilihan family tujuan. Yang penuh tetap tampil tapi dikunci (5 slot = batas keras);
  // yang masa aktifnya lebih pendek dari member ditandai ⚠ tapi tetap boleh dipilih.
  const familyOptions = useMemo(() => {
    const memberExpiry = formData.expiryDate ? new Date(formData.expiryDate).getTime() : null;
    return (families || []).map((f) => {
      const used = getSlotsUsed(f);
      const isCurrent = f.id === familyId;
      const full = !isCurrent && isFamilyFull(f);
      const expiry = f.expiryDate || f.expiry_date;
      const tooShort = memberExpiry !== null && expiry && new Date(expiry).getTime() < memberExpiry;
      const expiryLabel = expiry
        ? new Date(expiry).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
        : 'tanpa tanggal';
      return {
        value: f.id,
        disabled: full,
        label: `${tooShort ? '⚠ ' : ''}${f.name || 'Family'} · ${used}/${MAX_FAMILY_SLOTS} · ${expiryLabel}${full ? ' · PENUH' : ''}`,
      };
    });
  }, [families, familyId, formData.expiryDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email) return;

    const fields = {
      name: formData.name,
      email: formData.email,
      storageUsed: Number(formData.storageUsed) || 0,
      memberType: formData.memberType,
      expiryDate: formData.memberType === 'pribadi' ? null : (formData.expiryDate || null),
    };
    // Pindah family: expiryDate sengaja tidak disentuh, sisa masa aktif ikut apa adanya.
    if (formData.familyId && formData.familyId !== familyId) fields.family_id = formData.familyId;

    const saved = await run(() => onUpdate(familyId, member.id, fields));

    if (saved) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!busy) onClose(); }} title={t('dashboard.form.edit_member_title') || 'Edit Member'}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <fieldset disabled={busy} className="space-y-6">
        <FormField
          label={t('dashboard.form.member_name_label')}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g. John Doe"
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
          type="number" min="0"
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

        {familyOptions.length > 0 && (
          <FormField
            label="Family"
            value={formData.familyId}
            onChange={(e) => setFormData({ ...formData, familyId: e.target.value })}
            type="select"
            options={familyOptions}
          />
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
                    "px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border transition-colors cursor-pointer",
                    theme === 'light'
                      ? "border-stone-200 hover:bg-stone-100 text-stone-700 bg-transparent"
                      : "border-stone-800 hover:bg-stone-850 text-stone-300 bg-transparent"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className={cn("text-[11px]", theme === 'light' ? "text-stone-400" : "text-stone-500")}>
              Dihitung dari {presetBase.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        )}

        <button
          type="submit"
          className={cn(
            "w-full py-4 text-sm font-bold uppercase tracking-widest transition-all mt-8",
            theme === 'light'
              ? "bg-stone-900 text-stone-50 hover:bg-stone-800"
              : "bg-stone-50 text-stone-900 hover:bg-stone-200"
          )}
        >
          {t('common.save') || 'Save Changes'}
        </button>
        </fieldset>
      </form>
    </Modal>
  );
}

export default function EditMemberModal(props) { return props.isOpen && props.member ? <EditMemberForm key={props.member.id} {...props}/> : null; }
