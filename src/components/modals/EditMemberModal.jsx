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
  });

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name || '',
        email: member.email || '',
        storageUsed: member.storageUsed !== undefined ? String(member.storageUsed) : String(member.storage_used || ''),
      });
    }
  }, [member]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.email) return;

    onUpdate(familyId, member.id, {
      name: formData.name,
      email: formData.email,
      storageUsed: Number(formData.storageUsed) || 0,
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
