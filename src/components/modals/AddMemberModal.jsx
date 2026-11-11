import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { generateId, EXPIRY_PRESETS, addMonthsISODate } from '../../lib/familyUtils';
import Modal from './Modal';
import FormField from '../ui/FormField';
import { useAsyncForm } from '../../hooks/useAsyncForm';
import { cn } from '../../utils';

export default function AddMemberModal({ isOpen, onClose, onAdd, familyId }) {
  const { theme } = useTheme();
  const { busy, error, run } = useAsyncForm();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    storageUsed: '',
    memberType: 'pembeli',
    expiryDate: '',
  });

  // Member baru: langganan mulai hari ini, jadi basis preset = hari ini.
  const setExpiryPreset = (months) => {
    setFormData((prev) => ({ ...prev, expiryDate: addMonthsISODate(new Date(), months) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email) return;
    
    const saved = await run(() => onAdd(familyId, {
      id: generateId(),
      name: formData.name,
      email: formData.email,
      storageUsed: Number(formData.storageUsed) || 0,
      addedAt: new Date().toISOString(),
      memberType: formData.memberType,
      expiryDate: formData.memberType === 'pribadi' ? null : (formData.expiryDate || null),
    }));
    if (!saved) return;
    setFormData({ name: '', email: '', storageUsed: '', memberType: 'pembeli', expiryDate: '' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!busy) onClose(); }} title={t('dashboard.form.add_member_title')}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <fieldset disabled={busy} className="space-y-6">
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
          {t('dashboard.family_card.add_member')}
        </button>
        </fieldset>
      </form>
    </Modal>
  );
}
