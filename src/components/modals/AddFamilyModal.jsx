import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Cloud, Check, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { generateId, FAMILY_EXPIRY_PRESETS, addMonthsISODate } from '../../lib/familyUtils';
import Modal from './Modal';
import FormField from '../ui/FormField';
import { useAsyncForm } from '../../hooks/useAsyncForm';
import { cn, formatBytes } from '../../utils';

const INITIAL_FORM = {
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
  isPublic: true,
};

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onAdd: (family: Record<string, any>) => Promise<any>,
 *   prefillAccount?: import('../../types').ConnectedAccount | null,
 *   unlinkedAccounts?: import('../../types').ConnectedAccount[],
 *   onConnectGoogle?: (() => Promise<any>) | null,
 * }} props
 */
export default function AddFamilyModal({
  isOpen,
  onClose,
  onAdd,
  prefillAccount = null,
  unlinkedAccounts = [],
  onConnectGoogle = null,
}) {
  const { theme } = useTheme();
  const { busy, error, run } = useAsyncForm();
  const { t } = useLanguage();
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [linkedAccount, setLinkedAccount] = useState(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef(null);

  // Basis perhitungan preset durasi tetap stabil selama sesi modal terbuka.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const presetBase = useMemo(() => new Date(), [isOpen]);

  const applyAccount = (acct) => {
    if (!acct) return;
    const usedGb = acct.usedBytes > 0
      ? Math.min(5120, Math.round((acct.usedBytes / (1024 ** 3)) * 100) / 100)
      : 0;
    setLinkedAccount(acct);
    setConnectError('');
    setFormData((prev) => ({
      ...prev,
      name: prev.name || 'Family Plan',
      ownerEmail: acct.email || prev.ownerEmail,
      expiryDate: prev.expiryDate || addMonthsISODate(presetBase, 24),
      storageUsed: usedGb ? String(usedGb) : prev.storageUsed,
    }));
    setTimeout(() => {
      const pwdEl = passwordInputRef.current?.querySelector?.('input');
      pwdEl?.focus?.();
    }, 50);
  };

  useEffect(() => {
    if (!isOpen) {
      setConnectingGoogle(false);
      setConnectError('');
      return;
    }
    if (prefillAccount) {
      applyAccount(prefillAccount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prefillAccount?.id]);

  const setExpiryPreset = (months) => {
    setFormData((prev) => ({ ...prev, expiryDate: addMonthsISODate(presetBase, months) }));
  };

  const handleGoogleConnectClick = async () => {
    if (!onConnectGoogle || connectingGoogle) return;
    setConnectError('');
    setConnectingGoogle(true);
    const res = await onConnectGoogle();
    if (!res?.success) {
      setConnectingGoogle(false);
      setConnectError(res?.error || 'Tidak bisa memulai koneksi Google.');
    }
  };

  const handleClearLinked = () => {
    setLinkedAccount(null);
    setFormData((prev) => ({ ...prev, ownerEmail: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ownerEmail || !formData.ownerPassword) return;
    
    const saved = await run(() => onAdd({
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
    }));
    if (!saved) return;
    setFormData(INITIAL_FORM);
    setLinkedAccount(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!busy && !connectingGoogle) onClose(); }} title={t('dashboard.form.title_new')}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <p role="alert" className="text-red-600">{error}</p>}
        {connectError && <p role="alert" className="text-red-600 text-sm">{connectError}</p>}
        <fieldset disabled={busy || connectingGoogle} className="space-y-6">
        {(linkedAccount || onConnectGoogle || unlinkedAccounts.length > 0) && (
          <div>
            {linkedAccount ? (
              <div className={cn(
                "p-4 border flex items-start justify-between gap-3",
                theme === 'light'
                  ? "bg-emerald-50/80 border-emerald-300 text-stone-900"
                  : "bg-emerald-950/30 border-emerald-800/70 text-stone-100"
              )}>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-emerald-600 text-white">
                      <Check className="w-3 h-3" /> Drive Connected
                    </span>
                    <span className="text-xs font-semibold opacity-80">
                      {formatBytes(linkedAccount.usedBytes || 0)} / {linkedAccount.totalBytes == null ? 'Unlimited' : formatBytes(linkedAccount.totalBytes)}
                    </span>
                  </div>
                  <p className="font-medium text-sm truncate">{linkedAccount.email}</p>
                  <p className={cn("text-[11px]", theme === 'light' ? "text-stone-600" : "text-stone-400")}>
                    Email & kuota sudah terisi otomatis. Pilih masa aktif lalu isi password akun di bawah.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearLinked}
                  className={cn(
                    "text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 border shrink-0 transition-colors cursor-pointer",
                    theme === 'light'
                      ? "border-stone-300 text-stone-700 hover:bg-stone-100"
                      : "border-stone-700 text-stone-300 hover:bg-stone-800"
                  )}
                >
                  Ganti
                </button>
              </div>
            ) : (
              <div className={cn(
                "p-4 border space-y-3",
                theme === 'light' ? "bg-stone-50 border-stone-200" : "bg-stone-900/60 border-stone-800"
              )}>
                {onConnectGoogle && (
                  <button
                    type="button"
                    onClick={handleGoogleConnectClick}
                    className={cn(
                      "w-full py-3 px-4 border font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer",
                      theme === 'light'
                        ? "bg-white border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-stone-50"
                        : "bg-stone-950 border-gold-500/60 text-gold-400 hover:bg-gold-500/10"
                    )}
                  >
                    {connectingGoogle ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Menghubungkan ke Google...
                      </>
                    ) : (
                      <>
                        <Cloud className="w-4 h-4" />
                        Hubungkan via Login Google (Otomatis)
                      </>
                    )}
                  </button>
                )}
                <p className={cn("text-[11px] text-center", theme === 'light' ? "text-stone-500" : "text-stone-400")}>
                  Otomatis mengisi email & menghubungkan kuota Google Drive tanpa input manual
                </p>

                {unlinkedAccounts.length > 0 && (
                  <div className={cn("pt-2 border-t space-y-1.5", theme === 'light' ? "border-stone-200" : "border-stone-800")}>
                    <p className={cn("text-[10px] uppercase tracking-widest font-bold", theme === 'light' ? "text-stone-500" : "text-stone-400")}>
                      Atau pilih akun Google yang sudah terhubung:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {unlinkedAccounts.map((acct) => (
                        <button
                          key={acct.id}
                          type="button"
                          onClick={() => applyAccount(acct)}
                          className={cn(
                            "px-2.5 py-1 text-xs border transition-colors cursor-pointer truncate max-w-full",
                            theme === 'light'
                              ? "border-stone-300 bg-white hover:border-stone-900 text-stone-800"
                              : "border-stone-700 bg-stone-900 hover:border-gold-500 text-stone-200"
                          )}
                        >
                          {acct.email} · {acct.totalBytes == null ? 'Unlimited' : formatBytes(acct.totalBytes)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
                placeholder="Family Plan"
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
            <div ref={passwordInputRef}>
              <FormField
                type={showPassword ? 'text' : 'password'}
                label={t('dashboard.form.password_label')}
                value={formData.ownerPassword}
                onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })}
                placeholder="••••••••"
                required
                suffix={
                  <button
                    type="button"
                    aria-label={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                    onClick={() => setShowPassword(!showPassword)}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 transition-colors cursor-pointer",
                      theme === 'light' ? "text-stone-400 hover:text-stone-900" : "text-stone-500 hover:text-stone-50"
                    )}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
            </div>
          </div>

          <div className="space-y-2">
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

          {formData.productType === 'slot' ? (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Monthly Price (IDR)"
              type="number" min="0"
              value={formData.priceMonthly}
              onChange={(e) => setFormData({ ...formData, priceMonthly: e.target.value })}
              placeholder="25000"
            />
            <FormField
              label="Annual Price (IDR)"
              type="number" min="0"
              value={formData.priceAnnual}
              onChange={(e) => setFormData({ ...formData, priceAnnual: e.target.value })}
              placeholder="300000"
            />
          </div>
          ) : <FormField label="One-Time Price (IDR)" type="number" min="0" value={formData.priceSale} onChange={e => setFormData({...formData,priceSale:e.target.value})} />}
          <label className="flex gap-2"><input type="checkbox" checked={formData.isPublic ?? true} onChange={e=>setFormData({...formData,isPublic:e.target.checked})}/>Tampilkan di katalog publik</label>

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
        </fieldset>
      </form>
    </Modal>
  );
}
