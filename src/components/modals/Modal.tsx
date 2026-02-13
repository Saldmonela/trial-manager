import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  maxWidth?: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, maxWidth = 'max-w-md', children }: ModalProps) {
  const { theme } = useTheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              `w-full ${maxWidth} border shadow-2xl p-6 md:p-8 rounded-none max-h-[90vh] overflow-y-auto`,
              theme === 'light' ? "bg-white border-stone-200" : "bg-stone-900 border-stone-800"
            )}
          >
            {title && (
              <div className="flex items-center justify-between mb-8">
                <h2 className={cn("text-2xl font-serif font-bold", theme === 'light' ? "text-stone-900" : "text-stone-50")}>
                  {title}
                </h2>
                <button onClick={onClose} className={cn("transition-colors", theme === 'light' ? "text-stone-400 hover:text-stone-900" : "text-stone-500 hover:text-stone-50")}>
                  <X className="w-6 h-6" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
