import React from 'react';
import { motion } from 'framer-motion';
import { Database } from 'lucide-react';
import { cn, formatBytes } from '../../utils';
import RadialGauge from './RadialGauge';

/**
 * Kartu ringkasan kuota gabungan (pool-aware) dari semua akun terhubung.
 * Hero = ring gauge persen pemakaian; di sampingnya Used / Available / Total.
 */
export default function StorageAggregateCard({ theme, aggregate, simulatePct = null }) {
  const isDark = theme === 'dark';
  const { totalBytes, usedBytes: realUsed, availableBytes: realAvailable, accountCount, hasUnlimited } = aggregate;

  // Mode simulasi: used = simulatePct% dari TOTAL ASLI; sisanya menyesuaikan. Total tetap asli.
  const simulating = simulatePct != null && totalBytes > 0;
  const usedBytes = simulating ? (simulatePct / 100) * totalBytes : realUsed;
  const availableBytes = simulating ? Math.max(0, totalBytes - usedBytes) : realAvailable;

  const pct = totalBytes > 0 ? Math.min(100, (usedBytes / totalBytes) * 100) : 0;
  const isUnlimitedOnly = hasUnlimited && (!totalBytes || totalBytes === 0);
  const ringColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981';
  const centerLabel = isUnlimitedOnly ? '∞' : `${Math.round(pct)}%`;

  const stat = (label, value) => (
    <div className="flex items-center justify-between gap-3">
      <span className={cn('text-[10px] uppercase tracking-widest font-bold', isDark ? 'text-stone-500' : 'text-stone-400')}>
        {label}
      </span>
      <span className={cn('font-serif text-sm sm:text-lg md:text-xl font-bold', isDark ? 'text-stone-50' : 'text-stone-900')}>
        {value}
      </span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden border p-4 sm:p-6 md:p-8',
        isDark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className={cn(
            'w-10 h-10 flex items-center justify-center border-2 shrink-0',
            isDark ? 'border-stone-700 bg-stone-800 text-gold-500' : 'border-stone-200 bg-stone-50 text-gold-600',
          )}
        >
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h2 className={cn('font-serif text-xl font-bold', isDark ? 'text-stone-50' : 'text-stone-900')}>
            Total Storage
          </h2>
          <p className={cn('text-xs', isDark ? 'text-stone-500' : 'text-stone-400')}>
            {accountCount} {accountCount === 1 ? 'account' : 'accounts'} connected
            {hasUnlimited && ' • includes unlimited'}
          </p>
        </div>
      </div>

      {/* Ring gauge + stats */}
      <div className="flex flex-row items-center gap-4 sm:gap-6 md:gap-10">
        {/* Mobile Gauge (size 100) */}
        <div className="block sm:hidden shrink-0">
          <RadialGauge
            pct={pct}
            label={centerLabel}
            sublabel={isUnlimitedOnly ? '' : 'used'}
            color={ringColor}
            isDark={isDark}
            size={100}
            stroke={10}
          />
        </div>
        {/* Desktop Gauge (size 150) */}
        <div className="hidden sm:block shrink-0">
          <RadialGauge
            pct={pct}
            label={centerLabel}
            sublabel={isUnlimitedOnly ? '' : 'used'}
            color={ringColor}
            isDark={isDark}
            size={150}
            stroke={14}
          />
        </div>
        <div className="flex-1 space-y-2 sm:space-y-4">
          {stat('Used', formatBytes(usedBytes))}
          <div className={cn('border-t', isDark ? 'border-stone-800' : 'border-stone-100')} />
          {stat('Available', isUnlimitedOnly ? '∞' : formatBytes(availableBytes))}
          <div className={cn('border-t', isDark ? 'border-stone-800' : 'border-stone-100')} />
          {stat('Total', totalBytes > 0 ? formatBytes(totalBytes) : (hasUnlimited ? '∞' : '0 B'))}
        </div>
      </div>

      {/* Usage bar */}
      <div className="mt-6 flex items-center gap-3">
        <div className={cn('h-3 flex-1 overflow-hidden rounded-full', isDark ? 'bg-stone-800' : 'bg-stone-200')}>
          {totalBytes > 0 && pct > 0 && (
            <div
              style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: ringColor }}
              className="h-full rounded-full transition-all duration-500 ease-out"
            />
          )}
        </div>
        <span
          className="text-xs uppercase tracking-widest font-bold tabular-nums shrink-0"
          style={{ color: ringColor }}
        >
          {isUnlimitedOnly ? '∞' : `${Math.round(pct)}%`}
        </span>
      </div>
    </motion.div>
  );
}
