import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useAppSetting, updateSetting } from '../../hooks/useSupabaseData';
import { cn } from '../../utils';
import { Settings, Save, Loader2, Sparkles, Languages, Palette, BadgeDollarSign, LayoutPanelTop, Check, User, LogOut } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../context/ThemeContext';

export default function SettingsModal({ isOpen, onClose, language, onToggleLanguage, onShowTutorial, publicMode = false, onLogout, session }) {
  const { theme } = useTheme();
  const { addToast } = useToast();
  
  // Settings from Supabase
  const { value: upgradePrice, loading: priceLoading, refetch: refetchPrice } = useAppSetting('upgrade_service_price', 45000);
  const { value: serviceStyle, loading: styleLoading, refetch: refetchStyle } = useAppSetting('service_card_style', 'editorial');
  
  // Local state for the form
  const [localPrice, setLocalPrice] = useState(upgradePrice);
  const [localStyle, setLocalStyle] = useState(serviceStyle);
  const [isSaving, setIsSaving] = useState(false);

  // Sync local state when settings are loaded or modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalPrice(upgradePrice);
      setLocalStyle(serviceStyle);
    }
  }, [isOpen, upgradePrice, serviceStyle]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const results = await Promise.all([
        updateSetting('upgrade_service_price', Number(localPrice)),
        updateSetting('service_card_style', localStyle)
      ]);
      
      const allSuccess = results.every(r => r.success);
      
      if (allSuccess) {
        // Force refetch to update hook state immediately
        await Promise.all([refetchPrice(), refetchStyle()]);
        addToast('Settings saved and applied!', 'success');
        onClose();
      } else {
        const error = results.find(r => !r.success)?.error;
        addToast(`Error saving settings: ${error}`, 'error');
      }
    } catch (err) {
      console.error('Save settings error:', err);
      addToast('An unexpected error occurred.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" maxWidth="max-w-md">
      <div className="space-y-8 py-2">

        {/* Account Section — email + logout */}
        {session && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-stone-800">
              <User className="w-4 h-4 text-gold-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-70">Account</h3>
            </div>
            <div className="space-y-3">
              <div className={cn(
                "flex items-center justify-between px-4 py-3 border rounded-sm",
                isDark
                  ? "bg-stone-900 border-stone-800"
                  : "bg-stone-50 border-stone-200"
              )}>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">Email</p>
                  <p className="text-sm font-medium truncate">{session?.user?.email || '—'}</p>
                </div>
              </div>
              {onLogout && (
                <button
                  onClick={() => { onLogout(); onClose(); }}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-4 py-3 border rounded-sm transition-colors font-bold text-xs uppercase tracking-widest",
                    isDark
                      ? "bg-red-950/30 border-red-900/50 text-red-400 hover:bg-red-950/50 hover:border-red-800"
                      : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300"
                  )}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              )}
            </div>
          </div>
        )}

        {/* Preferences — Language & Tour (mobile-only, since desktop shows them in header) */}
        <div className="space-y-4 md:hidden">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-stone-800">
            <Languages className="w-4 h-4 text-gold-500" />
            <h3 className="text-xs font-bold uppercase tracking-widest opacity-70">Preferences</h3>
          </div>

          <div className="space-y-3">
            {/* Language Toggle */}
            {onToggleLanguage && (
              <button
                onClick={() => { onToggleLanguage(); }}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 border rounded-sm transition-colors",
                  isDark
                    ? "bg-stone-900 border-stone-800 hover:border-stone-700"
                    : "bg-stone-50 border-stone-200 hover:border-stone-300"
                )}
              >
                <span className="text-sm font-medium">Language</span>
                <span className={cn(
                  "px-3 py-1 text-[10px] font-bold uppercase tracking-widest border rounded-sm",
                  isDark ? "border-stone-700 text-stone-300" : "border-stone-300 text-stone-600"
                )}>
                  {language === 'en' ? 'English → Indonesia' : 'Indonesia → English'}
                </span>
              </button>
            )}

            {/* Restart Tour */}
            {onShowTutorial && (
              <button
                onClick={() => { onShowTutorial(); onClose(); }}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 border rounded-sm transition-colors",
                  isDark
                    ? "bg-stone-900 border-stone-800 hover:border-stone-700"
                    : "bg-stone-50 border-stone-200 hover:border-stone-300"
                )}
              >
                <span className="text-sm font-medium">Restart Tour</span>
                <Sparkles className="w-4 h-4 text-gold-500" />
              </button>
            )}
          </div>
        </div>
        
        {/* Upgrade Service Pricing (Admin only) */}
        {!publicMode && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-stone-800">
            <BadgeDollarSign className="w-4 h-4 text-gold-500" />
            <h3 className="text-xs font-bold uppercase tracking-widest opacity-70">Pricing & Services</h3>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium opacity-80 block">Premium Upgrade Price (IDR)</label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm opacity-40 font-serif transition-colors group-focus-within:opacity-100 group-focus-within:text-gold-500">Rp</span>
              <input
                type="number"
                value={localPrice}
                onChange={(e) => setLocalPrice(e.target.value)}
                placeholder="45000"
                className={cn(
                  "w-full pl-12 pr-4 py-3 border focus:outline-none transition-all font-serif text-lg",
                  isDark 
                    ? "bg-stone-900 border-stone-800 focus:border-gold-500 text-stone-50" 
                    : "bg-stone-50 border-stone-200 focus:border-stone-900 text-stone-900Shadow-sm"
                )}
              />
            </div>
            <p className="text-[10px] opacity-40 italic">This price will update in real-time on the Public Dashboard after saving.</p>
          </div>
        </div>
        )}

        {/* UI Customization (Admin only) */}
        {!publicMode && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-stone-800">
              <LayoutPanelTop className="w-4 h-4 text-gold-500" />
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
        )}

        {/* Actions (Admin only — Save & Apply for pricing/UI settings) */}
        {!publicMode && (
        <div className="pt-4 flex justify-end gap-3 border-t border-stone-200 dark:border-stone-800">
           <button
            onClick={onClose}
            className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-all"
            style={{ color: isDark ? '#d6d3d1' : '#78716c' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || priceLoading || styleLoading}
            className="px-8 py-2.5 font-bold uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0"
            style={{ 
              backgroundColor: isDark ? '#fafaf9' : '#1c1917', 
              color: isDark ? '#1c1917' : '#fafaf9' 
            }}
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save & Apply
          </button>
        </div>
        )}

      </div>
    </Modal>
  );
}
