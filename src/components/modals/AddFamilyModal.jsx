import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { generateId } from '../../lib/familyUtils';
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
    priceMonthly: '',
    priceAnnual: '',
    priceSale: '',
    productType: 'slot',
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
      priceMonthly: Number(formData.priceMonthly) || 0,
      priceAnnual: Number(formData.priceAnnual) || 0,
      priceSale: Number(formData.priceSale) || 0,
      currency: 'IDR',
      productType: formData.productType,
    });
    
    setFormData({ name: '', ownerEmail: '', ownerPassword: '', expiryDate: '', storageUsed: '', notes: '', priceMonthly: '', priceAnnual: '', priceSale: '' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('dashboard.form.title_new')}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
             <FormField
                label="Sales Type"
                value={formData.productType}
                onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                type="select"
                options={[
                  { value: 'slot', label: 'Shared Slot' },
                  { value: 'account_ready', label: 'Ready Account (Pre-made)' },
                ]}
             />
             <FormField
                label={t('dashboard.form.name_label')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., The Smiths"
             />
          </div>

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
            
            {formData.productType === 'slot' && (
              <FormField
                label={t('dashboard.form.storage_label')}
                type="number"
                value={formData.storageUsed}
                onChange={(e) => setFormData({ ...formData, storageUsed: e.target.value })}
                placeholder="0"
                max="2048"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Monthly Price (IDR)"
              type="number"
              value={formData.priceMonthly}
              onChange={(e) => setFormData({ ...formData, priceMonthly: e.target.value })}
              placeholder="25000"
            />
            <FormField
              label="Annual Price (IDR)"
              type="number"
              value={formData.priceAnnual}
              onChange={(e) => setFormData({ ...formData, priceAnnual: e.target.value })}
              placeholder="300000"
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
