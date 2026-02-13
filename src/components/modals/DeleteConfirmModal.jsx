import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import Modal from './Modal';
import { cn } from '../../utils';

export default function DeleteConfirmModal({ isOpen, onClose, onConfirm, familyName }) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={null} maxWidth="max-w-sm">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className={cn("p-4 rounded-full", theme === 'light' ? "bg-red-100 text-red-600" : "bg-red-900/20 text-red-500")}>
            <AlertTriangle className="w-8 h-8" />
          </div>
        </div>
        
        <h3 className={cn("text-xl font-serif font-bold mb-3", theme === 'light' ? "text-stone-900" : "text-stone-50")}>
          {t('dashboard.delete_modal.title')}
        </h3>
        
        <p className={cn("text-sm mb-8 leading-relaxed", theme === 'light' ? "text-stone-500" : "text-stone-400")}>
          <span className="font-bold">"{familyName}"</span><br/>
          {t('dashboard.delete_modal.description')}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest transition-colors"
          >
            {t('dashboard.delete_modal.confirm')}
          </button>
          <button
            onClick={onClose}
            className={cn(
              "w-full py-3 font-bold text-xs uppercase tracking-widest transition-colors",
              theme === 'light' ? "text-stone-400 hover:text-stone-900" : "text-stone-500 hover:text-stone-300"
            )}
          >
            {t('dashboard.delete_modal.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
