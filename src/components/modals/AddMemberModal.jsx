import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { generateId } from '../../lib/familyUtils';
import Modal from './Modal';
import FormField from '../ui/FormField';
import { cn } from '../../utils';

export default function AddMemberModal({ isOpen, onClose, onAdd, familyId }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name && !formData.email) return;
    
    onAdd(familyId, {
      id: generateId(),
      name: formData.name,
      email: formData.email,
      addedAt: new Date().toISOString(),
    });
    
    setFormData({ name: '', email: '' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('dashboard.form.add_member_title')}>
      <form onSubmit={handleSubmit} className="space-y-6">
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
          {t('dashboard.family_card.add_member')}
        </button>
      </form>
    </Modal>
  );
}
