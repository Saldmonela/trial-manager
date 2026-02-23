import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useAppSetting, updateSetting } from '../../hooks/useSupabaseData';
import { cn } from '../../utils';
import { Save, Loader2, Sparkles, AlertCircle, X, Plus, LayoutPanelTop, Check } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../context/ThemeContext';

export default function EditServiceModal({ isOpen, onClose }) {
  const { theme } = useTheme();
  const { addToast } = useToast();
  const isDark = theme === 'dark';

  // Fetch settings
  const { value: title, loading: loading1, refetch: refetch1 } = useAppSetting('upgrade_service_title', 'Google AI Pro');
  const { value: desc, loading: loading2, refetch: refetch2 } = useAppSetting('upgrade_service_desc', 'Upgrade your personal account to premium status. Enjoy all benefits without joining a family group.');
  const { value: featuresRaw, loading: loading3, refetch: refetch3 } = useAppSetting('upgrade_service_features', JSON.stringify(['Private Account', 'Full Warranty', 'Instant Activation']));
  const { value: price, loading: loading4, refetch: refetch4 } = useAppSetting('upgrade_service_price', 45000);
  const { value: paymentType, loading: loading5, refetch: refetch5 } = useAppSetting('upgrade_payment_type', 'One-Time Payment');
  const { value: validity, loading: loading6, refetch: refetch6 } = useAppSetting('upgrade_validity', 'Lifetime Validity');
  const { value: style, loading: loading7, refetch: refetch7 } = useAppSetting('service_card_style', 'editorial');

  // Local state
  const [localTitle, setLocalTitle] = useState('');
  const [localDesc, setLocalDesc] = useState('');
  const [localFeatures, setLocalFeatures] = useState([]);
  const [localPrice, setLocalPrice] = useState(45000);
  const [localPaymentType, setLocalPaymentType] = useState('One-Time Payment');
  const [localValidity, setLocalValidity] = useState('Lifetime Validity');
  const [localStyle, setLocalStyle] = useState('editorial');
  const [isSaving, setIsSaving] = useState(false);

  const isLoading = loading1 || loading2 || loading3 || loading4 || loading5 || loading6 || loading7;

  // Sync to local state when modal opens or data loads
  useEffect(() => {
    if (isOpen && !isLoading) {
      setLocalTitle(title);
      setLocalDesc(desc);
      try {
        setLocalFeatures(typeof featuresRaw === 'string' ? JSON.parse(featuresRaw) : featuresRaw || []);
      } catch (e) {
         setLocalFeatures(['Private Account', 'Full Warranty', 'Instant Activation']);
      }
      setLocalPrice(price);
      setLocalPaymentType(paymentType);
      setLocalValidity(validity);
      setLocalStyle(style);
    }
  }, [isOpen, isLoading, title, desc, featuresRaw, price, paymentType, validity, style]);

  const handleAddFeature = () => {
    if (localFeatures.length < 5) {
      setLocalFeatures([...localFeatures, 'New Feature']);
    } else {
      addToast('Maximum 5 features allowed', 'error');
    }
  };

  const handleRemoveFeature = (index) => {
    setLocalFeatures(localFeatures.filter((_, i) => i !== index));
  };

  const handleChangeFeature = (index, value) => {
    const newFeatures = [...localFeatures];
    newFeatures[index] = value;
    setLocalFeatures(newFeatures);
  };

  const handleSave = async () => {
    if (!localTitle.trim()) {
      addToast('Title cannot be empty', 'error');
      return;
    }
    
    setIsSaving(true);
    try {
      const results = await Promise.all([
        updateSetting('upgrade_service_title', localTitle.trim()),
        updateSetting('upgrade_service_desc', localDesc.trim()),
        updateSetting('upgrade_service_features', JSON.stringify(localFeatures.filter(f => f.trim()))),
        updateSetting('upgrade_service_price', Number(localPrice)),
        updateSetting('upgrade_payment_type', localPaymentType.trim()),
        updateSetting('upgrade_validity', localValidity.trim()),
        updateSetting('service_card_style', localStyle),
      ]);
      
      const allSuccess = results.every(r => r.success);
      
      if (allSuccess) {
        await Promise.all([refetch1(), refetch2(), refetch3(), refetch4(), refetch5(), refetch6(), refetch7()]);
        addToast('Service updated successfully!', 'success');
        onClose();
      } else {
        const error = results.find(r => !r.success)?.error;
        addToast(`Error saving: ${error}`, 'error');
      }
    } catch (err) {
      console.error('Save service error:', err);
      addToast('An unexpected error occurred.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Premium Upgrade" maxWidth="max-w-lg">
      <div className="space-y-6 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
             <Loader2 className={cn("w-6 h-6 animate-spin", isDark ? "text-stone-500" : "text-stone-400")} />
          </div>
        ) : (
          <>
            {/* Title */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-70">Service Title</label>
              <input
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                placeholder="Google AI Pro"
                className={cn(
                  "w-full px-4 py-3 border focus:outline-none transition-all font-serif text-lg",
                  isDark 
                    ? "bg-stone-900 border-stone-800 focus:border-yellow-500 text-stone-50" 
                    : "bg-stone-50 border-stone-200 focus:border-stone-900 text-stone-900"
                )}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-70">Description</label>
              <textarea
                value={localDesc}
                onChange={(e) => setLocalDesc(e.target.value)}
                placeholder="Description of the service..."
                rows={3}
                className={cn(
                  "w-full px-4 py-3 border focus:outline-none transition-all resize-none text-sm",
                  isDark 
                    ? "bg-stone-900 border-stone-800 focus:border-yellow-500 text-stone-50 placeholder-stone-700" 
                    : "bg-stone-50 border-stone-200 focus:border-stone-900 text-stone-900 placeholder-stone-400"
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Payment Type */}
               <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-widest opacity-70">Payment Label</label>
                 <input
                   type="text"
                   value={localPaymentType}
                   onChange={(e) => setLocalPaymentType(e.target.value)}
                   placeholder="One-Time Payment"
                   className={cn(
                     "w-full px-4 py-2 border focus:outline-none transition-all text-sm",
                     isDark 
                       ? "bg-stone-900 border-stone-800 focus:border-yellow-500 text-stone-50" 
                       : "bg-stone-50 border-stone-200 focus:border-stone-900 text-stone-900"
                   )}
                 />
               </div>

               {/* Validity Label */}
               <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-widest opacity-70">Validity Label</label>
                 <input
                   type="text"
                   value={localValidity}
                   onChange={(e) => setLocalValidity(e.target.value)}
                   placeholder="Lifetime validity • No recurring fees"
                   className={cn(
                     "w-full px-4 py-2 border focus:outline-none transition-all text-sm",
                     isDark 
                       ? "bg-stone-900 border-stone-800 focus:border-yellow-500 text-stone-50" 
                       : "bg-stone-50 border-stone-200 focus:border-stone-900 text-stone-900"
                   )}
                 />
               </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-70">One-Time Price (IDR)</label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm opacity-40 font-serif transition-colors group-focus-within:opacity-100 group-focus-within:text-yellow-500">Rp</span>
                <input
                  type="number"
                  value={localPrice}
                  onChange={(e) => setLocalPrice(e.target.value)}
                  placeholder="45000"
                  className={cn(
                    "w-full pl-12 pr-4 py-3 border focus:outline-none transition-all font-serif text-lg",
                    isDark 
                      ? "bg-stone-900 border-stone-800 focus:border-yellow-500 text-stone-50" 
                      : "bg-stone-50 border-stone-200 focus:border-stone-900 text-stone-900"
                  )}
                />
              </div>
            </div>

            {/* Features List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest opacity-70">Key Features</label>
                <button
                  type="button"
                  onClick={handleAddFeature}
                  className={cn(
                    "flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold hover:underline",
                    isDark ? "text-yellow-500" : "text-yellow-700"
                  )}
                >
                  <Plus className="w-3 h-3" /> Add Feature
                </button>
              </div>
              
              <div className="space-y-2">
                {localFeatures.map((feature, idx) => (
                  <div key={idx} className="flex flex-1 items-center gap-2">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => handleChangeFeature(idx, e.target.value)}
                      placeholder="e.g. Instant Activation"
                      className={cn(
                        "w-full px-4 py-2 border focus:outline-none transition-all text-sm",
                        isDark 
                          ? "bg-stone-900 border-stone-800 focus:border-stone-700 text-stone-50" 
                          : "bg-stone-50 border-stone-200 focus:border-stone-300 text-stone-900"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(idx)}
                      className={cn(
                        "p-2 border transition-colors shrink-0",
                        isDark 
                          ? "border-stone-800 text-stone-600 hover:text-red-400 hover:border-red-900/50 hover:bg-red-950/30" 
                          : "border-stone-200 text-stone-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                      )}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {localFeatures.length === 0 && (
                   <p className="text-sm italic opacity-50 py-2">No features added. Click "Add Feature" above.</p>
                )}
              </div>
            </div>

            {/* UI Customization */}
            <div className="space-y-4 pt-4 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <LayoutPanelTop className="w-4 h-4 text-yellow-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-70">UI Design</h3>
              </div>
              
              <div className="space-y-3">
                <label className="text-sm font-medium opacity-80 block">Service Card Layout</label>
                <div className={cn(
                  "p-1.5 flex gap-1.5 rounded-lg border",
                  isDark ? "bg-stone-900 border-stone-800" : "bg-stone-100 border-stone-200"
                )}>
                  {['editorial', 'modern'].map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setLocalStyle(style)}
                      className={cn(
                        "flex-1 py-2.5 px-4 text-[11px] font-bold uppercase tracking-widest transition-all rounded-md flex items-center justify-center gap-2",
                        localStyle === style
                          ? isDark 
                            ? "bg-stone-50 text-stone-950 shadow-md"
                            : "bg-stone-900 text-stone-50 shadow-md"
                          : isDark
                            ? "text-stone-500 hover:text-stone-300 hover:bg-stone-800"
                            : "text-stone-400 hover:text-stone-600 hover:bg-stone-200"
                      )}
                    >
                      {localStyle === style && <Check className="w-3 h-3" />}
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-6 mt-6 flex justify-end gap-3 border-t border-stone-200 dark:border-stone-800">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-all"
                style={{ color: isDark ? '#d6d3d1' : '#78716c' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-8 py-2.5 font-bold uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0"
                style={{ 
                  backgroundColor: isDark ? '#fafaf9' : '#1c1917', 
                  color: isDark ? '#1c1917' : '#fafaf9' 
                }}
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save Changes
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
