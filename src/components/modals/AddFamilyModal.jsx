import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { generateId } from '../../hooks/useLocalStorage';
import Modal from './Modal';
import FormField from '../ui/FormField';
import { cn } from '../../utils';

export default function AddFamilyModal({ isOpen, onClose, onAdd }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    ownerEmail: '',
    ownerPassword: '',
    expiryDate: '',
    storageUsed: '',
    notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.ownerEmail || !formData.ownerPassword) return;
    
    onAdd({
      ...formData,
      storageUsed: Number(formData.storageUsed) || 0,
      id: generateId(),
      members: [],
      createdAt: new Date().toISOString(),
    });
    
    setFormData({ name: '', ownerEmail: '', ownerPassword: '', expiryDate: '', storageUsed: '', notes: '' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('dashboard.form.title_new')}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <FormField
            label={t('dashboard.form.name_label')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., The Smiths, Premium A"
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={t('dashboard.form.email_label')}
              type="email"
              value={formData.ownerEmail}
              onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
              placeholder="email@example.com"
              required
            />
            <FormField
              label={t('dashboard.form.password_label')}
              value={formData.ownerPassword}
              onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={t('dashboard.form.expiry_label')}
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
            />
            <FormField
              label={t('dashboard.form.storage_label')}
              type="number"
              value={formData.storageUsed}
              onChange={(e) => setFormData({ ...formData, storageUsed: e.target.value })}
              placeholder="0"
              max="2048"
            />
          </div>

          <FormField
            label={t('dashboard.form.notes_label')}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes..."
          />
        </div>

        <button
          type="submit"
          className={cn(
            "w-full py-4 text-sm font-bold uppercase tracking-widest transition-all mt-8",
            theme === 'light'
              ? "bg-stone-900 text-stone-50 hover:bg-stone-800"
              : "bg-stone-50 text-stone-900 hover:bg-stone-200"
          )}
        >
          {t('dashboard.form.create')}
        </button>
      </form>
    </Modal>
  );
}
