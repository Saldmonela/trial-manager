import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import type { Toast, ToastType } from '../../types';

const icons: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const bgColors: Record<ToastType, string> = {
  success: 'bg-emerald-900/90 border-emerald-700 text-emerald-50',
  error: 'bg-red-900/90 border-red-700 text-red-50',
  warning: 'bg-amber-900/90 border-amber-700 text-amber-50',
  info: 'bg-stone-800/90 border-stone-700 text-stone-50',
};

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: number) => void;
}

export default function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type] || icons.info;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              className={`pointer-events-auto flex items-center gap-3 px-5 py-4 border backdrop-blur-sm shadow-2xl ${bgColors[toast.type] || bgColors.info}`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium flex-1">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
