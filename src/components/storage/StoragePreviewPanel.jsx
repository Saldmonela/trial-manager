import React from 'react';
import { motion } from 'framer-motion';
import { X, FlaskConical } from 'lucide-react';
import { cn } from '../../utils';

const PRESETS = [25, 55, 78, 95];

/**
 * Kontrol mode simulasi. TIDAK menggambar visualnya sendiri — nilai `pct` di-override
 * langsung ke kartu Total Storage & tiap kartu akun (lihat StoragePage), pakai total
 * storage ASLI masing-masing. Murni pratinjau; tidak mengubah data tersimpan.
 */
export default function StoragePreviewPanel({ theme, pct, onChange, onClose }) {
  const isDark = theme === 'dark';
  const stateLabel = pct >= 90 ? 'Critical (≥90%)' : pct >= 70 ? 'Warning (70–89%)' : 'Healthy (<70%)';
  const stateColor = pct >= 90
    ? 'text-red-500'
    : pct >= 70
      ? 'text-amber-500'
      : (isDark ? 'text-emerald-400' : 'text-emerald-600');

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className={cn('border p-4 md:p-5', isDark ? 'bg-stone-900 border-gold-600/40' : 'bg-gold-500/5 border-gold-500/40')}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <FlaskConical className="w-4 h-4 text-gold-500 shrink-0" />
            <span className={cn('text-xs font-bold uppercase tracking-widest', isDark ? 'text-stone-200' : 'text-stone-800')}>
              Mode Simulasi
            </span>
            <span className={cn('text-[11px] truncate', isDark ? 'text-stone-500' : 'text-stone-500')}>
              — pratinjau warna di kartu asli, bukan data sebenarnya
            </span>
          </div>
          <button
            onClick={onClose}
            title="Tutup simulasi"
            className={cn('p-1.5 rounded-full transition-colors shrink-0', isDark ? 'hover:bg-stone-800 text-stone-400' : 'hover:bg-stone-200 text-stone-500')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <span className={cn('font-serif text-2xl font-bold tabular-nums', isDark ? 'text-stone-50' : 'text-stone-900')}>{pct}%</span>
          <span className={cn('text-xs font-bold uppercase tracking-widest', stateColor)}>{stateLabel}</span>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={pct}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn('w-full cursor-pointer', isDark ? 'accent-stone-200' : 'accent-stone-800')}
        />

        <div className="flex flex-wrap gap-2 mt-3">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={cn(
                'px-3 py-1 text-xs font-bold uppercase tracking-widest border transition-colors',
                pct === p
                  ? (isDark ? 'bg-stone-100 text-stone-900 border-stone-100' : 'bg-stone-900 text-stone-50 border-stone-900')
                  : (isDark ? 'border-stone-800 text-stone-300 hover:bg-stone-800' : 'border-stone-300 text-stone-700 hover:bg-stone-100'),
              )}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
