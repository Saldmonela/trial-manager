import React from 'react';
import { Plus, Sparkles, Sun, Moon, Inbox } from 'lucide-react';
import { cn } from '../../utils';

export default function DashboardHeader({
  theme,
  t,
  language,
  onLogout,
  onShowTutorial,
  onToggleLanguage,
  onToggleTheme,
  onOpenAddFamily,
  onOpenJoinRequests,
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-300',
        theme === 'light' ? 'bg-stone-50/90 border-stone-200' : 'bg-stone-950/90 border-stone-800'
      )}
    >
      <div className="container mx-auto px-4 py-4 md:px-6 md:py-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="text-center md:text-left w-full md:w-auto">
          <h1
            className={cn(
              'font-serif text-2xl md:text-2xl font-bold tracking-tight',
              theme === 'light' ? 'text-stone-900' : 'text-white'
            )}
          >
            {t('dashboard.title')} <span className="text-gold-500 italic">{t('dashboard.subtitle')}</span>
          </h1>
          <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
            <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] opacity-60">{t('auth.premium_dashboard')}</p>
            <span className="text-stone-300 dark:text-stone-700">|</span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 border border-gold-500/50 bg-gold-500/10 text-gold-500 text-[10px] uppercase tracking-widest font-bold">
              <Plus className="w-2.5 h-2.5 rotate-45" /> Admin
            </span>
            <span className="text-stone-300 dark:text-stone-700">|</span>
            <button
              onClick={onLogout}
              className="text-[10px] md:text-xs uppercase tracking-widest text-red-400 hover:text-red-500 transition-colors py-2 md:py-0"
            >
              {t('auth.logout')}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-center md:justify-end">
          <button
            onClick={onShowTutorial}
            className={cn(
              'p-3 md:p-2 rounded-full transition-colors flex items-center gap-2 px-3',
              theme === 'light' ? 'hover:bg-stone-200 text-stone-600' : 'hover:bg-stone-800 text-stone-400'
            )}
            title="Restart Tour"
          >
            <Sparkles className="w-5 h-5 md:w-4 md:h-4 text-gold-500" />
            <span className="text-[10px] uppercase tracking-widest font-bold hidden md:inline">{t('dashboard.help')}</span>
          </button>

          <button
            onClick={onToggleLanguage}
            className={cn(
              'p-0 w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-full transition-colors border text-[10px] font-bold',
              theme === 'light'
                ? 'border-stone-200 hover:bg-stone-200 text-stone-600'
                : 'border-stone-800 hover:bg-stone-800 text-stone-400'
            )}
          >
            {language === 'en' ? 'ID' : 'EN'}
          </button>

          <button
            onClick={onToggleTheme}
            className={cn(
              'p-3 md:p-2 rounded-full transition-colors',
              theme === 'light' ? 'hover:bg-stone-200 text-stone-600' : 'hover:bg-stone-800 text-stone-400'
            )}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          
          <button
            onClick={onOpenJoinRequests}
            className={cn(
              'p-3 md:p-2 rounded-full transition-colors flex items-center justify-center',
              theme === 'light' ? 'hover:bg-stone-200 text-stone-600' : 'hover:bg-stone-800 text-stone-400'
            )}
            title="Join Requests"
          >
            <Inbox className="w-5 h-5" />
          </button>

          <button
            id="tour-new-family"
            onClick={onOpenAddFamily}
            className={cn(
              'flex items-center gap-2 px-4 py-3 md:px-6 md:py-2.5 font-medium rounded-none transition-all shadow-sm text-sm md:text-base whitespace-nowrap min-h-[44px]',
              theme === 'light' ? 'bg-stone-900 text-stone-50 hover:bg-stone-800' : 'bg-stone-50 text-stone-900 hover:bg-stone-200'
            )}
          >
            <Plus className="w-5 h-5 md:w-4 md:h-4" />
            {t('dashboard.new_family')}
          </button>
        </div>
      </div>
    </header>
  );
}
