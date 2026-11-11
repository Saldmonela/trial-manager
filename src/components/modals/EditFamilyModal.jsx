import React, { useState, useMemo } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { FAMILY_EXPIRY_PRESETS, addMonthsISODate, getPresetBaseDate } from '../../lib/familyUtils';
import Modal from './Modal';
import FormField from '../ui/FormField';
import { useAsyncForm } from '../../hooks/useAsyncForm';
import { cn } from '../../utils';

function EditFamilyForm({ isOpen, onClose, onSave, family }) {
  const { theme } = useTheme();
  const { busy, error, run } = useAsyncForm();
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: family?.name || '',
    ownerEmail: family?.ownerEmail || '',
    ownerPassword: '',
    expiryDate: family?.expiryDate?.slice(0, 10) || '',
    storageUsed: family?.storageUsed,
    notes: family?.notes || '',
    priceMonthly: family?.priceMonthly || '',
    priceAnnual: family?.priceAnnual || '',
    priceSale: family?.priceSale || '',
    productType: family?.productType || 'slot',
    isBanned: family?.isBanned || false,
    isPublic: family?.isPublic ?? family?.is_public ?? true,
    isActive: family?.isActive ?? family?.is_active ?? true,
  });

  const presetBase = useMemo(
    () => getPresetBaseDate(family?.createdAt || family?.created_at, family?.expiryDate || family?.expiry_date),
    [family],
  );

  const setExpiryPreset = (months) => {
    setFormData((prev) => ({ ...prev, expiryDate: addMonthsISODate(presetBase, months) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ownerEmail) return;
    
    const saved = await run(() => onSave({
      ...family,
      ...formData,
      ownerPassword: formData.ownerPassword || undefined,
      storageUsed: Number(formData.storageUsed) || 0,
      priceMonthly: Number(formData.priceMonthly) || 0,
      priceAnnual: Number(formData.priceAnnual) || 0,
      priceSale: Number(formData.priceSale) || 0,
      currency: 'IDR',
      productType: formData.productType,
      isBanned: formData.isBanned,
    }));
    if (saved) onClose();
  };

  if (!family) return null;

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!busy) onClose(); }} title={t('dashboard.form.title_edit')}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <p role="alert" className="border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
        <fieldset disabled={busy} className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
             <FormField
                label={t('admin.family.sales_type')}
                value={formData.productType}
                onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                type="select"
                options={[
                  { value: 'slot', label: t('admin.family.shared_slot') },
                  { value: 'account_ready', label: t('admin.family.ready_account') },
                ]}
             />
             <FormField
                label={t('dashboard.form.name_label')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
          </div>

          <label className="flex items-center gap-3 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={formData.isPublic} onChange={e=>setFormData({...formData,isPublic:e.target.checked})} className="w-4 h-4 accent-gold-600"/>
            {t('admin.family.show_public')}
          </label>
          <label className="flex items-center gap-3 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={formData.isActive} onChange={e=>setFormData({...formData,isActive:e.target.checked})} className="w-4 h-4 accent-gold-600"/>
            {t('admin.family.active')}
          </label>
          <div className="flex items-center gap-3 p-4 border rounded-sm bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30">
            <input
              type="checkbox"
              id="isBanned"
              checked={formData.isBanned}
              onChange={(e) => setFormData({ ...formData, isBanned: e.target.checked })}
              className="w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500 cursor-pointer"
            />
            <label htmlFor="isBanned" className="text-sm font-bold uppercase tracking-widest text-red-700 dark:text-red-400 cursor-pointer select-none">
              {t('admin.family.banned')}
            </label>
          </div>

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
              placeholder={t('admin.family.password_hint')}
              suffix={
                <button
                  type="button"
                  aria-label={showPassword ? t('admin.family.hide') : t('admin.family.show')}
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

          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label={t('dashboard.form.expiry_label')}
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              />
              {formData.productType === 'slot' && (
                <FormField
                  label={t('dashboard.form.storage_label')}
                  type="number" min="0" step="any"
                  value={formData.storageUsed}
                  onChange={(e) => setFormData({ ...formData, storageUsed: e.target.value })}
                  placeholder="0"
                  max="5120"
                />
              )}
            </div>
            <div className="flex flex-wrap gap-2 justify-start">
              {FAMILY_EXPIRY_PRESETS.map((p) => {
                const targetDate = addMonthsISODate(presetBase, p.months);
                const isSelected = formData.expiryDate === targetDate;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setExpiryPreset(p.months)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border transition-colors cursor-pointer",
                      isSelected
                        ? (theme === 'light'
                            ? "border-stone-900 bg-stone-900 text-stone-50"
                            : "border-gold-500 bg-gold-500/20 text-gold-400")
                        : (theme === 'light'
                            ? "border-stone-200 hover:bg-stone-100 text-stone-700 bg-transparent"
                            : "border-stone-800 hover:bg-stone-800 text-stone-300 bg-transparent")
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.productType === 'slot' ? (
              <>
                <FormField
                  label={t('admin.family.price_monthly')}
                  type="number" min="0"
                  value={formData.priceMonthly}
                  onChange={(e) => setFormData({ ...formData, priceMonthly: e.target.value })}
                  placeholder="25000"
                />
                <FormField
                  label={t('admin.family.price_annual')}
                  type="number" min="0"
                  value={formData.priceAnnual}
                  onChange={(e) => setFormData({ ...formData, priceAnnual: e.target.value })}
                  placeholder="300000"
                />
              </>
            ) : (
                <FormField
                  label={t('admin.family.price_sale')}
                  type="number" min="0"
                  value={formData.priceSale}
                  onChange={(e) => setFormData({ ...formData, priceSale: e.target.value })}
                  placeholder="150000"
                />
            )}
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
        </fieldset>
      </form>
    </Modal>
  );
}

export default function EditFamilyModal(props) { return props.isOpen && props.family ? <EditFamilyForm key={props.family.id} {...props}/> : null; }
