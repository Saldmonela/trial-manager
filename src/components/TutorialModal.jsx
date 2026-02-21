import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils';
import { 
  ChevronRight, ChevronLeft, X, Sparkles, 
  BarChart3, Crown, Key, Users, SlidersHorizontal,
  Inbox, LayoutGrid, Settings
} from 'lucide-react';

const STEP_ICONS_PUBLIC = [BarChart3, Crown, Key, Users, SlidersHorizontal];
const STEP_ICONS_ADMIN = [BarChart3, Inbox, LayoutGrid, Settings];

export default function TutorialModal({ onClose, publicMode = false }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(-1); // -1 = Welcome
  const isDark = theme === 'dark';

  const mode = publicMode ? 'public' : 'admin';
  const tutorial = t(`tutorial.${mode}`);
  const steps = tutorial?.steps || [];
  const welcome = tutorial?.welcome || {};
  const icons = publicMode ? STEP_ICONS_PUBLIC : STEP_ICONS_ADMIN;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else if (currentStep === 0) {
      setCurrentStep(-1);
    }
  };

  const slideVariants = {
    enter: (direction) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction) => ({ x: direction > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div className={cn(
        "relative z-10 w-[92%] max-w-lg overflow-hidden shadow-2xl",
        isDark 
          ? "bg-stone-900 border border-stone-800" 
          : "bg-white border border-stone-200"
      )}>
        {/* Close button */}
        <button 
          onClick={onClose}
          className={cn(
            "absolute top-4 right-4 z-20 p-1.5 rounded-full transition-colors",
            isDark ? "text-stone-500 hover:text-stone-300 hover:bg-stone-800" : "text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          )}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Progress bar */}
        {currentStep >= 0 && (
          <div className={cn("h-1 w-full", isDark ? "bg-stone-800" : "bg-stone-100")}>
            <motion.div 
              className="h-full bg-gold-500"
              initial={false}
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            />
          </div>
        )}

        {/* Content */}
        <div className="relative min-h-[340px] flex items-center justify-center px-8 py-10 md:px-12">
          <AnimatePresence mode="wait" custom={1}>
            {currentStep === -1 ? (
              /* Welcome Slide */
              <motion.div
                key="welcome"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="text-center w-full"
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-gold-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <Sparkles className="w-14 h-14 mx-auto mb-5 text-gold-500" />
                <h2 className={cn(
                  "text-3xl font-serif font-bold mb-3",
                  isDark ? "text-stone-50" : "text-stone-900"
                )}>
                  {welcome.title}
                </h2>
                <p className={cn(
                  "text-sm leading-relaxed mb-8 max-w-sm mx-auto",
                  isDark ? "text-stone-400" : "text-stone-500"
                )}>
                  {welcome.text}
                </p>
                <button
                  onClick={() => setCurrentStep(0)}
                  className={cn(
                    "w-full py-3.5 font-bold tracking-[0.2em] uppercase text-sm transition-all hover:-translate-y-0.5 shadow-lg",
                    isDark ? "bg-stone-50 text-stone-900" : "bg-stone-900 text-white"
                  )}
                >
                  {welcome.cta}
                </button>
                <button 
                  onClick={onClose} 
                  className="mt-3 text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity block mx-auto"
                >
                  Skip
                </button>
              </motion.div>
            ) : (
              /* Step Slides */
              <motion.div
                key={currentStep}
                custom={1}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="text-center w-full"
              >
                {/* Icon */}
                <div className={cn(
                  "w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl",
                  isDark ? "bg-gold-500/10" : "bg-gold-500/10"
                )}>
                  {React.createElement(icons[currentStep] || Sparkles, { 
                    className: "w-8 h-8 text-gold-500" 
                  })}
                </div>

                {/* Step Counter */}
                <span className={cn(
                  "text-[10px] uppercase tracking-[0.3em] font-bold mb-2 block",
                  isDark ? "text-gold-500" : "text-gold-600"
                )}>
                  Step {currentStep + 1} of {steps.length}
                </span>

                {/* Title */}
                <h3 className={cn(
                  "text-2xl font-serif font-bold mb-3",
                  isDark ? "text-stone-50" : "text-stone-900"
                )}>
                  {steps[currentStep]?.title}
                </h3>

                {/* Description */}
                <p className={cn(
                  "text-sm leading-relaxed max-w-sm mx-auto",
                  isDark ? "text-stone-400" : "text-stone-500"
                )}>
                  {steps[currentStep]?.description}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        {currentStep >= 0 && (
          <div className={cn(
            "px-8 py-5 flex items-center justify-between border-t",
            isDark ? "border-stone-800" : "border-stone-100"
          )}>
            {/* Back */}
            <button
              onClick={handlePrev}
              className={cn(
                "flex items-center gap-1 text-xs font-bold uppercase tracking-widest transition-colors",
                isDark ? "text-stone-500 hover:text-stone-300" : "text-stone-400 hover:text-stone-700"
              )}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </button>

            {/* Dots */}
            <div className="flex items-center gap-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i === currentStep 
                      ? "bg-gold-500 scale-125" 
                      : isDark ? "bg-stone-700 hover:bg-stone-600" : "bg-stone-300 hover:bg-stone-400"
                  )}
                />
              ))}
            </div>

            {/* Next / Finish */}
            <button
              onClick={handleNext}
              className={cn(
                "flex items-center gap-1 px-5 py-2 text-xs font-bold uppercase tracking-widest transition-all hover:-translate-y-0.5",
                isDark ? "bg-stone-50 text-stone-900" : "bg-stone-900 text-white"
              )}
            >
              {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
