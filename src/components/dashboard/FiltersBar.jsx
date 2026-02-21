import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { cn } from '../../utils';

export default function FiltersBar({
  theme,
  t,
  filter,
  sortBy,
  sortDirection,
  sortOptions,
  mobileSortOpen,
  setFilter,
  setMobileSortOpen,
  onSortClick,
}) {
  return (
    <div
      className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-4 border-b border-dashed"
      style={{ borderColor: theme === 'light' ? '#e7e5e4' : '#292524' }}
    >
      <div className="flex gap-6">
        {[
          { key: 'available', label: t('dashboard.filters.available') },
          { key: 'full', label: t('dashboard.filters.full') },
          { key: 'all', label: t('dashboard.filters.all') },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'text-sm font-medium transition-all duration-300 relative py-2',
              filter === f.key
                ? theme === 'light'
                  ? 'text-stone-900'
                  : 'text-stone-50'
                : theme === 'light'
                  ? 'text-stone-400 hover:text-stone-600'
                  : 'text-stone-600 hover:text-stone-400'
            )}
          >
            {f.label}
            {filter === f.key && (
              <motion.div
                layoutId="activeFilter"
                className={cn('absolute bottom-0 left-0 right-0 h-0.5', theme === 'light' ? 'bg-stone-900' : 'bg-gold-500')}
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 md:gap-4">
        <span className={cn('text-xs uppercase tracking-widest mr-2', theme === 'light' ? 'text-stone-400' : 'text-stone-600')}>
          {t('dashboard.sort.label')}
        </span>
        <div className="flex flex-col relative">
          <button
            onClick={() => setMobileSortOpen(!mobileSortOpen)}
            className={cn(
              'md:hidden flex items-center justify-between gap-2 px-4 py-2 text-xs uppercase tracking-wider font-medium border transition-colors min-w-[180px]',
              theme === 'light' ? 'bg-stone-900 text-stone-50 border-stone-900' : 'bg-stone-50 text-stone-900 border-stone-50'
            )}
          >
            <span className="flex items-center gap-2">
              {(() => {
                const activeOption = sortOptions.find((s) => s.key === sortBy);
                return activeOption ? (
                  <>
                    {sortDirection === 'desc' ? activeOption.labelAlt : activeOption.label}
                    {sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  </>
                ) : (
                  'Sort By'
                );
              })()}
            </span>
            <ChevronDown className={cn('w-3 h-3 transition-transform', mobileSortOpen ? 'rotate-180' : '')} />
          </button>

          <AnimatePresence>
            {mobileSortOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={cn(
                  'absolute top-full right-0 mt-2 w-full md:w-auto min-w-[180px] z-50 border shadow-xl md:hidden',
                  theme === 'light' ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-800'
                )}
              >
                {sortOptions.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => {
                      onSortClick(s.key);
                      setMobileSortOpen(false);
                    }}
                    className={cn(
                      'w-full text-left px-4 py-3 text-xs uppercase tracking-wider font-medium border-b last:border-0 hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between transition-colors',
                      theme === 'light' ? 'border-stone-100 text-stone-900' : 'border-stone-800 text-stone-200'
                    )}
                  >
                    <span>{sortDirection === 'desc' && sortBy === s.key ? s.labelAlt : s.label}</span>
                    {sortBy === s.key && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="hidden md:flex flex-wrap gap-2">
            {sortOptions.map((s) => (
              <button
                key={s.key}
                onClick={() => onSortClick(s.key)}
                className={cn(
                  'pl-3 pr-2 py-2 text-[10px] md:text-xs uppercase tracking-wider font-medium border transition-all whitespace-nowrap flex items-center gap-2',
                  sortBy === s.key
                    ? theme === 'light'
                      ? 'bg-stone-900 text-stone-50 border-stone-900'
                      : 'bg-stone-50 text-stone-900 border-stone-50'
                    : theme === 'light'
                      ? 'text-stone-400 border-transparent hover:border-stone-200'
                      : 'text-stone-500 border-transparent hover:border-stone-800'
                )}
              >
                {sortBy === s.key && sortDirection === 'desc' ? s.labelAlt : s.label}
                {sortBy === s.key && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
