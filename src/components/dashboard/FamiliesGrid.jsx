import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Plus, SearchX } from 'lucide-react';
import { cn } from '../../utils';
import FamilyCardAdmin from '../family/FamilyCardAdmin';

export default function FamiliesGrid({
  theme,
  t,
  sortedFamilies,
  hasAnyFamilies = false,
  onClearFilters,
  onOpenAddFamily,
  onDelete,
  onEdit,
  onAddMember,
  onRemoveMember,
  onEditMember,
  onCancelSale,
  pendingOrdersByFamily = {},
  onApproveOrder,
  onRejectOrder,
  readOnly = false,
  onRequest,
  highlightedFamilyId = null,
  forceExpandFamilyId = null,
  highlightedEmail = null,
  connectedAccounts = [],
  onConnectDrive,
  onSyncDrive,
  onDisconnectDrive,
}) {
  if (sortedFamilies.length === 0) {
    if (hasAnyFamilies) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'relative text-center py-20 px-8 border border-dashed',
            theme === 'light' ? 'bg-stone-50 border-stone-300' : 'bg-stone-900/40 border-stone-800'
          )}
        >
          <div className="relative z-10 flex flex-col items-center">
            <div className={cn(
              'w-16 h-16 mb-6 flex items-center justify-center border-2',
              theme === 'light' ? 'border-stone-200 bg-white text-stone-400' : 'border-stone-700 bg-stone-900 text-stone-500'
            )}>
              <SearchX className="w-7 h-7" />
            </div>
            <h3 className={cn('text-2xl font-serif font-bold mb-3 tracking-tight', theme === 'light' ? 'text-stone-900' : 'text-stone-50')}>
              {t ? t('dashboard.no_match.title') : 'No families match'}
            </h3>
            <p className={cn('max-w-sm mx-auto mb-8 text-sm', theme === 'light' ? 'text-stone-500' : 'text-stone-400')}>
              {t ? t('dashboard.no_match.description') : 'Try adjusting your search terms or filters.'}
            </p>
            {onClearFilters && (
              <button
                onClick={onClearFilters}
                className={cn(
                  'inline-flex items-center gap-2 px-6 py-3 font-bold rounded-none text-[10px] uppercase tracking-[0.2em] transition-all hover:-translate-y-0.5 border',
                  theme === 'light' ? 'border-stone-300 text-stone-700 hover:bg-stone-100' : 'border-stone-700 text-stone-300 hover:bg-stone-800'
                )}
              >
                {t ? t('dashboard.no_match.reset') : 'Reset filters'}
              </button>
            )}
          </div>
        </motion.div>
      );
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'relative text-center py-24 px-8 overflow-hidden group border',
          theme === 'light' ? 'bg-white border-stone-200 shadow-xl' : 'bg-stone-900 border-stone-800 shadow-2xl'
        )}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            className={cn(
              'w-24 h-24 mb-8 flex items-center justify-center rounded-3xl shadow-2xl relative',
              theme === 'light' ? 'bg-stone-900 text-gold-500' : 'bg-stone-800 text-gold-500'
            )}
          >
            <div className="absolute inset-0 bg-gold-500/20 blur-xl rounded-full scale-75 group-hover:scale-125 transition-transform duration-700" />
            <Crown className="w-10 h-10 relative z-10" color="#C6A87C" />
          </motion.div>

          <h3 className={cn('text-4xl font-serif font-bold mb-6 tracking-tight', theme === 'light' ? 'text-stone-900' : 'text-stone-50')}>
            Begin Your <span className="text-gold-500 italic">Collection</span>
          </h3>

          <p className={cn('max-w-md mx-auto mb-12 text-lg font-light leading-relaxed', theme === 'light' ? 'text-stone-500' : 'text-stone-400')}>
            Experience a new level of organization for your Google AI Family Plans.
            Everything you need, presented with pure editorial elegance.
          </p>

          <button
            onClick={onOpenAddFamily}
            className={cn(
              'group relative inline-flex items-center gap-4 px-10 py-5 font-bold rounded-none text-xs uppercase tracking-[0.3em] transition-all hover:-translate-y-1 shadow-2xl overflow-hidden',
              theme === 'light' ? 'bg-stone-900 text-stone-50 hover:bg-stone-800' : 'bg-white text-stone-900 hover:bg-stone-200'
            )}
          >
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gold-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500Origin-left" />
            <Plus className="w-4 h-4" />
            Add Your First Family
          </button>

          <p className={cn('mt-8 text-[10px] uppercase tracking-widest opacity-40 italic', theme === 'light' ? 'text-stone-500' : 'text-stone-400')}>
            Securely synced with Supabase Cloud
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-4">
      <AnimatePresence>
        {sortedFamilies.map((family) => (
          <FamilyCardAdmin
            key={family.id}
            family={family}
            onDelete={onDelete}
            onEdit={onEdit}
            onAddMember={onAddMember}
            onRemoveMember={onRemoveMember}
            onEditMember={onEditMember}
            onCancelSale={onCancelSale}
            pendingOrders={pendingOrdersByFamily[family.id] || []}
            onApproveOrder={onApproveOrder}
            onRejectOrder={onRejectOrder}
            readOnly={readOnly}
            onRequest={onRequest}
            isHighlighted={family.id === highlightedFamilyId}
            forceExpand={family.id === forceExpandFamilyId}
            highlightedEmail={family.id === highlightedFamilyId ? highlightedEmail : null}
            connectedAccounts={connectedAccounts}
            onConnectDrive={onConnectDrive}
            onSyncDrive={onSyncDrive}
            onDisconnectDrive={onDisconnectDrive}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
