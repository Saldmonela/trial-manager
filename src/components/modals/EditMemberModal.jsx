import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import Modal from './Modal';
import FormField from '../ui/FormField';
import { cn } from '../../utils';

export default function EditMemberModal({ isOpen, onClose, onUpdate, familyId, member }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    storageUsed: '',
    memberType: 'pembeli',
    expiryDate: '',
  });

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name || '',
        email: member.email || '',
        storageUsed: member.storageUsed !== undefined ? String(member.storageUsed) : String(member.storage_used || ''),
        memberType: member.memberType || member.member_type || 'pembeli',
        expiryDate: formatDate(member.expiryDate || member.expiry_date),
      });
    }
  }, [member]);

  const setExpiryPreset = (months) => {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setFormData((prev) => ({ ...prev, expiryDate: `${year}-${month}-${day}` }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.email) return;

    onUpdate(familyId, member.id, {
      name: formData.name,
      email: formData.email,
      storageUsed: Number(formData.storageUsed) || 0,
      memberType: formData.memberType,
      expiryDate: formData.memberType === 'pribadi' ? null : (formData.expiryDate || null),
    });

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('dashboard.form.edit_member_title') || 'Edit Member'}>
      <form onSubmit={handleSubmit} className="space-y-6">
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

        {formData.memberType === 'pembeli' && (
          <div className="space-y-2">
            <FormField
              label="Expired Date"
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
            />
            <div className="flex gap-2 justify-start mt-1">
              {[
                { label: '+1 Bulan', months: 1 },
                { label: '+3 Bulan', months: 3 },
                { label: '+6 Bulan', months: 6 },
              ].map((p) => (
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
          {t('common.save') || 'Save Changes'}
        </button>
      </form>
    </Modal>
  );
}
