import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Users, X, Lock, Crown, Pencil, Trash2,
  AlertTriangle, Calendar, ChevronDown
} from 'lucide-react';
import { cn } from '../../utils';
import { 
  MAX_FAMILY_SLOTS, MAX_STORAGE_GB,
  getSlotsUsed, getSlotsAvailable,
  isFamilyFull, getDaysRemaining, getExpiryStatus
} from '../../hooks/useLocalStorage';
import { useTheme } from '../../context/ThemeContext';

import { useLanguage } from '../../context/LanguageContext';

// Simple Circular Progress Component
const CircularProgress = ({ value, max, size = 40, strokeWidth = 3, color = 'currentColor', trackColor = 'rgba(0,0,0,0.1)' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / max) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="transparent"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
};

function FamilyCard({ family, onDelete, onEdit, onAddMember, onRemoveMember }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [showEmail, setShowEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const maskEmail = (email) => {
    if (!email) return '';
    const [user, domain] = email.split('@');
    if (!domain) return email;
    return `${user.slice(0, 2)}${'•'.repeat(8)}@${domain}`; 
  };

  const [copied, setCopied] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const slotsUsed = getSlotsUsed(family);
  const slotsAvailable = getSlotsAvailable(family);
  const isFull = isFamilyFull(family);
  const daysRemaining = getDaysRemaining(family.expiryDate);
  const expiryStatus = getExpiryStatus(daysRemaining);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "group rounded-none border transition-all duration-300 relative overflow-hidden",
        theme === 'light' 
          ? "bg-white border-stone-200 shadow-[4px_4px_0px_0px_rgba(28,25,23,0.05)] hover:shadow-[4px_4px_0px_0px_rgba(198,168,124,1)] hover:border-gold-500" 
          : "bg-stone-900 border-stone-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] hover:shadow-[4px_4px_0px_0px_rgba(198,168,124,0.5)] hover:border-gold-500"
      )}
    >
      {/* Expiry Badge */}
      <div className={cn(
        "absolute top-0 right-0 z-10 px-4 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm transition-all",
        expiryStatus.color === 'red' ? "bg-red-500 text-white animate-pulse" :
        expiryStatus.color === 'yellow' ? "bg-amber-500 text-black animate-pulse" :
        expiryStatus.color === 'green' ? "bg-emerald-500 text-white" :
        "bg-stone-500 text-white"
      )}>
        {expiryStatus.text}
      </div>
      {/* Editorial Header Block */}
      <div className={cn(
        "p-6 border-b transition-colors",
        theme === 'light' ? "bg-stone-50 border-stone-200" : "bg-stone-800/50 border-stone-800"
      )}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 flex items-center justify-center font-serif text-xl font-bold border rounded-none shrink-0 bg-transparent",
              theme === 'light' 
                ? "border-stone-900 text-stone-900" 
                : "border-stone-50 text-stone-50"
            )}>
              {(() => {
                const name = family.name || 'GM';
                const parts = name.trim().split(' ');
                return parts.length > 1 
                  ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() 
                  : name.substring(0, 2).toUpperCase();
              })()}
            </div>
            <div>
              <h3 className={cn(
                "font-serif text-xl font-bold tracking-tight",
                theme === 'light' ? "text-stone-900" : "text-stone-50"
              )}>
                {family.name || 'Family Plan'}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <p className={cn("text-xs uppercase tracking-widest font-medium", theme === 'light' ? "text-stone-500" : "text-stone-400")}>
                  {family.notes || 'GOOGLE AI PRO'}
                </p>
                {isFull && (
                  <span className={cn(
                    "px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                    theme === 'light' ? "bg-stone-900 text-stone-50" : "bg-stone-50 text-stone-900"
                  )}>
                    FULL
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
             <button 
              onClick={() => onEdit(family)}
              className={cn("p-3 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors", theme === 'light' ? "text-stone-400 hover:text-stone-900" : "text-stone-500 hover:text-stone-50")}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onDelete(family.id)}
              className={cn("p-3 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors", theme === 'light' ? "text-stone-400 hover:text-wine" : "text-stone-500 hover:text-red-400")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-6">
        {/* Slot Progress */}
        <div className="mb-6">
          <div className="flex items-end justify-between text-sm mb-2">
            <span className={cn("font-serif italic", theme === 'light' ? "text-stone-500" : "text-stone-400")}>{t('common.capacity')}</span>
            <span className={cn(
              "font-mono text-xs",
              isFull ? "text-olive" : "text-stone-500"
            )}>
              {slotsUsed} / {MAX_FAMILY_SLOTS}
            </span>
          </div>
          
          <div className="flex gap-1 h-1.5">
            {[...Array(MAX_FAMILY_SLOTS)].map((_, i) => (
               <div 
                key={i}
                className={cn(
                  "flex-1 transition-all duration-500",
                  i < slotsUsed
                    ? (theme === 'light' ? "bg-stone-900" : "bg-stone-50")
                    : (theme === 'light' ? "bg-stone-200" : "bg-stone-800")
                )}
               />
            ))}
          </div>
          
          {!isFull && (
            <p className={cn("text-xs mt-2 font-medium uppercase tracking-wider text-right", theme === 'light' ? "text-stone-400" : "text-stone-500")}>
              {slotsAvailable} Available
            </p>
          )}
        </div>

        {/* Status Info Row */}
        <div className="flex items-center gap-4 mb-6">
           <div className="flex-1">
             <p className={cn("text-xs uppercase tracking-widest font-medium mb-1", theme === 'light' ? "text-stone-400" : "text-stone-500")}>
               Expires
             </p>
             <p className={cn("font-serif font-medium", theme === 'light' ? "text-stone-900" : "text-stone-200")}>
               {family.expiryDate ? new Date(family.expiryDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No Date Set'}
             </p>
           </div>
        </div>

        {/* Storage Usage */}
        <div className="mb-6">
           <div className="flex items-center justify-between text-xs mb-2">
            <span className={cn("font-medium uppercase tracking-widest", theme === 'light' ? "text-stone-400" : "text-stone-500")}>{t('dashboard.family_card.storage')}</span>
            <span className={cn("font-mono", theme === 'light' ? "text-stone-900" : "text-stone-50")}>
              {family.storageUsed || 0}GB <span className="text-stone-400">/ 2048GB</span>
            </span>
          </div>
          <div className={cn("w-full h-1.5 relative", theme === 'light' ? "bg-stone-200" : "bg-stone-800")}>
            <div 
              className={cn("absolute top-0 left-0 h-full transition-all duration-500", (family.storageUsed || 0) >= MAX_STORAGE_GB ? "bg-wine" : "bg-stone-900 dark:bg-stone-50")}
              style={{ width: `${Math.min(((family.storageUsed || 0) / MAX_STORAGE_GB) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Owner Credentials */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <Crown className="w-4 h-4 text-gold-500" />
               <span className={cn("text-sm font-medium", theme === 'light' ? "text-stone-900" : "text-stone-50")}>
                 {showEmail ? family.ownerEmail : maskEmail(family.ownerEmail)}
               </span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowEmail(!showEmail)}
                className={cn("text-xs uppercase tracking-wider hover:underline", theme === 'light' ? "text-stone-400" : "text-stone-500")}
              >
                {showEmail ? t('common.hide') : t('common.show')}
              </button>
              <button 
                onClick={() => handleCopy(family.ownerEmail, 'email')}
                className={cn("text-xs uppercase tracking-wider hover:underline min-h-[44px] flex items-center", theme === 'light' ? "text-gold-600" : "text-gold-400")}
              >
                {copied === 'email' ? t('common.copied') : t('common.copy')}
              </button>
            </div>
          </div>
           <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <Lock className={cn("w-4 h-4", theme === 'light' ? "text-stone-400" : "text-stone-600")} />
               <span className={cn("text-sm font-mono", theme === 'light' ? "text-stone-500" : "text-stone-400")}>
                  {showPassword ? family.ownerPassword : '••••••••••'}
               </span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowPassword(!showPassword)}
                className={cn("text-xs uppercase tracking-wider hover:underline", theme === 'light' ? "text-stone-400" : "text-stone-500")}
              >
                {showPassword ? t('common.hide') : t('common.show')}
              </button>
              <button 
                onClick={() => handleCopy(family.ownerPassword, 'password')}
                className={cn("text-xs uppercase tracking-wider hover:underline", theme === 'light' ? "text-gold-600" : "text-gold-400")}
              >
                {copied === 'password' ? t('common.copied') : t('common.copy')}
              </button>
            </div>
          </div>
        </div>

        {/* Toggle Members */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full flex items-center justify-between py-3 border-t transition-colors text-sm group",
            theme === 'light' 
              ? "border-stone-200 hover:bg-stone-50" 
              : "border-stone-800 hover:bg-stone-900"
          )}
        >
          <div className={cn("flex items-center gap-2 font-serif italic", theme === 'light' ? "text-stone-600" : "text-stone-400")}>
            <Users className="w-4 h-4" />
            <span>{family.members?.length || 0} {t('dashboard.family_card.members')}</span>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className={cn("w-4 h-4", theme === 'light' ? "text-stone-400" : "text-stone-500")} />
          </motion.div>
        </button>
      </div>

      {/* Members List (Expandable) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={cn(
              "border-t", 
              theme === 'light' ? "border-slate-200 bg-stone-50" : "border-slate-800 bg-stone-950"
            )}
          >
            <div className="p-4 space-y-2">
              {family.members?.length > 0 ? (
                family.members.map((member, index) => (
                  <div 
                    key={member.id} 
                    className={cn(
                      "flex items-center justify-between p-3 border-b border-dashed last:border-0",
                      theme === 'light' ? "border-stone-200" : "border-stone-800"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono border",
                        theme === 'light' ? "border-stone-300 text-stone-500" : "border-stone-700 text-stone-400"
                      )}>
                        {index + 1}
                      </div>
                      <span className={cn("text-sm", theme === 'light' ? "text-stone-900" : "text-stone-300")}>{member.name || member.email}</span>
                    </div>
                    <button
                      onClick={() => onRemoveMember(family.id, member.id)}
                      className="text-stone-400 hover:text-wine transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className={cn("text-center py-4 text-sm italic font-serif", theme === 'light' ? "text-stone-400" : "text-stone-600")}>No members yet</p>
              )}

              {/* Add Member Button */}
              {!isFull && (
                <button
                  onClick={() => onAddMember(family.id)}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 p-3 mt-2 border border-dashed transition-colors",
                    theme === 'light' 
                      ? "border-stone-300 text-stone-500 hover:bg-stone-100 hover:text-stone-900" 
                      : "border-stone-700 text-stone-400 hover:bg-stone-900 hover:text-cream"
                  )}
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium uppercase tracking-wider">Add Member</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default React.memo(FamilyCard);
