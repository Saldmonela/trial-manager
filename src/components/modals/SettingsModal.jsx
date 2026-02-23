import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useAppSetting, updateSetting } from '../../hooks/useSupabaseData';
import { cn } from '../../utils';
import { Settings, Save, Loader2, Sparkles, Languages, Palette, BadgeDollarSign, LayoutPanelTop, Check, User, LogOut } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../context/ThemeContext';

export default function SettingsModal({ isOpen, onClose, language, onToggleLanguage, onShowTutorial, publicMode = false, onLogout, session }) {
  const { theme } = useTheme();
  // Settings from Supabase

  // Local state for the form
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    // If there were other settings to save, add them here.
    // Currently, SettingsModal handles language (instant) and logout.
    onClose();
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
        
      </div>
    </Modal>
  );
}
