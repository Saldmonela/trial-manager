import React, { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils';
interface ModalProps { isOpen: boolean; onClose: () => void; title?: string | null; ariaLabel?: string; maxWidth?: string; children: React.ReactNode; }
const focusable = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
export default function Modal({ isOpen, onClose, title, ariaLabel='Konfirmasi', maxWidth='max-w-md', children }: ModalProps) {
  const { theme } = useTheme(); const dialog = useRef<HTMLDivElement>(null); const close = useRef(onClose); const titleId = useId();
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => (dialog.current?.querySelector<HTMLElement>(focusable) || dialog.current)?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>(focusable) || []).filter(element => !element.matches(':disabled'));
      if (!elements.length) { event.preventDefault(); dialog.current?.focus(); return; }
      const first = elements[0], last = elements[elements.length-1];
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', keydown, true); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, [isOpen]);
  return <AnimatePresence>{isOpen && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-sm p-4" onClick={onClose}>
    <motion.div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : ariaLabel} tabIndex={-1} initial={{scale:.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:.95,opacity:0}} onClick={event=>event.stopPropagation()} className={cn('w-full '+maxWidth+' border shadow-2xl p-6 md:p-8 rounded-none max-h-[90vh] overflow-y-auto',theme==='light'?'bg-white border-stone-200':'bg-stone-900 border-stone-800')}>
      {title && <div className="flex items-center justify-between mb-8"><h2 id={titleId} className="text-2xl font-serif font-bold">{title}</h2><button type="button" aria-label="Tutup dialog" onClick={onClose}><X className="w-6 h-6"/></button></div>}
      {children}
    </motion.div>
  </motion.div>}</AnimatePresence>;
}
