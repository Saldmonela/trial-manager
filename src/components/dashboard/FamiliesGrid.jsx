import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Plus } from 'lucide-react';
import { cn } from '../../utils';
import FamilyCardAdmin from '../family/FamilyCardAdmin';

export default function FamiliesGrid({
  theme,
  sortedFamilies,
  onOpenAddFamily,
  onDelete,
  onEdit,
  onAddMember,
  onRemoveMember,
}) {
  if (sortedFamilies.length === 0) {
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
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
