import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import Modal from './Modal';
import FormField from '../ui/FormField';
import { cn } from '../../utils';

export default function EditFamilyModal({ isOpen, onClose, onSave, family }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: family?.name || '',
    ownerEmail: family?.ownerEmail || '',
    ownerPassword: family?.ownerPassword || '',
    expiryDate: family?.expiryDate || '',
    storageUsed: family?.storageUsed,
    notes: family?.notes || '',
  });

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  // Update form when family changes
  React.useEffect(() => {
    if (family) {
      setFormData({
        name: family.name || '',
        ownerEmail: family.ownerEmail || '',
        ownerPassword: family.ownerPassword || '',
        expiryDate: formatDateForInput(family.expiryDate),
        storageUsed: family.storageUsed,
        notes: family.notes || '',
      });
    }
  }, [family]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.ownerEmail || !formData.ownerPassword) return;
    
    onSave({
      ...family,
      ...formData,
      storageUsed: Number(formData.storageUsed) || 0,
    });
    
    onClose();
  };

  if (!family) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('dashboard.form.title_edit')}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <FormField
            label={t('dashboard.form.name_label')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label={t('dashboard.form.email_label')}
              type="email"
              value={formData.ownerEmail}
              onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
              required
            />
            <FormField
              label={t('dashboard.form.password_label')}
              type={showPassword ? "text" : "password"}
              value={formData.ownerPassword}
              onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })}
              required
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 transition-colors",
                    theme === 'light' ? "text-stone-400 hover:text-stone-900" : "text-stone-500 hover:text-stone-50"
                  )}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          {t('dashboard.form.save')}
        </button>
      </form>
    </Modal>
  );
}
