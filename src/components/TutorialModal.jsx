import React, { useState, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils';
import { ChevronRight, X, Sparkles, Plus, Search, BarChart3 } from 'lucide-react';

const TOUR_STEPS = [
  {
    targetId: 'tour-stats',
    titleKey: "tutorial.steps.stats.title",
    descKey: "tutorial.steps.stats.description",
    icon: BarChart3,
    position: 'bottom'
  },
  {
    targetId: 'tour-new-family',
    titleKey: "tutorial.steps.new_family.title",
    descKey: "tutorial.steps.new_family.description",
    icon: Plus,
    position: 'bottom-left'
  },
  {
    targetId: 'tour-search',
    titleKey: "tutorial.steps.search.title",
    descKey: "tutorial.steps.search.description",
    icon: Search,
    position: 'bottom'
  }
];

export default function TutorialModal({ onClose }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(-1); // -1 is Welcome
  const [coords, setCoords] = useState(null);

  useLayoutEffect(() => {
    if (currentStep === -1) {
      setCoords(null);
      return;
    }

    let animationFrame;
    const updateCoords = () => {
      const step = TOUR_STEPS[currentStep];
      if (!step) return;
      
      const el = document.getElementById(step.targetId);
      if (el) {
        const rect = el.getBoundingClientRect();
        setCoords({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          stepPosition: step.position
        });
        animationFrame = requestAnimationFrame(updateCoords);
      }
    };

    // Scroll to element once
    const step = TOUR_STEPS[currentStep];
    const el = document.getElementById(step.targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Start continuous tracking
    animationFrame = requestAnimationFrame(updateCoords);
    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords, true);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden pointer-events-none">
      {/* Background Dim (Spotlight effect) */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-auto" onClick={onClose} />
      
      {/* Spotlight Hole */}
      {coords && (
        <motion.div
          initial={false}
          animate={{
            top: coords.top - 8,
            left: coords.left - 8,
            width: coords.width + 16,
            height: coords.height + 16,
          }}
          className="fixed bg-white/10 border-2 border-gold-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] mix-blend-overlay"
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        />
      )}

      {/* Content Container */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {currentStep === -1 ? (
             /* Welcome Modal */
             <motion.div
               key="welcome"
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className={cn(
                 "w-full max-w-lg p-10 text-center pointer-events-auto shadow-2xl relative overflow-hidden",
                 theme === 'light' ? "bg-white text-stone-900" : "bg-stone-900 text-stone-50 border border-stone-800"
               )}
             >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <Sparkles className="w-16 h-16 mx-auto mb-6 text-gold-500" />
                <h2 className="text-4xl font-serif font-bold mb-4">{t('tutorial.welcome.title')}</h2>
                <p className={cn("text-lg mb-8 leading-relaxed", theme === 'light' ? "text-stone-600" : "text-stone-400")}>
                  {t('tutorial.welcome.text')}
                </p>
                <button
                  onClick={() => setCurrentStep(0)}
                  className={cn(
                    "w-full py-4 font-bold tracking-[0.2em] uppercase transition-all hover:-translate-y-1 shadow-lg",
                    theme === 'light' ? "bg-stone-900 text-white" : "bg-white text-stone-900"
                  )}
                >
                  {t('tutorial.welcome.cta')}
                </button>
                <button onClick={onClose} className="mt-4 text-xs uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity">{t('common.skip')}</button>
             </motion.div>
          ) : (
            /* Tooltip Overlay */
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, scale: 0.95, y: 20, x: '-50%' }}
              animate={coords ? {
                opacity: 1, 
                scale: 1,
                y: 0,
                x: '-50%',
                // On Mobile: always fixed at bottom. On Desktop: follow coords
                top: window.innerWidth < 768 ? 'auto' : (coords.top + coords.height + 24),
                bottom: window.innerWidth < 768 ? '32px' : 'auto',
                left: window.innerWidth < 768 ? '50%' : (coords.left + (coords.width / 2)),
              } : { opacity: 1, y: 0, scale: 1, x: '-50%', top: '50%', left: '50%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "fixed z-[110] p-6 shadow-2xl pointer-events-auto transition-colors",
                "w-[92%] md:w-[360px] rounded-2xl md:rounded-none", 
                theme === 'light' ? "bg-white text-stone-900 border border-stone-200" : "bg-stone-900 text-stone-50 border border-stone-800"
              )}
            >
              {/* Arrow - Hidden on mobile */}
              <div className={cn(
                "hidden md:block absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-t border-l",
                theme === 'light' ? "bg-white border-stone-200" : "bg-stone-900 border-stone-800"
              )} />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                   <div className="p-2 bg-gold-500/10 rounded-lg">
                      {React.createElement(TOUR_STEPS[currentStep].icon, { className: "w-5 h-5 text-gold-500" })}
                   </div>
                   <h3 className="font-serif font-bold text-lg">{t(TOUR_STEPS[currentStep].titleKey)}</h3>
                </div>
                <p className={cn("text-sm leading-relaxed mb-6", theme === 'light' ? "text-stone-600" : "text-stone-400")}>
                  {t(TOUR_STEPS[currentStep].descKey)}
                </p>
                
                <div className="flex items-center justify-between">
                   <span className="text-[10px] uppercase tracking-widest opacity-50">{t('common.step')} {currentStep + 1} {t('common.of')} {TOUR_STEPS.length}</span>
                   <button
                     onClick={handleNext}
                     className={cn(
                       "px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all",
                       theme === 'light' ? "bg-stone-900 text-white" : "bg-white text-stone-900"
                     )}
                   >
                     {currentStep === TOUR_STEPS.length - 1 ? t('common.finish') : t('common.next')}
                   </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
