import React, { useState, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../utils';
import { ChevronRight, X, Sparkles, Plus, Search, BarChart3 } from 'lucide-react';

const TOUR_STEPS = [
  {
    targetId: 'tour-stats',
    title: "Quick Statistics",
    description: "Monitor your entire collection at a glance. See total families, available slots, and member counts.",
    icon: BarChart3,
    position: 'bottom'
  },
  {
    targetId: 'tour-new-family',
    title: "Create Your First Plan",
    description: "Click here to add a new Google AI Family. You can input the owner's email, password, and set renewal alerts.",
    icon: Plus,
    position: 'bottom-left'
  },
  {
    targetId: 'tour-search',
    title: "Powerful Search",
    description: "Looking for a specific member or email? Find which family they belong to instantly across all your accounts.",
    icon: Search,
    position: 'bottom'
  }
];

export default function TutorialModal({ onClose }) {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(-1); // -1 is Welcome
  const [coords, setCoords] = useState(null);

  useLayoutEffect(() => {
    if (currentStep === -1) {
      setCoords(null);
      return;
    }

    const updateCoords = () => {
      const step = TOUR_STEPS[currentStep];
      const el = document.getElementById(step.targetId);
      if (el) {
        const rect = el.getBoundingClientRect();
        setCoords({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
          stepPosition: step.position
        });
        
        // Scroll to element
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    updateCoords();
    window.addEventListener('resize', updateCoords);
    return () => window.removeEventListener('resize', updateCoords);
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
          className="absolute bg-white/10 border-2 border-gold-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] mix-blend-overlay"
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
                <h2 className="text-4xl font-serif font-bold mb-4">Welcome Home</h2>
                <p className={cn("text-lg mb-8 leading-relaxed", theme === 'light' ? "text-stone-600" : "text-stone-400")}>
                  Ready to manage your premium Google AI plans with pure elegance? 
                  Let's show you how it works in 3 seconds.
                </p>
                <button
                  onClick={() => setCurrentStep(0)}
                  className={cn(
                    "w-full py-4 font-bold tracking-[0.2em] uppercase transition-all hover:-translate-y-1 shadow-lg",
                    theme === 'light' ? "bg-stone-900 text-white" : "bg-white text-stone-900"
                  )}
                >
                  Start Guided Tour
                </button>
                <button onClick={onClose} className="mt-4 text-xs uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity">Skip Intro</button>
             </motion.div>
          ) : (
            /* Tooltip Overlay */
            <motion.div
              key={currentStep}
              style={{
                top: coords ? (coords.top + coords.height + 24) : '50%',
                left: coords ? (coords.left + coords.width / 2) : '50%',
                transform: 'translateX(-50%)',
                position: 'fixed'
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "w-[340px] p-6 shadow-2xl pointer-events-auto relative",
                theme === 'light' ? "bg-white text-stone-900 border border-stone-200" : "bg-stone-900 text-stone-50 border border-stone-800"
              )}
            >
              {/* Arrow */}
              <div className={cn(
                "absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-t border-l",
                theme === 'light' ? "bg-white border-stone-200" : "bg-stone-900 border-stone-800"
              )} />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                   <div className="p-2 bg-gold-500/10 rounded-lg">
                      {React.createElement(TOUR_STEPS[currentStep].icon, { className: "w-5 h-5 text-gold-500" })}
                   </div>
                   <h3 className="font-serif font-bold text-lg">{TOUR_STEPS[currentStep].title}</h3>
                </div>
                <p className={cn("text-sm leading-relaxed mb-6", theme === 'light' ? "text-stone-600" : "text-stone-400")}>
                  {TOUR_STEPS[currentStep].description}
                </p>
                
                <div className="flex items-center justify-between">
                   <span className="text-[10px] uppercase tracking-widest opacity-50">Step {currentStep + 1} of {TOUR_STEPS.length}</span>
                   <button
                     onClick={handleNext}
                     className={cn(
                       "px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all",
                       theme === 'light' ? "bg-stone-900 text-white" : "bg-white text-stone-900"
                     )}
                   >
                     {currentStep === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
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
