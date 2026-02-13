import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users, Shield, Sparkles, ChevronRight, Moon, Sun, Crown, ArrowRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils';

const FeatureCard = ({ icon: Icon, title, description }) => {
  const { theme } = useTheme();
  
  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className={cn(
        "p-10 border transition-all duration-500 group relative overflow-hidden",
        theme === 'light' 
          ? "bg-white border-stone-200 hover:border-gold-500 shadow-xl" 
          : "bg-stone-900 border-stone-800 hover:border-gold-500 shadow-2xl"
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-gold-500/10 transition-colors" />
      
      <div className={cn(
        "w-14 h-14 flex items-center justify-center mb-8 rounded-2xl transition-all duration-500",
        theme === 'light' ? "bg-stone-900 shadow-lg" : "bg-stone-800 shadow-gold-500/10 shadow-lg"
      )}>
        <Icon className="w-7 h-7" color="#C6A87C" />
      </div>
      <h3 className={cn(
        "text-2xl font-serif font-bold mb-4",
        theme === 'light' ? "text-stone-900" : "text-stone-50"
      )}>{title}</h3>
      <p className={cn(
        "text-lg font-light leading-relaxed",
        theme === 'light' ? "text-stone-600" : "text-stone-400"
      )}>{description}</p>
    </motion.div>
  );
};

export default function LandingPage({ onGoToLogin }) {
  const { theme, toggleTheme } = useTheme();
  const { t, language, toggleLanguage } = useLanguage();

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-700 font-sans selection:bg-gold-500/30 overflow-x-hidden",
      theme === 'light' ? "bg-stone-50 text-stone-900" : "bg-stone-950 text-stone-50"
    )}>
      {/* Decorative Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Navigation */}
      <nav className="container mx-auto px-8 py-8 flex justify-between items-center relative z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center shadow-lg">
            <Crown className="w-5 h-5" color="#C6A87C" />
          </div>
          <span className="font-serif text-xl font-bold tracking-tight">Family Manager</span>
        </div>
        
        <div className="flex items-center gap-6">
          <button
            onClick={toggleLanguage}
            className={cn(
              "p-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors border text-[10px] font-bold",
              theme === 'light' 
                ? "border-stone-200 hover:bg-stone-200 text-stone-600" 
                : "border-stone-800 hover:bg-stone-900 text-stone-400"
            )}
          >
            {language === 'en' ? 'ID' : 'EN'}
          </button>
          
          <button
            onClick={toggleTheme}
            className={cn(
              "p-3 rounded-full transition-all hover:scale-110",
              theme === 'light' ? "bg-stone-200 text-stone-600" : "bg-stone-900 text-stone-400"
            )}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <Link
            to="/login"
            className="text-xs uppercase tracking-widest font-bold hover:text-gold-500 transition-colors"
          >
            Admin Login
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-8 pt-20 pb-32 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto"
        >
          <div className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full mb-10 text-[10px] uppercase tracking-[0.3em] font-bold border",
            theme === 'light' ? "bg-white border-stone-200 text-stone-600" : "bg-stone-900 border-stone-800 text-stone-400"
          )}>
            <Sparkles className="w-3 h-3" color="#C6A87C" />
            {t('landing.hero_tag')}
          </div>
          
          <h1 className="text-6xl md:text-8xl font-serif font-bold mb-8 leading-[1.1] tracking-tight">
            {t('landing.hero_title')} <span className="text-gold-500 italic">{t('landing.hero_subtitle')}</span>
          </h1>
          
          <p className={cn(
            "text-xl md:text-2xl font-light leading-relaxed mb-12 max-w-2xl mx-auto",
            theme === 'light' ? "text-stone-600" : "text-stone-400"
          )}>

            {t('landing.hero_desc')}
          </p>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onGoToLogin}
            className={cn(
              "group relative inline-flex items-center gap-4 px-12 py-6 font-bold rounded-none text-sm uppercase tracking-[0.4em] shadow-2xl overflow-hidden",
              theme === 'light' ? "bg-stone-900 text-white" : "bg-white text-stone-900"
            )}
          >
            <span className="relative z-10">{t('landing.cta_get_started')}</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300 relative z-10" color={theme === 'light' ? "#ffffff" : "#1C1917"} />
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gold-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
          </motion.button>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-8 py-32 relative z-10">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={Shield}
            title={t('landing.features.secure_vault.title')}
            description={t('landing.features.secure_vault.desc')}
          />
          <FeatureCard 
            icon={Users}
            title={t('landing.features.smart_monitoring.title')}
            description={t('landing.features.smart_monitoring.desc')}
          />
          <FeatureCard 
            icon={Sparkles}
            title={t('landing.features.premium_ui.title')}
            description={t('landing.features.premium_ui.desc')}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className={cn(
        "container mx-auto px-8 py-12 border-t text-center opacity-50 text-[10px] uppercase tracking-[0.3em]",
        theme === 'light' ? "border-stone-200" : "border-stone-900 font-bold"
      )}>
        &copy; 2026 Family Manager AI. All Rights Reserved.
      </footer>
    </div>
  );
}
