import React from 'react';
import Modal from './Modal';
import { cn } from '../../utils';
import { Sparkles, Languages, User, LogOut } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-stone-800">
      <Icon className="w-4 h-4 text-gold-500" aria-hidden="true" />
      <h3 className="text-xs font-bold uppercase tracking-widest opacity-70">{children}</h3>
    </div>
  );
}

export default function SettingsModal({ isOpen, onClose, language, onToggleLanguage, onShowTutorial, onLogout, session }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === 'dark';
  const rowClass = cn(
    'w-full flex items-center justify-between px-4 py-3 border rounded-sm transition-colors',
    isDark ? 'bg-stone-900 border-stone-800 hover:border-stone-700' : 'bg-stone-50 border-stone-200 hover:border-stone-300',
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('admin.settings.title')} maxWidth="max-w-md">
      <div className="space-y-8 py-2">

        {/* Account Section — email + logout */}
        {session && (
          <div className="space-y-4">
            <SectionTitle icon={User}>{t('admin.settings.account')}</SectionTitle>
            <div className="space-y-3">
              <div className={cn(
                'flex items-center justify-between px-4 py-3 border rounded-sm',
                isDark ? 'bg-stone-900 border-stone-800' : 'bg-stone-50 border-stone-200',
              )}>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{t('admin.settings.email')}</p>
                  <p className="text-sm font-medium truncate">{session?.user?.email || '—'}</p>
                </div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={() => { onLogout(); onClose(); }}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-3 border rounded-sm transition-colors font-bold text-xs uppercase tracking-widest',
                    isDark
                      ? 'bg-red-950/30 border-red-900/50 text-red-400 hover:bg-red-950/50 hover:border-red-800'
                      : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300',
                  )}
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('admin.settings.logout')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Preferences — Language & Tour (mobile-only, since desktop shows them in header) */}
        <div className="space-y-4 md:hidden">
          <SectionTitle icon={Languages}>{t('admin.settings.preferences')}</SectionTitle>

          <div className="space-y-3">
            {onToggleLanguage && (
              <button type="button" onClick={() => { onToggleLanguage(); }} className={rowClass}>
                <span className="text-sm font-medium">{t('admin.settings.language')}</span>
                <span className={cn(
                  'px-3 py-1 text-[10px] font-bold uppercase tracking-widest border rounded-sm',
                  isDark ? 'border-stone-700 text-stone-300' : 'border-stone-300 text-stone-600',
                )}>
                  {language === 'en' ? 'English → Indonesia' : 'Indonesia → English'}
                </span>
              </button>
            )}

            {onShowTutorial && (
              <button type="button" onClick={() => { onShowTutorial(); onClose(); }} className={rowClass}>
                <span className="text-sm font-medium">{t('admin.settings.restart_tour')}</span>
                <Sparkles className="w-4 h-4 text-gold-500" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

      </div>
    </Modal>
  );
}
