import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../../utils';

export default function MetricsRow({
  theme,
  t,
  stats,
  familiesCount,
  expiringSoonCount,
  onExpiringSoonClick,
}) {
  return (
    <>
      <div
        id="tour-stats"
        className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-l mb-12 select-none"
        style={{ borderColor: theme === 'light' ? '#e7e5e4' : '#292524' }}
      >
        {[
          { label: t('dashboard.stats.total_families'), value: stats.total, color: theme === 'light' ? 'text-stone-900' : 'text-stone-50' },
          {
            label: t('dashboard.stats.full_capacity'),
            value: `${stats.full}/${familiesCount}`,
            percentage: familiesCount > 0 ? (stats.full / familiesCount) * 100 : 0,
            type: 'capacity',
          },
          {
            label: t('dashboard.stats.available_slots'),
            value: `${stats.availableSlots}/${familiesCount * 5}`,
            percentage: familiesCount * 5 > 0 ? (stats.availableSlots / (familiesCount * 5)) * 100 : 0,
            type: 'slots',
          },
          { label: t('dashboard.stats.total_members'), value: stats.totalMembers, color: 'text-amber-600' },
        ].map((stat, idx) => {
          let statusTheme = { bg: '', text: stat.color || '', accent: '', label: '' };

          if (stat.percentage !== undefined) {
            if (stat.type === 'capacity') {
              if (stat.percentage > 80) {
                statusTheme = { bg: theme === 'light' ? 'bg-red-50' : 'bg-red-950/40', text: 'text-red-600', accent: 'bg-red-600', label: t('dashboard.stats.status.critical_full') };
              } else if (stat.percentage > 50) {
                statusTheme = { bg: theme === 'light' ? 'bg-amber-50' : 'bg-amber-950/40', text: 'text-amber-600', accent: 'bg-amber-600', label: t('dashboard.stats.status.high_usage') };
              } else {
                statusTheme = { bg: '', text: theme === 'light' ? 'text-stone-900' : 'text-stone-50', accent: 'bg-stone-500', label: t('dashboard.stats.status.stable') };
              }
            } else if (stat.percentage < 20) {
              statusTheme = { bg: theme === 'light' ? 'bg-red-50' : 'bg-red-950/40', text: 'text-red-600', accent: 'bg-red-600', label: t('dashboard.stats.status.critical_low') };
            } else if (stat.percentage < 50) {
              statusTheme = { bg: theme === 'light' ? 'bg-amber-50' : 'bg-amber-950/40', text: 'text-amber-600', accent: 'bg-amber-600', label: t('dashboard.stats.status.moderate') };
            } else {
              statusTheme = { bg: theme === 'light' ? 'bg-emerald-50' : 'bg-emerald-950/20', text: 'text-emerald-600', accent: 'bg-emerald-600', label: t('dashboard.stats.status.spacious') };
            }
          }

          return (
            <div
              key={idx}
              className={cn(
                'p-6 border-b border-r flex flex-col justify-between aspect-[4/3] group transition-all duration-500 relative overflow-hidden',
                theme === 'light' ? 'border-stone-200' : 'border-stone-800',
                statusTheme.bg || (theme === 'light' ? 'hover:bg-stone-50' : 'hover:bg-stone-900/50')
              )}
            >
              {stat.percentage !== undefined && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${stat.percentage}%` }}
                  className={cn('absolute bottom-0 left-0 w-1 opacity-20', statusTheme.accent)}
                />
              )}

              <div className="relative z-10 flex flex-col justify-between h-full">
                <span
                  className={cn(
                    'text-[10px] uppercase tracking-[0.2em] font-bold transition-colors',
                    statusTheme.bg ? statusTheme.text : theme === 'light' ? 'text-stone-400' : 'text-stone-500'
                  )}
                >
                  {stat.label}
                </span>

                <div className="flex flex-col gap-1">
                  <span
                    className={cn(
                      'font-serif text-3xl lg:text-5xl font-bold tracking-tighter break-all transition-colors',
                      statusTheme.text
                    )}
                  >
                    {stat.value}
                  </span>

                  {stat.percentage !== undefined && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className={cn('text-[9px] font-bold tracking-widest', statusTheme.text)}>{statusTheme.label}</span>
                      <span className={cn('text-[10px] font-mono opacity-40', statusTheme.text)}>{Math.round(stat.percentage)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {expiringSoonCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onExpiringSoonClick}
          className={cn(
            'mb-8 p-4 border flex items-center justify-between cursor-pointer transition-colors group',
            theme === 'light' ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' : 'bg-amber-950/20 border-amber-900/50 hover:bg-amber-950/40'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-full', theme === 'light' ? 'bg-amber-100 text-amber-600' : 'bg-amber-900/50 text-amber-500')}>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className={cn('font-bold uppercase tracking-widest text-xs', theme === 'light' ? 'text-amber-900' : 'text-amber-500')}>
              Attention Needed: {expiringSoonCount} expiring this week
            </span>
          </div>
          <span className={cn('text-xs underline decoration-dotted underline-offset-4 group-hover:text-amber-600', theme === 'light' ? 'text-amber-800' : 'text-amber-500')}>
            View All
          </span>
        </motion.div>
      )}
    </>
  );
}
