import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Users, X, Lock, Crown, Pencil, Trash2,
  AlertTriangle, Calendar, ChevronDown, ShieldCheck, Mail, RotateCcw,
  Bell, Check, Ban
} from 'lucide-react';
import { cn } from '../../utils';
import { 
  MAX_FAMILY_SLOTS, MAX_STORAGE_GB,
  getSlotsUsed, getSlotsAvailable,
  isFamilyFull, getDaysRemaining, getExpiryStatus
} from '../../lib/familyUtils';
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

function FamilyCard({ family, onDelete, onEdit, onAddMember, onRemoveMember, onCancelSale, pendingOrders = [], onApproveOrder, onRejectOrder, readOnly = false, onRequest }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [showEmail, setShowEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getButtonText = () => {
    if (family.productType === 'account_ready') {
      if (readOnly && family.soldAt) return 'Sold Out';
      if (readOnly && family.hasPendingOrder) return 'Reserved';
      return 'Buy Account';
    }
    if (family.productType === 'account_custom') return 'Upgrade Now';
    if (slotsAvailable <= 0) return 'Join Waitlist';
    return 'Order Sharing';
  };

  const getProductTypeBadge = () => {
    // Default badge for 'slot' or unknown type
    const defaultBadge = {
      label: 'Sharing Account',
      bg: 'bg-stone-500/10 dark:bg-stone-500/20',
      text: 'text-stone-500 dark:text-stone-400',
      border: 'border-stone-500/20 dark:border-stone-500/30'
    };

    if (family.productType === 'account_ready') {
      // Public sold state
      if (readOnly && family.soldAt) return {
        label: 'Sold',
        bg: 'bg-red-500/10 dark:bg-red-500/20',
        text: 'text-red-600 dark:text-red-400',
        border: 'border-red-500/20 dark:border-red-500/30'
      };
      return {
        label: 'Ready Account',
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-500/20 dark:border-emerald-500/30'
      };
    }

    if (family.productType === 'account_custom') return {
      label: 'Upgrade Service',
      bg: 'bg-purple-500/10 dark:bg-purple-500/20',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-500/20 dark:border-purple-500/30'
    };

    if (slotsAvailable <= 0) return {
      label: 'Full',
      bg: 'bg-red-500/10 dark:bg-red-500/20',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-500/20 dark:border-red-500/30'
    };

    return defaultBadge;
  };

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

  const copyTimerRef = useRef(null);

  // Cleanup copy timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(null), 2000);
  };

  const isPublicView = readOnly; // Assuming readOnly implies public view

  const productBadge = getProductTypeBadge();

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "group rounded-none border transition-all duration-300 relative overflow-hidden flex flex-col h-full",
        // Base styles
        theme === 'light' 
          ? "bg-white shadow-[4px_4px_0px_0px_rgba(28,25,23,0.05)]" 
          : "bg-stone-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]",
        // State-based border + opacity
        readOnly && family.soldAt
          ? "opacity-50 border-red-500/50 hover:border-red-500"
          : readOnly && family.hasPendingOrder
            ? "opacity-[0.7] border-amber-500/50 hover:border-amber-500"
            : !readOnly && family.isBanned
              ? "border-red-600 shadow-[4px_4px_0px_0px_rgba(220,38,38,0.3)] bg-red-50 dark:bg-red-950/30 dark:border-red-700"
              : theme === 'light'
                ? "border-stone-200 hover:shadow-[4px_4px_0px_0px_rgba(198,168,124,1)] hover:border-gold-500"
                : "border-stone-800 hover:shadow-[4px_4px_0px_0px_rgba(198,168,124,0.5)] hover:border-gold-500"
      )}
    >
      {/* Right-side stacked column: Expiry → Order → Edit/Delete */}
      <div className="absolute top-0 right-0 z-20 flex flex-col items-end gap-1">
        {/* Expiry Badge */}
        <div className={cn(
          "px-4 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm transition-all",
          expiryStatus.color === 'red' ? "bg-red-500 text-white animate-pulse" :
          expiryStatus.color === 'yellow' ? "bg-amber-500 text-black animate-pulse" :
          expiryStatus.color === 'green' ? "bg-emerald-500 text-white" :
          "bg-stone-500 text-white"
        )}>
          {expiryStatus.text}
        </div>

        {/* Order Badge (Admin only) */}
        {!readOnly && pendingOrders.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 shadow-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-black">
              {family.productType === 'account_ready'
                ? '1 Order'
                : `${pendingOrders.length} Order${pendingOrders.length > 1 ? 's' : ''}`}
            </span>
          </div>
        )}

        {/* Edit/Delete Buttons (Admin only) */}
        {!readOnly && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <button 
              onClick={() => onEdit(family)}
              className={cn("p-2 transition-colors", theme === 'light' ? "text-stone-400 hover:text-stone-900" : "text-stone-500 hover:text-stone-50")}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => onDelete(family.id)}
              className={cn("p-2 transition-colors", theme === 'light' ? "text-stone-400 hover:text-wine" : "text-stone-500 hover:text-red-400")}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* SOLD & BANNED Badges (Admin + Public) */}
      <div className="absolute top-0 left-0 z-20 flex flex-col items-start gap-px p-0">
        {!readOnly && family.isBanned && (
          <div className="bg-red-700 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-md">
            BANNED
          </div>
        )}
        {((!readOnly && family.sold_at) || (readOnly && family.soldAt)) && (
          <div className="bg-stone-800 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-md">
            SOLD
          </div>
        )}
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
                {isFull && !productBadge.label.includes('Full') && (
                  <span className={cn(
                    "px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                    theme === 'light' ? "bg-stone-900 text-stone-50" : "bg-stone-50 text-stone-900"
                  )}>
                    FULL
                  </span>
                )}
                {isPublicView && (
                  <span className={cn(
                    "px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded-sm border",
                    productBadge.bg, productBadge.text, productBadge.border
                  )}>
                    {productBadge.label}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Price Tag (Public Mode) */}
          {readOnly && (
            <div className="text-right">
              {family.productType === 'account_ready' || family.productType === 'account_custom' ? (
                 <>
                  <p className={cn("text-[10px] uppercase tracking-widest font-bold", theme === 'light' ? "text-stone-400" : "text-stone-500")}>One-Time</p>
                  <p className={cn("font-serif text-lg font-bold", theme === 'light' ? "text-stone-900" : "text-gold-400")}>
                    Rp {(Number(family.priceSale || 0) / 1000).toFixed(0)}k
                    <span className="text-xs font-sans font-normal opacity-60">/once</span>
                  </p>
                 </>
              ) : (
                <>
                  <p className={cn("text-[10px] uppercase tracking-widest font-bold", theme === 'light' ? "text-stone-400" : "text-stone-500")}>Starting at</p>
                  <p className={cn("font-serif text-lg font-bold", theme === 'light' ? "text-stone-900" : "text-gold-400")}>
                    {family.priceMonthly ? `Rp ${(Number(family.priceMonthly) / 1000).toFixed(0)}k` : 'Free'}
                    <span className="text-xs font-sans font-normal opacity-60">/mo</span>
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sold To Info (Admin only) */}
      {!readOnly && family.sold_at && (
        <div className={cn(
          "mx-6 mb-0 mt-0 px-4 py-3 border rounded-sm flex items-center justify-between gap-3",
          theme === 'light'
            ? "bg-red-50 border-red-200 text-red-800"
            : "bg-red-950/30 border-red-900/50 text-red-300"
        )}>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <div className="text-xs">
              <span className="font-bold uppercase tracking-wider">Sold to:</span>{' '}
              <span className="font-medium">{family.sold_to_name}</span>
              <span className="mx-1.5 opacity-40">•</span>
              <span className="font-mono opacity-80">{family.sold_to_email}</span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onCancelSale?.(family.id); }}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-all hover:-translate-y-0.5",
              theme === 'light' 
                ? "border-red-300 text-red-700 hover:bg-red-100" 
                : "border-red-800 text-red-400 hover:bg-red-900/50"
            )}
            title="Cancel this sale and make the account available again"
          >
            <RotateCcw className="w-3 h-3" />
            Cancel Sale
          </button>
        </div>
      )}

      {/* Pending Orders Indicator (Admin only) */}
      {!readOnly && pendingOrders.length > 0 && (
        <>

          {/* Inline pending orders section */}
          <div className={cn(
            "mx-6 mb-0 mt-4 px-4 py-3 border rounded-sm space-y-2",
            theme === 'light'
              ? "bg-amber-50 border-amber-200"
              : "bg-amber-950/20 border-amber-900/40"
          )}>
            <div className={cn(
              "text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5",
              theme === 'light' ? "text-amber-700" : "text-amber-400"
            )}>
              <Bell className="w-3 h-3" />
              Pending Order{pendingOrders.length > 1 ? 's' : ''}
            </div>
            {pendingOrders.map((order) => (
              <div key={order.id} className={cn(
                "flex items-center justify-between gap-2 py-1.5 border-t",
                theme === 'light' ? "border-amber-200/60" : "border-amber-900/30"
              )}>
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-xs font-semibold truncate",
                    theme === 'light' ? "text-amber-900" : "text-amber-200"
                  )}>
                    {order.name}
                  </div>
                  <div className={cn(
                    "text-[10px] font-mono truncate opacity-70",
                    theme === 'light' ? "text-amber-700" : "text-amber-400"
                  )}>
                    {order.email}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); onApproveOrder?.(order.id, order); }}
                    className={cn(
                      "p-1.5 rounded-sm border transition-all hover:-translate-y-0.5",
                      theme === 'light'
                        ? "border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                        : "border-emerald-800 text-emerald-400 hover:bg-emerald-900/50"
                    )}
                    title="Approve order"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRejectOrder?.(order.id, order); }}
                    className={cn(
                      "p-1.5 rounded-sm border transition-all hover:-translate-y-0.5",
                      theme === 'light'
                        ? "border-red-300 text-red-700 hover:bg-red-100"
                        : "border-red-800 text-red-400 hover:bg-red-900/50"
                    )}
                    title="Reject order"
                  >
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Card Body */}
      <div className="p-6 flex-1 flex flex-col">
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
           {!isPublicView && family.members?.length > 0 && (
            <div className="flex -space-x-2 overflow-hidden py-1">
              {family.members.slice(0, 3).map((member, i) => (
                <div 
                  key={i}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-bold uppercase",
                    theme === 'light' ? "border-white bg-stone-100 text-stone-500" : "border-black bg-stone-800 text-stone-400"
                  )}
                  title={member.name || member.email}
                >
                  {(member.name || member.email || '?').substring(0, 1)}
                </div>
              ))}
              {family.members.length > 3 && (
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-bold z-10",
                  theme === 'light' ? "border-white bg-stone-200 text-stone-500" : "border-black bg-stone-700 text-stone-300"
                )}>
                  +{family.members.length - 3}
                </div>
              )}
            </div>
          )}

          {isPublicView && family.productType === 'slot' && (
             <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 self-start">
               <Users className="w-3 h-3 text-stone-500" />
               <span className="text-xs font-bold text-stone-600 dark:text-stone-300">
                 {slotsAvailable} Left
               </span>
             </div>
          )}
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
        {/* Owner Credentials - Only show in Admin mode */}
        {!readOnly && (
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
        )}

        {/* Toggle Members */}
        {/* Toggle Members (Admin) OR Request (Public) */}
        {readOnly ? (
          // Public view: show different button states
          family.productType === 'account_ready' && family.soldAt ? (
            // SOLD state: show disabled "Sold Out" button
            <div className={cn(
              "w-full flex items-center justify-center gap-2 py-3 border-t text-sm font-bold uppercase tracking-widest mt-auto opacity-50 cursor-not-allowed",
              theme === 'light'
                ? "border-stone-200 text-stone-400 bg-stone-100"
                : "border-stone-800 text-stone-600 bg-stone-900/50"
            )}>
              <span>Sold Out</span>
            </div>
          ) : family.productType === 'account_ready' && family.hasPendingOrder ? (
            // RESERVED state: disabled "Reserved" button
            <div className={cn(
              "w-full flex items-center justify-center gap-2 py-3 border-t text-sm font-bold uppercase tracking-widest mt-auto opacity-60 cursor-not-allowed",
              theme === 'light'
                ? "border-amber-200 text-amber-600 bg-amber-50"
                : "border-amber-900/50 text-amber-500 bg-amber-950/30"
            )}>
              <span>Reserved</span>
            </div>
          ) : !isFull && (
            <button
              onClick={() => onRequest?.(family)}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 mt-auto transition-colors text-sm font-bold uppercase tracking-widest border border-stone-200 dark:border-stone-700",
                theme === 'light'
                  ? "bg-white text-stone-900 border-stone-200 hover:bg-stone-900 hover:text-white"
                  : "bg-stone-100 text-stone-900 hover:bg-white hover:text-stone-900"
              )}
            >
              <Plus className="w-4 h-4" />
              <span>{getButtonText()}</span>
            </button>
          )
        ) : (
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
        )}
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
