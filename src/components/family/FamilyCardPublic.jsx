import React from 'react';
import { UserPlus } from 'lucide-react';
import { getDaysRemaining, getExpiryStatus, MAX_FAMILY_SLOTS } from '../../hooks/useLocalStorage';
import { cn } from '../../utils';

export default function FamilyCardPublic({ family, theme, onJoinClick }) {
  const daysRemaining = getDaysRemaining(family.expiryDate);
  const expiryStatus = getExpiryStatus(daysRemaining);
  const slotsAvailable = Math.max(0, Math.min(MAX_FAMILY_SLOTS, family.slotsAvailable ?? MAX_FAMILY_SLOTS));
  const slotsUsed = Math.max(0, MAX_FAMILY_SLOTS - slotsAvailable);
  const showStorage = typeof family.storageUsed === 'number';

  return (
    <article
      className={cn(
        'group rounded-none border transition-all duration-300 relative overflow-hidden flex flex-col',
        theme === 'light'
          ? 'bg-white border-stone-200 shadow-[4px_4px_0px_0px_rgba(28,25,23,0.05)] hover:shadow-[4px_4px_0px_0px_rgba(198,168,124,1)] hover:border-gold-500'
          : 'bg-stone-900 border-stone-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] hover:shadow-[4px_4px_0px_0px_rgba(198,168,124,0.5)] hover:border-gold-500'
      )}
    >
      <div
        className={cn(
          'absolute top-0 right-0 z-10 px-4 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm transition-all',
          expiryStatus.color === 'red'
            ? 'bg-red-500 text-white animate-pulse'
            : expiryStatus.color === 'yellow'
              ? 'bg-amber-500 text-black animate-pulse'
              : expiryStatus.color === 'green'
                ? 'bg-emerald-500 text-white'
                : 'bg-stone-500 text-white'
        )}
      >
        {expiryStatus.text}
      </div>

      <div
        className={cn(
          'p-6 border-b transition-colors',
          theme === 'light' ? 'bg-stone-50 border-stone-200' : 'bg-stone-800/50 border-stone-800'
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'w-12 h-12 flex items-center justify-center font-serif text-xl font-bold border rounded-none shrink-0 bg-transparent',
                theme === 'light' ? 'border-stone-900 text-stone-900' : 'border-stone-50 text-stone-50'
              )}
            >
              {(() => {
                const name = family.familyName || 'GM';
                const parts = name.trim().split(' ');
                return parts.length > 1
                  ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                  : name.substring(0, 2).toUpperCase();
              })()}
            </div>
            <div>
              <h3
                className={cn(
                  'font-serif text-xl font-bold tracking-tight',
                  theme === 'light' ? 'text-stone-900' : 'text-stone-50'
                )}
              >
                {family.familyName || 'Family Plan'}
              </h3>
              <p className={cn('text-xs uppercase tracking-widest font-medium mt-1', theme === 'light' ? 'text-stone-500' : 'text-stone-400')}>
                {family.serviceName || 'GOOGLE AI PRO'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <div className="mb-6">
          <div className="flex items-end justify-between text-sm mb-2">
            <span className={cn('font-serif italic', theme === 'light' ? 'text-stone-500' : 'text-stone-400')}>Capacity</span>
            <span className={cn('font-mono text-xs', slotsAvailable === 0 ? 'text-olive' : 'text-stone-500')}>
              {slotsUsed} / {MAX_FAMILY_SLOTS}
            </span>
          </div>

          <div className="flex gap-1 h-1.5">
            {[...Array(MAX_FAMILY_SLOTS)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  'flex-1 transition-all duration-500',
                  i < slotsUsed
                    ? theme === 'light'
                      ? 'bg-stone-900'
                      : 'bg-stone-50'
                    : theme === 'light'
                      ? 'bg-stone-200'
                      : 'bg-stone-800'
                )}
              />
            ))}
          </div>

          {slotsAvailable > 0 && (
            <p className={cn('text-xs mt-2 font-medium uppercase tracking-wider text-right', theme === 'light' ? 'text-stone-400' : 'text-stone-500')}>
              {slotsAvailable} Available
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <p className={cn('text-xs uppercase tracking-widest font-medium mb-1', theme === 'light' ? 'text-stone-400' : 'text-stone-500')}>
              Expires
            </p>
            <p className={cn('font-serif font-medium', theme === 'light' ? 'text-stone-900' : 'text-stone-200')}>
              {family.expiryDate
                ? new Date(family.expiryDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'No Date Set'}
            </p>
          </div>
        </div>

        {showStorage && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className={cn('font-medium uppercase tracking-widest', theme === 'light' ? 'text-stone-400' : 'text-stone-500')}>
                Storage
              </span>
              <span className={cn('font-mono', theme === 'light' ? 'text-stone-900' : 'text-stone-50')}>
                {family.storageUsed || 0}GB <span className="text-stone-400">/ 2048GB</span>
              </span>
            </div>
            <div className={cn('w-full h-1.5 relative', theme === 'light' ? 'bg-stone-200' : 'bg-stone-800')}>
              <div
                className={cn(
                  'absolute top-0 left-0 h-full transition-all duration-500',
                  (family.storageUsed || 0) >= 2048 ? 'bg-wine' : 'bg-stone-900 dark:bg-stone-50'
                )}
                style={{ width: `${Math.min(((family.storageUsed || 0) / 2048) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={onJoinClick}
          className={cn(
            'mt-auto w-full py-2.5 px-4 flex items-center justify-center gap-2 text-xs uppercase tracking-widest font-bold border transition-all duration-300',
            theme === 'light'
              ? 'bg-stone-900 border-stone-900 text-stone-50 hover:bg-stone-700 hover:border-stone-700'
              : 'bg-stone-50 border-stone-50 text-stone-900 hover:bg-gold-500 hover:border-gold-500 hover:text-stone-900'
          )}
        >
          <UserPlus className="w-4 h-4" />
          Request Slot
        </button>
      </div>
    </article>
  );
}
