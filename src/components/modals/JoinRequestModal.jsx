import React, { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import Modal from './Modal';
import FormField from '../ui/FormField';
import { cn } from '../../utils';

const INITIAL_FORM = {
  name: '',
  email: '',
  targetEmail: '',
  note: '',
  billingCycle: 'monthly',
};

export default function JoinRequestModal({ isOpen, onClose, family, onSubmit }) {
  const { theme } = useTheme();
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOneTimePurchase = family?.productType === 'account_ready' || family?.productType === 'account_custom';

  useEffect(() => {
    if (!isOpen) {
      setFormData(INITIAL_FORM);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;

    setIsSubmitting(true);
    await onSubmit({
      name: formData.name.trim(),
      email: formData.email.trim(),
      note: (family?.productType === 'account_custom' 
        ? `[TARGET EMAIL: ${formData.email.trim()}] ${formData.note}` 
        : formData.note).trim(),
      billingCycle: formData.billingCycle,
      productType: family?.productType || 'slot',
    });
    setIsSubmitting(false);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={family?.productType === 'account_custom' ? 'Upgrade Service' : family?.productType === 'account_ready' ? 'Buy Account' : `Purchase Slot: ${family?.name || ''}`}
    >
      <div className="space-y-6">
        {/* Order Summary */}
        <div className={cn(
          "p-4 rounded-lg border",
          theme === 'light' ? "bg-stone-100 border-stone-200" : "bg-stone-900 border-stone-800"
        )}>
           {!isOneTimePurchase && (
             <div className="flex justify-between items-start mb-4">
               <div className="flex bg-stone-200 dark:bg-stone-800 p-1 rounded-lg">
                 <button
                   type="button"
                   onClick={() => setFormData(p => ({ ...p, billingCycle: 'monthly' }))}
                   className={cn(
                     "px-3 py-1 text-xs font-bold rounded-md transition-all",
                     formData.billingCycle === 'monthly' 
                       ? "bg-white dark:bg-black shadow-sm text-stone-900 dark:text-stone-100" 
                       : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                   )}
                 >
                   Monthly
                 </button>
                 <button
                   type="button"
                   onClick={() => setFormData(p => ({ ...p, billingCycle: 'annual' }))}
                   className={cn(
                     "px-3 py-1 text-xs font-bold rounded-md transition-all",
                     formData.billingCycle === 'annual' 
                       ? "bg-white dark:bg-black shadow-sm text-stone-900 dark:text-stone-100" 
                       : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                   )}
                 >
                   Annual
                 </button>
               </div>
             </div>
           )}

           <div className="flex justify-between items-end mb-1">
              <span className={cn("text-xs uppercase tracking-widest font-bold", theme === 'light' ? "text-stone-500" : "text-stone-400")}>
                {isOneTimePurchase ? 'Total Price (One-Time)' : `Total Price (${formData.billingCycle === 'monthly' ? 'Monthly' : 'Annual'})`}
              </span>
              <span className={cn("font-serif text-xl font-bold", theme === 'light' ? "text-stone-900" : "text-gold-400")}>
                Rp {(isOneTimePurchase 
                      ? (Number(family?.priceSale) || 0)
                      : formData.billingCycle === 'monthly' 
                        ? (Number(family?.priceMonthly) || 0) 
                        : (Number(family?.priceAnnual) || 0)).toLocaleString('id-ID')}
                <span className="text-xs font-sans font-normal opacity-60 ml-1">
                  {isOneTimePurchase ? '/once' : (formData.billingCycle === 'monthly' ? '/mo' : '/yr')}
                </span>
              </span>
           </div>
           <p className="text-[10px] opacity-60 text-right">Includes tax & admin fees</p>
        </div>

        {/* Payment Instructions (MVP) */}
        <div className="text-sm opacity-80 leading-relaxed">
          <p className="mb-2"><strong>Transfer to:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>BCA: 123-456-7890 (Salman Lukman)</li>
            <li>Dana: 0812-3456-7890</li>
          </ul>
          <p className="mt-2 text-xs italic opacity-60">Please include your email in the transfer note.</p>
        </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Your name"
          required
        />

        <FormField
          label={family?.productType === 'account_custom' ? 'Email to Upgrade' : 'Email'}
          type="email"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          placeholder={family?.productType === 'account_custom' ? 'target@example.com' : 'you@example.com'}
          required
        />

        <div>
          <label
            className={cn(
              'block text-xs uppercase tracking-widest font-medium mb-2',
              theme === 'light' ? 'text-stone-500' : 'text-stone-400'
            )}
          >
            Note (Optional)
          </label>
          <textarea
            value={formData.note}
            onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
            rows={3}
            placeholder="Anything the admin should know"
            className={cn(
              'w-full px-4 py-3 border bg-transparent focus:outline-none transition-colors resize-none',
              theme === 'light'
                ? 'border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-900'
                : 'border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50'
            )}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'w-full py-3 text-sm font-bold uppercase tracking-widest transition-all disabled:opacity-50',
            theme === 'light'
              ? 'bg-stone-900 text-stone-50 hover:bg-stone-800'
              : 'bg-stone-50 text-stone-900 hover:bg-stone-200'
          )}
        >
          {isSubmitting ? 'Processing...' : 'I Have Transferred - Confirm Purchase'}
        </button>
      </form>
      </div>
    </Modal>
  );
}
