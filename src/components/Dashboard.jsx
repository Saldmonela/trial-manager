import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Users, 
  Mail, 
  Eye, 
  EyeOff, 
  Copy, 
  Trash2, 
  Check,
  X,
  Lock,
  UserPlus,
  Crown,
  Sparkles,
  Clock,
  AlertTriangle,
  Calendar,
  Pencil,
  HardDrive,
  ArrowUpDown,
  Search,
  Sun,
  Moon
} from 'lucide-react';
import { cn } from '../utils';
import { 
  useLocalStorage, 
  generateId, 
  MAX_FAMILY_SLOTS, 
  MAX_STORAGE_GB,
  getSlotsUsed, 
  getSlotsAvailable,
  isFamilyFull,
  getDaysRemaining,
  getExpiryStatus
} from '../hooks/useLocalStorage';
import { useSupabaseData } from '../hooks/useSupabaseData'; // Import Hook
import MigrationTool from './MigrationTool';
import { useTheme } from '../context/ThemeContext';

// Family Card Component
// Family Card Component
function FamilyCard({ family, onDelete, onEdit, onAddMember, onRemoveMember }) {
  const { theme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  
  const maskEmail = (email) => {
    if (!email) return '';
    const parts = email.split('@');
    if (parts.length < 2) return email;
    
    const [user, domain] = parts;
    if (user.length <= 2) return email;
    
    return `${user.slice(0, 2)}${'•'.repeat(8)}@${domain}`; 
  };
  const [copied, setCopied] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const slotsUsed = getSlotsUsed(family);
  const slotsAvailable = getSlotsAvailable(family);
  const isFull = isFamilyFull(family);
  const daysRemaining = getDaysRemaining(family.expiryDate);
  const expiryStatus = getExpiryStatus(daysRemaining);

  const expiryColorStyles = {
    slate: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
    orange: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  };

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "group rounded-none border transition-all duration-300",
        // Editorial Borders
        theme === 'light' 
          ? "bg-white border-stone-200 shadow-[4px_4px_0px_0px_rgba(28,25,23,0.05)] hover:shadow-[4px_4px_0px_0px_rgba(198,168,124,1)] hover:border-gold-500" 
          : "bg-stone-900 border-stone-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] hover:shadow-[4px_4px_0px_0px_rgba(198,168,124,0.5)] hover:border-gold-500"
      )}
    >
      {/* Editorial Header Block */}
      <div className={cn(
        "p-5 border-b transition-colors",
        theme === 'light' ? "bg-stone-50 border-stone-200" : "bg-stone-800/50 border-stone-800"
      )}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Minimalist Icon or Monogram */}
            {/* Minimalist Icon or Monogram */}
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
          
          {/* Actions - Minimalist */}
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
             <button 
              onClick={() => onEdit(family)}
              className={cn("p-2 transition-colors", theme === 'light' ? "text-stone-400 hover:text-stone-900" : "text-stone-500 hover:text-stone-50")}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onDelete(family.id)}
              className={cn("p-2 transition-colors", theme === 'light' ? "text-stone-400 hover:text-wine" : "text-stone-500 hover:text-red-400")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5">

        {/* Slot Progress - Thin Lines */}
        <div className="mb-6">
          <div className="flex items-end justify-between text-sm mb-2">
            <span className={cn("font-serif italic", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Capacity</span>
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
                    ? (theme === 'light' ? "bg-stone-900" : "bg-stone-50") // Filled
                    : (theme === 'light' ? "bg-stone-200" : "bg-stone-800") // Empty
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

        {/* Expiry Status - Minimalist Text */}
        <div className={cn(
          "flex items-start gap-4 mb-6 pb-6 border-b border-dashed",
          theme === 'light' ? "border-stone-200" : "border-stone-800"
        )}>
          <div className={cn("mt-1", expiryStatus.color === 'red' ? "text-wine" : "text-stone-400")}>
             {daysRemaining !== null && daysRemaining <= 7 ? <AlertTriangle className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
          </div>
          <div>
            <p className={cn("text-xs uppercase tracking-widest font-bold mb-1", theme === 'light' ? "text-stone-400" : "text-stone-500")}>
              Renewal Date
            </p>
            <p className={cn("font-serif text-lg", theme === 'light' ? "text-stone-900" : "text-stone-50")}>
              {family.expiryDate ? new Date(family.expiryDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'No Date Set'}
            </p>
            <p className={cn("text-xs mt-1 italic", expiryStatus.color === 'red' ? "text-wine font-medium" : "text-stone-500")}>
              {expiryStatus.text}
            </p>
          </div>
        </div>

        {/* Storage Usage - Minimalist Bar */}
        <div className="mb-6">
           <div className="flex items-center justify-between text-xs mb-2">
            <span className={cn("font-medium uppercase tracking-widest", theme === 'light' ? "text-stone-400" : "text-stone-500")}>Storage</span>
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

        {/* Owner Credentials - Clean List */}
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
                {showEmail ? "HIDE" : "SHOW"}
              </button>
              <button 
                onClick={() => handleCopy(family.ownerEmail, 'email')}
                className={cn("text-xs uppercase tracking-wider hover:underline", theme === 'light' ? "text-gold-600" : "text-gold-400")}
              >
                {copied === 'email' ? "COPIED" : "COPY"}
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
                {showPassword ? "HIDE" : "SHOW"}
              </button>
              <button 
                onClick={() => handleCopy(family.ownerPassword, 'password')}
                className={cn("text-xs uppercase tracking-wider hover:underline", theme === 'light' ? "text-gold-600" : "text-gold-400")}
              >
                {copied === 'password' ? "COPIED" : "COPY"}
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
            <span>{family.members?.length || 0} Members</span>
          </div>
          <span className={cn("transform transition-transform duration-300", isExpanded ? "rotate-180" : "", theme === 'light' ? "text-stone-400" : "text-stone-500")}>▼</span>
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

// Add Family Modal
function AddFamilyModal({ isOpen, onClose, onAdd }) {
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    ownerEmail: '',
    ownerPassword: '',
    expiryDate: '',
    storageUsed: '',
    notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.ownerEmail || !formData.ownerPassword) return;
    
    onAdd({
      ...formData,
      storageUsed: Number(formData.storageUsed) || 0,
      id: generateId(),
      members: [],
      createdAt: new Date().toISOString(),
    });
    
    setFormData({ name: '', ownerEmail: '', ownerPassword: '', expiryDate: '', storageUsed: '', notes: '' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-md border shadow-2xl p-8 rounded-none",
          theme === 'light' ? "bg-white border-stone-200" : "bg-stone-900 border-stone-800"
        )}
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className={cn("text-2xl font-serif font-bold", theme === 'light' ? "text-stone-900" : "text-stone-50")}>
            New Family Plan
          </h2>
          <button onClick={onClose} className={cn("transition-colors", theme === 'light' ? "text-stone-400 hover:text-stone-900" : "text-stone-500 hover:text-stone-50")}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className={cn("block text-xs uppercase tracking-widest font-medium mb-2", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Family Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., The Smiths, Premium A"
                className={cn(
                  "w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors",
                  theme === 'light' 
                    ? "border-stone-200 text-stone-900 placeholder-stone-300 focus:border-stone-900" 
                    : "border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50"
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={cn("block text-xs uppercase tracking-widest font-medium mb-2", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Owner Email</label>
                <input
                  type="email"
                  value={formData.ownerEmail}
                  onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                  placeholder="email@example.com"
                  className={cn(
                    "w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors",
                    theme === 'light' 
                      ? "border-stone-200 text-stone-900 placeholder-stone-300 focus:border-stone-900" 
                      : "border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50"
                  )}
                  required
                />
              </div>
              <div>
                <label className={cn("block text-xs uppercase tracking-widest font-medium mb-2", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Password</label>
                <input
                  type="text"
                  value={formData.ownerPassword}
                  onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })}
                  placeholder="••••••••"
                  className={cn(
                    "w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors",
                    theme === 'light' 
                      ? "border-stone-200 text-stone-900 placeholder-stone-300 focus:border-stone-900" 
                      : "border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50"
                  )}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className={cn("block text-xs uppercase tracking-widest font-medium mb-2", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className={cn(
                    "w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors",
                    theme === 'light' 
                      ? "border-stone-200 text-stone-900 focus:border-stone-900" 
                      : "border-stone-700 text-stone-50 focus:border-stone-50"
                  )}
                />
              </div>
              <div>
                <label className={cn("block text-xs uppercase tracking-widest font-medium mb-2", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Storage (GB)</label>
                <input
                  type="number"
                  value={formData.storageUsed}
                  onChange={(e) => setFormData({ ...formData, storageUsed: e.target.value })}
                  placeholder="0"
                  max="2048"
                  className={cn(
                    "w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors",
                    theme === 'light' 
                      ? "border-stone-200 text-stone-900 placeholder-stone-300 focus:border-stone-900" 
                      : "border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50"
                  )}
                />
              </div>
            </div>

             <div>
              <label className={cn("block text-xs uppercase tracking-widest font-medium mb-2", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Notes</label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                className={cn(
                  "w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors",
                  theme === 'light' 
                    ? "border-stone-200 text-stone-900 placeholder-stone-300 focus:border-stone-900" 
                    : "border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50"
                )}
              />
            </div>
          </div>

          <button
            type="submit"
            className={cn(
              "w-full py-4 text-sm font-bold uppercase tracking-widest transition-all mt-8",
              theme === 'light'
                ? "bg-stone-900 text-stone-50 hover:bg-stone-800"
                : "bg-stone-50 text-stone-900 hover:bg-stone-200"
            )}
          >
            Create Family
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Edit Family Modal
function EditFamilyModal({ isOpen, onClose, onSave, family }) {
  const { theme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: family?.name || '',
    ownerEmail: family?.ownerEmail || '',
    ownerPassword: family?.ownerPassword || '',
    expiryDate: family?.expiryDate || '',
    storageUsed: family?.storageUsed,
    notes: family?.notes || '',
  });

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  // Update form when family changes
  React.useEffect(() => {
    if (family) {
      setFormData({
        name: family.name || '',
        ownerEmail: family.ownerEmail || '',
        ownerPassword: family.ownerPassword || '',
        expiryDate: formatDateForInput(family.expiryDate),
        storageUsed: family.storageUsed,
        notes: family.notes || '',
      });
    }
  }, [family]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.ownerEmail || !formData.ownerPassword) return;
    
    onSave({
      ...family,
      ...formData,
      storageUsed: Number(formData.storageUsed) || 0,
    });
    
    onClose();
  };

  if (!isOpen || !family) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-md border shadow-2xl p-8 rounded-none max-h-[90vh] overflow-y-auto",
          theme === 'light' ? "bg-white border-stone-200" : "bg-stone-900 border-stone-800"
        )}
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className={cn("text-2xl font-serif font-bold", theme === 'light' ? "text-stone-900" : "text-stone-50")}>
            Edit Family
          </h2>
          <button onClick={onClose} className={cn("transition-colors", theme === 'light' ? "text-stone-400 hover:text-stone-900" : "text-stone-500 hover:text-stone-50")}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className={cn("block text-xs uppercase tracking-widest font-medium mb-2", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Family Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={cn(
                  "w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors",
                  theme === 'light' 
                    ? "border-stone-200 text-stone-900 placeholder-stone-300 focus:border-stone-900" 
                    : "border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50"
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={cn("block text-xs uppercase tracking-widest font-medium mb-2", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Owner Email</label>
                <input
                  type="email"
                  value={formData.ownerEmail}
                  onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                  className={cn(
                    "w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors",
                    theme === 'light' 
                      ? "border-stone-200 text-stone-900 placeholder-stone-300 focus:border-stone-900" 
                      : "border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50"
                  )}
                  required
                />
              </div>
              <div className="relative">
                <label className={cn("block text-xs uppercase tracking-widest font-medium mb-2", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.ownerPassword}
                    onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })}
                    className={cn(
                      "w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors pr-10",
                      theme === 'light' 
                        ? "border-stone-200 text-stone-900 placeholder-stone-300 focus:border-stone-900" 
                        : "border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50"
                    )}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 transition-colors",
                      theme === 'light' ? "text-stone-400 hover:text-stone-900" : "text-stone-500 hover:text-stone-50"
                    )}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                <label className={cn("block text-xs uppercase tracking-widest font-medium mb-2", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className={cn(
                    "w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors",
                    theme === 'light' 
                      ? "border-stone-200 text-stone-900 focus:border-stone-900" 
                      : "border-stone-700 text-stone-50 focus:border-stone-50"
                  )}
                />
              </div>
              <div>
                <label className={cn("block text-xs uppercase tracking-widest font-medium mb-2", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Storage (GB)</label>
                <input
                  type="number"
                  value={formData.storageUsed}
                  onChange={(e) => setFormData({ ...formData, storageUsed: e.target.value })}
                  placeholder="0"
                  max="2048"
                  className={cn(
                    "w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors",
                    theme === 'light' 
                      ? "border-stone-200 text-stone-900 placeholder-stone-300 focus:border-stone-900" 
                      : "border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50"
                  )}
                />
              </div>
            </div>

             <div>
              <label className={cn("block text-xs uppercase tracking-widest font-medium mb-2", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Notes</label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className={cn(
                  "w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors",
                  theme === 'light' 
                    ? "border-stone-200 text-stone-900 placeholder-stone-300 focus:border-stone-900" 
                    : "border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50"
                )}
              />
            </div>
          </div>

          <button
            type="submit"
            className={cn(
              "w-full py-4 text-sm font-bold uppercase tracking-widest transition-all mt-8",
              theme === 'light'
                ? "bg-stone-900 text-stone-50 hover:bg-stone-800"
                : "bg-stone-50 text-stone-900 hover:bg-stone-200"
            )}
          >
            Update Family
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Add Member Modal
function AddMemberModal({ isOpen, onClose, onAdd, familyId }) {
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name && !formData.email) return;
    
    onAdd(familyId, {
      id: generateId(),
      name: formData.name,
      email: formData.email,
      addedAt: new Date().toISOString(),
    });
    
    setFormData({ name: '', email: '' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-md border shadow-2xl p-8 rounded-none",
          theme === 'light' ? "bg-white border-stone-200" : "bg-stone-900 border-stone-800"
        )}
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className={cn("text-2xl font-serif font-bold", theme === 'light' ? "text-stone-900" : "text-stone-50")}>
            Add Member
          </h2>
          <button onClick={onClose} className={cn("transition-colors", theme === 'light' ? "text-stone-400 hover:text-stone-900" : "text-stone-500 hover:text-stone-50")}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className={cn("block text-xs uppercase tracking-widest font-medium mb-2", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Member Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. John Doe, Kaka..."
              className={cn(
                "w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors",
                theme === 'light' 
                  ? "border-stone-200 text-stone-900 placeholder-stone-300 focus:border-stone-900" 
                  : "border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50"
              )}
            />
          </div>

          <div>
            <label className={cn("block text-xs uppercase tracking-widest font-medium mb-2", theme === 'light' ? "text-stone-500" : "text-stone-400")}>Member Email (Optional)</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="member@gmail.com"
              className={cn(
                "w-full px-4 py-3 border-b-2 bg-transparent focus:outline-none transition-colors",
                theme === 'light' 
                  ? "border-stone-200 text-stone-900 placeholder-stone-300 focus:border-stone-900" 
                  : "border-stone-700 text-cream placeholder-stone-600 focus:border-cream"
              )}
            />
          </div>

          <button
            type="submit"
            className={cn(
              "w-full py-4 text-sm font-bold uppercase tracking-widest transition-all mt-8",
              theme === 'light'
                ? "bg-stone-900 text-stone-50 hover:bg-stone-800"
                : "bg-stone-50 text-stone-900 hover:bg-stone-200"
            )}
          >
            Add Member
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmationModal({ isOpen, onClose, onConfirm, familyName }) {
  const { theme } = useTheme();
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-sm border shadow-2xl p-8 rounded-none text-center",
          theme === 'light' ? "bg-white border-stone-200" : "bg-stone-900 border-stone-800"
        )}
      >
        <div className="flex justify-center mb-6">
          <div className={cn("p-4 rounded-full", theme === 'light' ? "bg-red-100 text-red-600" : "bg-red-900/20 text-red-500")}>
            <AlertTriangle className="w-8 h-8" />
          </div>
        </div>
        
        <h3 className={cn("text-xl font-serif font-bold mb-3", theme === 'light' ? "text-stone-900" : "text-stone-50")}>
          Delete Family Plan?
        </h3>
        
        <p className={cn("text-sm mb-8 leading-relaxed", theme === 'light' ? "text-stone-500" : "text-stone-400")}>
          Are you sure you want to delete <span className="font-bold">"{familyName}"</span>? 
          This action cannot be undone.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest transition-colors"
          >
            Yes, Delete It
          </button>
          <button
            onClick={onClose}
            className={cn(
              "w-full py-3 font-bold text-xs uppercase tracking-widest transition-colors",
              theme === 'light' ? "text-stone-400 hover:text-stone-900" : "text-stone-500 hover:text-stone-300"
            )}
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Main Dashboard Component
export default function Dashboard({ onLogout }) {
  const { theme, toggleTheme } = useTheme();
  // Supabase Integration
  const { families, loading, addFamily, updateFamily, deleteFamily, addMember, removeMember } = useSupabaseData();
  
  const [isAddFamilyOpen, setIsAddFamilyOpen] = useState(false);
  const [editFamily, setEditFamily] = useState(null);
  const [addMemberFamilyId, setAddMemberFamilyId] = useState(null);
  const [deleteFamilyId, setDeleteFamilyId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created'); // 'created', 'expiry', 'storage'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [showMigration, setShowMigration] = useState(false); // Default false, only show if user wants to import.

  // Search for email in families
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResult(null);
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const results = [];
    
    families.forEach((family) => {
      // Check owner email
      if (family.ownerEmail?.toLowerCase().includes(query)) {
        results.push({
          familyName: family.name || 'Family Plan',
          role: 'Owner',
          email: family.ownerEmail,
        });
      }
      
      // Check members
      family.members?.forEach((member) => {
        if (member.email?.toLowerCase().includes(query) || member.name?.toLowerCase().includes(query)) {
          results.push({
            familyName: family.name || 'Family Plan',
            role: 'Member',
            email: member.email || member.name,
          });
        }
      });
    });
    
    setSearchResult(results.length > 0 ? results : 'not_found');
  };

  const handleAddFamily = (family) => {
    addFamily(family);
  };

  const handleEditFamily = (updatedFamily) => {
    updateFamily(updatedFamily);
  };

  const handleDeleteFamily = (id) => {
    setDeleteFamilyId(id);
  };

  const confirmDeleteFamily = () => {
    if (deleteFamilyId) {
      deleteFamily(deleteFamilyId);
      setDeleteFamilyId(null);
    }
  };

  const handleAddMember = (familyId, member) => {
    addMember(familyId, member);
  };

  const handleRemoveMember = (familyId, memberId) => {
     removeMember(familyId, memberId);
  };

  // Filter and Sort families
  const getSortedFamilies = () => {
    let filtered = families.filter((f) => {
      if (filter === 'all') return true;
      if (filter === 'full') return isFamilyFull(f);
      if (filter === 'available') return !isFamilyFull(f);
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'expiry') {
        // Sort by expiry date (farthest first)
        // If no expiry, put at the bottom
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(b.expiryDate) - new Date(a.expiryDate);
      }
      if (sortBy === 'storage') {
        // Sort by storage remaining (most remaining first)
        const storageA = a.storageUsed || 0;
        const storageB = b.storageUsed || 0;
        return storageB - storageA; // Descending order (largest used first per request "sisa storage terbanyak"?? wait.. request says "sisa storage terbanyak". Usually mean "most available". But maybe "storage used" is easier to track. Let's stick with "Storage Used High to Low" as it seems to be what is meant effectively or usually desired to see unused accounts. ACTUALLY user said "sisa storage terbanyak" = Most Storage Remaining. So smallest `storageUsed` first.
        // Correction: "sisa storage terbanyak" = most remaining storage.
        // So we should sort by (MAX - storageUsed) descending.
        // Which is equivalent to storageUsed ascending.
        // Let's do storageUsed Ascending (Smallest used first).
        return storageA - storageB;
      }
      // Default: created
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  };

  const sortedFamilies = getSortedFamilies();

  // Stats
  const stats = {
    total: families.length,
    full: families.filter((f) => isFamilyFull(f)).length,
    availableSlots: families.reduce((acc, f) => acc + getSlotsAvailable(f), 0), // Sum of all available slots
    totalMembers: families.reduce((acc, f) => acc + (f.members?.length || 0), 0),
  };

  if (loading) {
    // Failsafe: if loading takes too long, show error hints
    setTimeout(() => {
      const el = document.getElementById('loading-text');
      if (el) el.innerHTML = "Still loading...<br/><span class='text-xs opacity-70'>Check your internet or Supabase connection.</span>";
    }, 5000);

    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center font-serif italic text-center",
        theme === 'light' ? "bg-stone-50 text-stone-400" : "bg-stone-950 text-stone-600"
      )}>
        <p id="loading-text">Loading dashboard...</p>
      </div>
    );
  }


  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500 font-sans",
      theme === 'light' ? "bg-stone-50 text-stone-900" : "bg-stone-950 text-stone-50"
    )}>
      {/* Header - Editorial Style */}
      <header className={cn(
        "sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-300",
        theme === 'light' 
          ? "bg-stone-50/90 border-stone-200" 
          : "bg-stone-950/90 border-stone-800"
      )}>
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className={cn(
               "font-serif text-2xl font-bold tracking-tight",
               theme === 'light' ? "text-stone-900" : "text-white"
            )}>
              Google AI <span className="text-gold-500 italic">Family</span> Manager
            </h1>
            <div className="flex items-center gap-2 mt-1">
               <p className="text-xs uppercase tracking-[0.2em] opacity-60">Premium Dashboard</p>
               <span className="text-stone-300 dark:text-stone-700">|</span>
                <button 
                  onClick={onLogout}
                  className="text-xs uppercase tracking-widest text-red-400 hover:text-red-500 transition-colors"
                >
                  Log Out
                </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={cn(
                "p-2 rounded-full transition-colors",
                theme === 'light' 
                  ? "hover:bg-stone-200 text-stone-600" 
                  : "hover:bg-stone-800 text-stone-400"
              )}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsAddFamilyOpen(true)}
              className={cn(
                 "flex items-center gap-2 px-6 py-2.5 font-medium rounded-none transition-all shadow-sm",
                 theme === 'light'
                  ? "bg-stone-900 text-stone-50 hover:bg-stone-800"
                  : "bg-stone-50 text-stone-900 hover:bg-stone-200"
              )}
            >
              <Plus className="w-4 h-4" />
              New Family
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        
        {/* Migration Tool */}
        {showMigration && (
           <div className="mb-8">
            <MigrationTool onSuccess={() => setShowMigration(false)} />
           </div>
        )}
        {!showMigration && window.localStorage.getItem('google-ai-families') && (
           <div className="mb-8 text-center">
              <button 
                onClick={() => setShowMigration(true)}
                className="text-[10px] uppercase tracking-widest text-stone-500 hover:text-gold-500 transition-colors"
              >
                Show Import Tool
              </button>
           </div>
        )}


        {/* Search Bar - Minimalist */}
        <div className="mb-10">
          <div className="flex gap-4">
            <div className="relative flex-1 group">
              <Search className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300",
                theme === 'light' ? "text-stone-400 group-focus-within:text-stone-900" : "text-stone-500 group-focus-within:text-stone-50"
              )} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search families, emails, or members"
                className={cn(
                  "w-full pl-8 pr-4 py-3 bg-transparent border-b-2 font-serif text-lg focus:outline-none transition-all duration-300",
                  theme === 'light' 
                    ? "border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-900" 
                    : "border-stone-800 text-stone-50 placeholder-stone-600 focus:border-stone-50"
                )}
              />
            </div>
            <button
              onClick={handleSearch}
              className={cn(
                "px-8 py-3 font-medium uppercase tracking-widest text-sm transition-all duration-300",
                theme === 'light'
                  ? "bg-stone-900 text-stone-50 hover:bg-stone-800"
                  : "bg-stone-50 text-stone-900 hover:bg-stone-200"
              )}
            >
              Search
            </button>
            {searchResult && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResult(null); }}
                className={cn(
                  "px-4 py-3 transition-colors",
                  theme === 'light' 
                    ? "text-stone-400 hover:text-stone-900" 
                    : "text-stone-500 hover:text-cream"
                )}
              >
                Clear
              </button>
            )}
          </div>
          
          {/* Search Results */}
          <AnimatePresence>
            {searchResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "mt-6 mb-8 p-6 border rounded-none transition-colors",
                  theme === 'light' ? "bg-stone-50 border-stone-200" : "bg-stone-900 border-stone-800"
                )}
              >
                {searchResult === 'not_found' ? (
                  <div className="flex items-center gap-3">
                    <Check className={cn("w-5 h-5", theme === 'light' ? "text-stone-400" : "text-stone-500")} />
                    <span className={cn("font-serif italic", theme === 'light' ? "text-stone-600" : "text-stone-400")}>
                      Email <strong className={cn(theme === 'light' ? "text-stone-900" : "text-stone-200")}>"{searchQuery}"</strong> belum terdaftar.
                    </span>
                  </div>
                ) : (
                  <div>
                    <h4 className={cn("text-xs uppercase tracking-widest font-bold mb-6", theme === 'light' ? "text-stone-400" : "text-stone-500")}>
                      Found {searchResult.length} result(s)
                    </h4>
                    <div className="space-y-0">
                      {searchResult.map((result, idx) => (
                        <div key={idx} className={cn(
                          "flex items-center justify-between py-4 border-b border-dashed last:border-0",
                          theme === 'light' ? "border-stone-200" : "border-stone-800"
                        )}>
                          <div className="flex items-center gap-4">
                            {result.role === 'Owner' ? (
                              <Crown className={cn("w-4 h-4", theme === 'light' ? "text-stone-900" : "text-stone-200")} />
                            ) : (
                              <Users className={cn("w-4 h-4", theme === 'light' ? "text-stone-400" : "text-stone-600")} />
                            )}
                            <span className={cn("font-medium", theme === 'light' ? "text-stone-900" : "text-stone-50")}>{result.email}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "px-2 py-1 text-[10px] uppercase tracking-widest border font-bold",
                              result.role === 'Owner' 
                                ? (theme === 'light' ? "border-stone-900 text-stone-900 bg-stone-100" : "border-stone-200 text-stone-200 bg-stone-800")
                                : (theme === 'light' ? "border-stone-200 text-stone-400" : "border-stone-700 text-stone-600")
                            )}>
                              {result.role}
                            </span>
                            <span className={cn("text-xs font-serif italic", theme === 'light' ? "text-stone-400" : "text-stone-600")}>
                              in {result.familyName}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stats */}
        {/* Stats - Editorial Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-l border-r mb-12 select-none" style={{ borderColor: theme === 'light' ? '#e7e5e4' : '#292524' }}>
          {[
            { label: 'Total Families', value: stats.total, color: theme === 'light' ? 'text-stone-900' : 'text-stone-50' },
            { label: 'Full Capacity', value: `${stats.full}/${families.length}`, color: theme === 'light' ? 'text-stone-500' : 'text-stone-400' },
            { label: 'Available Slots', value: `${stats.availableSlots}/${families.length * 5}`, color: 'text-emerald-600' },
            { label: 'Total Members', value: stats.totalMembers, color: 'text-amber-600' }
          ].map((stat, idx) => (
            <div key={idx} className={cn(
              "p-6 border-b border-r flex flex-col justify-between aspect-[4/3] group hover:bg-opacity-50 transition-colors",
              theme === 'light' ? "border-stone-200 hover:bg-stone-200" : "border-stone-800 hover:bg-stone-800"
            )}>
              <span className={cn("text-xs uppercase tracking-[0.2em] font-medium", theme === 'light' ? "text-stone-400" : "text-stone-500")}>
                {stat.label}
              </span>
              <span className={cn("font-serif text-5xl font-bold tracking-tighter mt-2", stat.color)}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* Filters and Sorting */}
        {/* Filters and Sorting - Clean Text Toggles */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-4 border-b border-dashed" style={{ borderColor: theme === 'light' ? '#e7e5e4' : '#292524' }}>
          {/* Filter Tabs */}
          <div className="flex gap-6">
            {[
              { key: 'all', label: 'All Families' },
              { key: 'available', label: 'Space Available' },
              { key: 'full', label: 'Fully Booked' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "text-sm font-medium transition-all duration-300 relative",
                  filter === f.key 
                    ? (theme === 'light' ? "text-stone-900" : "text-stone-50") 
                    : (theme === 'light' ? "text-stone-400 hover:text-stone-600" : "text-stone-600 hover:text-stone-400")
                )}
              >
                {f.label}
                {filter === f.key && (
                  <motion.div 
                    layoutId="activeFilter"
                    className={cn("absolute -bottom-5 left-0 right-0 h-0.5", theme === 'light' ? "bg-stone-900" : "bg-gold-500")}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-4">
            <span className={cn("text-xs uppercase tracking-widest", theme === 'light' ? "text-stone-400" : "text-stone-600")}>Sort By:</span>
            <div className="flex gap-2">
              {[
                { key: 'created', label: 'Newest' },
                { key: 'expiry', label: 'Renewal' },
                { key: 'storage', label: 'Storage' }
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={cn(
                    "px-3 py-1 text-xs uppercase tracking-wider font-medium border transition-all",
                    sortBy === s.key 
                      ? (theme === 'light' ? "bg-stone-900 text-stone-50 border-stone-900" : "bg-stone-50 text-stone-900 border-stone-50")
                      : (theme === 'light' ? "text-stone-400 border-transparent hover:border-stone-200" : "text-stone-500 border-transparent hover:border-stone-800")
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Family Grid */}
        {sortedFamilies.length === 0 ? (
          <div className={cn(
            "text-center py-24 px-6 border-2 border-dashed rounded-none transition-all",
            theme === 'light' ? "border-stone-200 bg-stone-50/50" : "border-stone-800 bg-stone-900/50"
          )}>
            <div className={cn(
              "w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-full",
              theme === 'light' ? "bg-stone-100 text-stone-300" : "bg-stone-800 text-stone-600"
            )}>
              <Sparkles className="w-10 h-10" />
            </div>
            
            <h3 className={cn(
              "text-3xl font-serif font-bold mb-4",
              theme === 'light' ? "text-stone-900" : "text-stone-50"
            )}>
              No family plans yet
            </h3>
            
            <p className={cn(
              "max-w-md mx-auto mb-10 text-lg font-light leading-relaxed",
              theme === 'light' ? "text-stone-500" : "text-stone-400"
            )}>
              Start managing your premium accounts with elegance. <br/>
              Add your first Family Plan to get started.
            </p>
            
            <button
               onClick={() => setIsAddFamilyOpen(true)}
               className={cn(
                 "group relative inline-flex items-center gap-3 px-8 py-4 font-bold rounded-none text-xs uppercase tracking-[0.2em] transition-all hover:-translate-y-1 shadow-xl",
                 theme === 'light'
                   ? "bg-stone-900 text-stone-50 hover:bg-stone-800 shadow-stone-900/10"
                   : "bg-stone-50 text-stone-900 hover:bg-stone-200 shadow-stone-50/10"
               )}
            >
              <Plus className="w-4 h-4" />
              Add Your First Family
            </button>
          </div>
        ) : (
          <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            <AnimatePresence>
              {sortedFamilies.map((family) => (
                <FamilyCard 
                  key={family.id} 
                  family={family} 
                  onDelete={handleDeleteFamily}
                  onEdit={(f) => setEditFamily(f)}
                  onAddMember={(familyId) => setAddMemberFamilyId(familyId)}
                  onRemoveMember={handleRemoveMember}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isAddFamilyOpen && (
          <AddFamilyModal
            isOpen={isAddFamilyOpen}
            onClose={() => setIsAddFamilyOpen(false)}
            onAdd={handleAddFamily}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editFamily && (
          <EditFamilyModal
            isOpen={!!editFamily}
            onClose={() => setEditFamily(null)}
            onSave={handleEditFamily}
            family={editFamily}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addMemberFamilyId && (
          <AddMemberModal
            isOpen={!!addMemberFamilyId}
            onClose={() => setAddMemberFamilyId(null)}
            onAdd={handleAddMember}
            familyId={addMemberFamilyId}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteFamilyId && (
          <DeleteConfirmationModal
            isOpen={!!deleteFamilyId}
            onClose={() => setDeleteFamilyId(null)}
            onConfirm={confirmDeleteFamily}
            familyName={families.find(f => f.id === deleteFamilyId)?.name || 'Family'}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
