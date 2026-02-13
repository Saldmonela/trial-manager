import React from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, Crown } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../utils';

/**
 * Login page with Google Sign-In, theme toggle, and language toggle.
 * Extracted from App.jsx for modularity.
 */
export default function LoginPage({ onLogin }) {
  const { theme, toggleTheme } = useTheme();
  const { t, language, toggleLanguage } = useLanguage();

  return (
    <div className={cn(
      "min-h-screen flex flex-col items-center justify-center transition-colors duration-500 font-sans selection:bg-gold-500/30",
      theme === 'light' ? "bg-stone-50 text-stone-900" : "bg-stone-950 text-stone-50"
    )}>
       <div className="flex absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          className={cn(
            "p-2 rounded-full transition-colors",
            theme === 'light' ? "hover:bg-stone-200 text-stone-600" : "hover:bg-stone-800 text-stone-400"
          )}
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
        <button
           onClick={toggleLanguage}
           className={cn(
             "p-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors border text-[10px] font-bold ml-2",
             theme === 'light' 
               ? "border-stone-200 hover:bg-stone-200 text-stone-600" 
               : "border-stone-800 hover:bg-stone-800 text-stone-400"
           )}
        >
          {language === 'en' ? 'ID' : 'EN'}
        </button>
      </div>

      <div className="w-full max-w-md p-8 text-center space-y-8">
        <motion.div
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           className="flex flex-col items-center gap-4"
        >
          <div className={cn(
            "w-16 h-16 flex items-center justify-center rounded-2xl shadow-2xl skew-y-3",
            theme === 'light' ? "bg-stone-900" : "bg-stone-800"
          )}>
            <Crown className="w-8 h-8" color="#C6A87C" />
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">{t('dashboard.subtitle')}</h1>
          <p className={cn("text-sm uppercase tracking-widest", theme === 'light' ? "text-stone-500" : "text-stone-400")}>
             {t('auth.premium_dashboard')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "p-8 border shadow-xl rounded-none space-y-6",
            theme === 'light' ? "bg-white border-stone-200" : "bg-stone-900 border-stone-800"
          )}
        >
           <div className="space-y-2">
             <h2 className={cn("font-serif text-xl font-bold", theme === 'light' ? "text-stone-900" : "text-stone-50")}>
               {t('auth.welcome_back')}
             </h2>
             <p className={cn("text-sm", theme === 'light' ? "text-stone-500" : "text-stone-400")}>
               {t('auth.sign_in_subtitle')}
             </p>
           </div>

           <button
             onClick={onLogin}
             className={cn(
               "w-full group relative flex items-center justify-center gap-3 px-6 py-4 font-bold rounded-none text-xs uppercase tracking-widest transition-all hover:-translate-y-1 shadow-lg",
               theme === 'light' 
                 ? "bg-stone-900 text-stone-50 hover:bg-stone-800" 
                 : "bg-white text-stone-950 hover:bg-stone-200"
             )}
           >
             <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
             </svg>
             {t('auth.continue_google')}
           </button>
        </motion.div>
        
        <p className={cn("text-xs opacity-50", theme === 'light' ? "text-stone-400" : "text-stone-600")}>
          {t('auth.terms')}
        </p>
      </div>
    </div>
  );
}
