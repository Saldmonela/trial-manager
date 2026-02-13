
import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Users, Crown, Sparkles, Search, Check,
  Sun, Moon, AlertTriangle, ArrowUp, ArrowDown, ChevronDown
} from 'lucide-react';
import { cn } from '../utils';
import { 
  isFamilyFull, getSlotsAvailable, getDaysRemaining
} from '../hooks/useLocalStorage';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { useToast } from '../hooks/useToast';
import { supabase } from '../supabaseClient';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

// Extracted components (Lazy Loaded)
import FamilyCard from './family/FamilyCard';
const AddFamilyModal = lazy(() => import('./modals/AddFamilyModal'));
const EditFamilyModal = lazy(() => import('./modals/EditFamilyModal'));
const AddMemberModal = lazy(() => import('./modals/AddMemberModal'));
const DeleteConfirmModal = lazy(() => import('./modals/DeleteConfirmModal'));
const MigrationTool = lazy(() => import('./MigrationTool'));
const TutorialModal = lazy(() => import('./TutorialModal'));
import ToastContainer from './ui/ToastContainer';
import MigrationBanner from './ui/MigrationBanner';

// Main Dashboard Component
export default function Dashboard({ onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const { t, language, toggleLanguage } = useLanguage();
  // Supabase Integration
  const { families, loading, addFamily, updateFamily, deleteFamily, addMember, removeMember } = useSupabaseData();
  const { toasts, addToast, removeToast } = useToast();
  
  const [isAddFamilyOpen, setIsAddFamilyOpen] = useState(false);
  const [editFamily, setEditFamily] = useState(null);
  // Tutorial State
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    async function checkTutorialStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tourKey = `fm_tour_seen_${user.id}`;
      const hasSeen = localStorage.getItem(tourKey);
      
      const createdAt = new Date(user.created_at).getTime();
      const tenMinutes = 10 * 60 * 1000;
      const isNewUser = (Date.now() - createdAt) < tenMinutes;

      if (!hasSeen && isNewUser) {
        setTimeout(() => setShowTutorial(true), 2000);
      }
    }
    
    checkTutorialStatus();
  }, []);

  const handleTutorialClose = async () => {
    setShowTutorial(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      localStorage.setItem(`fm_tour_seen_${user.id}`, 'true');
    }
  };

  const [addMemberFamilyId, setAddMemberFamilyId] = useState(null);
  const [deleteFamilyId, setDeleteFamilyId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('expiry');
  const [sortDirection, setSortDirection] = useState('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [showMigration, setShowMigration] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);

  const sortOptions = [
    { key: 'created', label: 'Newest', labelAlt: 'Oldest' },
    { key: 'expiry', label: 'Expiry: Soonest', labelAlt: 'Expiry: Latest' },
    { key: 'storage', label: 'Storage: Highest', labelAlt: 'Storage: Lowest' }
  ];

  // Search for email in families
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResult(null);
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const results = [];
    
    families.forEach((family) => {
      if (family.ownerEmail?.toLowerCase().includes(query)) {
        results.push({
          familyName: family.name || 'Family Plan',
          role: 'Owner',
          email: family.ownerEmail,
        });
      }
      
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

  const handleSortClick = (key) => {
    if (sortBy === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
  };

  const handleAddFamily = useCallback(async (family) => {
    const result = await addFamily(family);
    if (result?.success) {
      addToast('Family added!', 'success');
    } else {
      addToast(result?.error || 'Failed to add family', 'error');
    }
  }, [addFamily, addToast]);

  const handleEditFamily = useCallback(async (updatedFamily) => {
    const result = await updateFamily(updatedFamily);
    if (result?.success) {
      addToast('Family updated!', 'success');
    } else {
      addToast(result?.error || 'Failed to update family', 'error');
    }
  }, [updateFamily, addToast]);

  const handleDeleteFamily = useCallback((id) => { setDeleteFamilyId(id); }, []);

  const confirmDeleteFamily = useCallback(async () => {
    if (deleteFamilyId) {
      const familyName = families.find(f => f.id === deleteFamilyId)?.name || 'Family';
      const result = await deleteFamily(deleteFamilyId);
      setDeleteFamilyId(null);
      if (result?.success) {
        addToast(`"${familyName}" deleted!`, 'success');
      } else {
        addToast(result?.error || 'Failed to delete family', 'error');
      }
    }
  }, [deleteFamilyId, families, deleteFamily, addToast]);

  const handleAddMember = useCallback(async (familyId, member) => {
    const result = await addMember(familyId, member);
    if (result?.success) {
      addToast('Member added!', 'success');
    } else {
      addToast(result?.error || 'Failed to add member', 'error');
    }
  }, [addMember, addToast]);

  const handleRemoveMember = useCallback(async (familyId, memberId) => {
    const result = await removeMember(familyId, memberId);
    if (result?.success) {
      addToast('Member removed!', 'success');
    } else {
      addToast(result?.error || 'Failed to remove member', 'error');
    }
  }, [removeMember, addToast]);

  const sortedFamilies = useMemo(() => {
    let filtered = families.filter((f) => {
      if (filter === 'all') return true;
      if (filter === 'full') return isFamilyFull(f);
      if (filter === 'available') return !isFamilyFull(f);
      return true;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'expiry') {
        const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : 0;
        const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
        comparison = dateB - dateA;
      } else if (sortBy === 'storage') {
        const storageA = a.storageUsed || 0;
        const storageB = b.storageUsed || 0;
        comparison = storageB - storageA;
      } else {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        comparison = dateB - dateA;
      }

      return sortDirection === 'asc' ? -comparison : comparison;
    });
  }, [families, filter, sortBy, sortDirection]);

  // Stats
  const stats = useMemo(() => ({
    total: families.length,
    full: families.filter((f) => isFamilyFull(f)).length,
    availableSlots: families.reduce((acc, f) => acc + getSlotsAvailable(f), 0),
    totalMembers: families.reduce((acc, f) => acc + (f.members?.length || 0), 0),
  }), [families]);

  const expiringSoonCount = useMemo(() => {
    return families.filter(f => {
      const days = getDaysRemaining(f.expiryDate);
      return days !== null && days <= 7 && days >= 0;
    }).length;
  }, [families]);

  if (loading) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center font-serif italic text-center",
        theme === 'light' ? "bg-stone-50 text-stone-400" : "bg-stone-950 text-stone-600"
      )}>
        <p>{t('common.loading')}</p>
      </div>
    );
  }


  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500 font-sans",
      theme === 'light' ? "bg-stone-50 text-stone-900" : "bg-stone-950 text-stone-50"
    )}>
      {/* Header */}
      <header className={cn(
        "sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-300",
        theme === 'light' 
          ? "bg-stone-50/90 border-stone-200" 
          : "bg-stone-950/90 border-stone-800"
      )}>
        <div className="container mx-auto px-4 py-4 md:px-6 md:py-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="text-center md:text-left w-full md:w-auto">
            <h1 className={cn(
               "font-serif text-2xl md:text-2xl font-bold tracking-tight",
               theme === 'light' ? "text-stone-900" : "text-white"
            )}>
              {t('dashboard.title')} <span className="text-gold-500 italic">{t('dashboard.subtitle')}</span>
            </h1>
            <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
               <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] opacity-60">{t('auth.premium_dashboard')}</p>
               <span className="text-stone-300 dark:text-stone-700">|</span>
                <button 
                  onClick={onLogout}
                  className="text-[10px] md:text-xs uppercase tracking-widest text-red-400 hover:text-red-500 transition-colors py-2 md:py-0"
                >
                  {t('auth.logout')}
                </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-center md:justify-end">
            <button
               onClick={() => setShowTutorial(true)}
               className={cn(
                 "p-3 md:p-2 rounded-full transition-colors flex items-center gap-2 px-3",
                 theme === 'light' ? "hover:bg-stone-200 text-stone-600" : "hover:bg-stone-800 text-stone-400"
               )}
               title="Restart Tour"
            >
              <Sparkles className="w-5 h-5 md:w-4 md:h-4 text-gold-500" />
              <span className="text-[10px] uppercase tracking-widest font-bold hidden md:inline">{t('dashboard.help')}</span>
            </button>

            <button
               onClick={toggleLanguage}
               className={cn(
                 "p-0 w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-full transition-colors border text-[10px] font-bold",
                 theme === 'light' 
                   ? "border-stone-200 hover:bg-stone-200 text-stone-600" 
                   : "border-stone-800 hover:bg-stone-800 text-stone-400"
               )}
            >
              {language === 'en' ? 'ID' : 'EN'}
            </button>

            <button
              onClick={toggleTheme}
              className={cn(
                "p-3 md:p-2 rounded-full transition-colors",
                theme === 'light' 
                  ? "hover:bg-stone-200 text-stone-600" 
                  : "hover:bg-stone-800 text-stone-400"
              )}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button
              id="tour-new-family"
              onClick={() => setIsAddFamilyOpen(true)}
              className={cn(
                 "flex items-center gap-2 px-4 py-3 md:px-6 md:py-2.5 font-medium rounded-none transition-all shadow-sm text-sm md:text-base whitespace-nowrap min-h-[44px]",
                 theme === 'light'
                  ? "bg-stone-900 text-stone-50 hover:bg-stone-800"
                  : "bg-stone-50 text-stone-900 hover:bg-stone-200"
              )}
            >
              <Plus className="w-5 h-5 md:w-4 md:h-4" />
              {t('dashboard.new_family')}
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        
        {/* Password Encryption Migration Banner */}
        <MigrationBanner families={families} />

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
                {t('dashboard.show_import')}
              </button>
           </div>
        )}


        {/* Search Bar */}
        <div className="mb-10">
          <div className="flex flex-col md:flex-row gap-4">
            <div id="tour-search" className="relative flex-1 group">
              <Search className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300",
                theme === 'light' ? "text-stone-400 group-focus-within:text-stone-900" : "text-stone-500 group-focus-within:text-stone-50"
              )} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('dashboard.search_placeholder')}
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
                "w-full md:w-auto px-8 py-3 font-medium uppercase tracking-widest text-sm transition-all duration-300 min-h-[44px]",
                theme === 'light'
                  ? "bg-stone-900 text-stone-50 hover:bg-stone-800"
                  : "bg-stone-50 text-stone-900 hover:bg-stone-200"
              )}
            >
              {t('common.search')}
            </button>
            {searchResult && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResult(null); }}
                className={cn(
                  "w-full md:w-auto px-4 py-3 transition-colors min-h-[44px]",
                  theme === 'light' 
                    ? "text-stone-400 hover:text-stone-900" 
                    : "text-stone-500 hover:text-cream"
                )}
              >
                {t('common.clear')}
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

        {/* Stats Grid */}
        <div id="tour-stats" className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-l mb-12 select-none" style={{ borderColor: theme === 'light' ? '#e7e5e4' : '#292524' }}>
          {[
            { label: t('dashboard.stats.total_families'), value: stats.total, color: theme === 'light' ? 'text-stone-900' : 'text-stone-50' },
            { 
              label: t('dashboard.stats.full_capacity'), 
              value: `${stats.full}/${families.length}`, 
              percentage: families.length > 0 ? (stats.full / families.length) * 100 : 0,
              type: 'capacity'
            },
            { 
              label: t('dashboard.stats.available_slots'), 
              value: `${stats.availableSlots}/${families.length * 5}`, 
              percentage: (families.length * 5) > 0 ? (stats.availableSlots / (families.length * 5)) * 100 : 0,
              type: 'slots'
            },
            { label: t('dashboard.stats.total_members'), value: stats.totalMembers, color: 'text-amber-600' }
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
              } else {
                if (stat.percentage < 20) {
                  statusTheme = { bg: theme === 'light' ? 'bg-red-50' : 'bg-red-950/40', text: 'text-red-600', accent: 'bg-red-600', label: t('dashboard.stats.status.critical_low') };
                } else if (stat.percentage < 50) {
                  statusTheme = { bg: theme === 'light' ? 'bg-amber-50' : 'bg-amber-950/40', text: 'text-amber-600', accent: 'bg-amber-600', label: t('dashboard.stats.status.moderate') };
                } else {
                  statusTheme = { bg: theme === 'light' ? 'bg-emerald-50' : 'bg-emerald-950/20', text: 'text-emerald-600', accent: 'bg-emerald-600', label: t('dashboard.stats.status.spacious') };
                }
              }
            }

            return (
              <div key={idx} className={cn(
                "p-6 border-b border-r flex flex-col justify-between aspect-[4/3] group transition-all duration-500 relative overflow-hidden",
                theme === 'light' ? "border-stone-200" : "border-stone-800",
                statusTheme.bg || (theme === 'light' ? "hover:bg-stone-50" : "hover:bg-stone-900/50")
              )}>
                {stat.percentage !== undefined && (
                   <motion.div 
                     initial={{ height: 0 }}
                     animate={{ height: `${stat.percentage}%` }}
                     className={cn("absolute bottom-0 left-0 w-1 opacity-20", statusTheme.accent)}
                   />
                )}

                <div className="relative z-10 flex flex-col justify-between h-full">
                  <span className={cn(
                    "text-[10px] uppercase tracking-[0.2em] font-bold transition-colors", 
                    statusTheme.bg ? statusTheme.text : (theme === 'light' ? "text-stone-400" : "text-stone-500")
                  )}>
                    {stat.label}
                  </span>
                  
                  <div className="flex flex-col gap-1">
                    <span className={cn(
                      "font-serif text-3xl lg:text-5xl font-bold tracking-tighter break-all transition-colors", 
                      statusTheme.text
                    )}>
                      {stat.value}
                    </span>
                    
                    {stat.percentage !== undefined && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className={cn("text-[9px] font-bold tracking-widest", statusTheme.text)}>
                          {statusTheme.label}
                        </span>
                        <span className={cn("text-[10px] font-mono opacity-40", statusTheme.text)}>
                          {Math.round(stat.percentage)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Widget */}
        {expiringSoonCount > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => { setFilter('all'); setSortBy('expiry'); setSortDirection('asc'); }}
            className={cn(
              "mb-8 p-4 border flex items-center justify-between cursor-pointer transition-colors group",
              theme === 'light' ? "bg-amber-50 border-amber-200 hover:bg-amber-100" : "bg-amber-950/20 border-amber-900/50 hover:bg-amber-950/40"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-full", theme === 'light' ? "bg-amber-100 text-amber-600" : "bg-amber-900/50 text-amber-500")}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className={cn("font-bold uppercase tracking-widest text-xs", theme === 'light' ? "text-amber-900" : "text-amber-500")}>
                Attention Needed: {expiringSoonCount} expiring this week
              </span>
            </div>
            <span className={cn("text-xs underline decoration-dotted underline-offset-4 group-hover:text-amber-600", theme === 'light' ? "text-amber-800" : "text-amber-500")}>
              View All
            </span>
          </motion.div>
        )}

        {/* Filters and Sorting */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-4 border-b border-dashed" style={{ borderColor: theme === 'light' ? '#e7e5e4' : '#292524' }}>
          <div className="flex gap-6">
            {[
              { key: 'all', label: t('dashboard.filters.all') },
              { key: 'available', label: t('dashboard.filters.available') },
              { key: 'full', label: t('dashboard.filters.full') },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "text-sm font-medium transition-all duration-300 relative py-2",
                  filter === f.key 
                    ? (theme === 'light' ? "text-stone-900" : "text-stone-50") 
                    : (theme === 'light' ? "text-stone-400 hover:text-stone-600" : "text-stone-600 hover:text-stone-400")
                )}
              >
                {f.label}
                {filter === f.key && (
                  <motion.div 
                    layoutId="activeFilter"
                    className={cn("absolute bottom-0 left-0 right-0 h-0.5", theme === 'light' ? "bg-stone-900" : "bg-gold-500")}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <span className={cn("text-xs uppercase tracking-widest mr-2", theme === 'light' ? "text-stone-400" : "text-stone-600")}>{t('dashboard.sort.label')}</span>
            <div className="flex flex-col relative">
               {/* Mobile Dropdown Trigger */}
               <button
                  onClick={() => setMobileSortOpen(!mobileSortOpen)}
                  className={cn(
                    "md:hidden flex items-center justify-between gap-2 px-4 py-2 text-xs uppercase tracking-wider font-medium border transition-colors min-w-[180px]",
                    theme === 'light' 
                      ? "bg-stone-900 text-stone-50 border-stone-900" 
                      : "bg-stone-50 text-stone-900 border-stone-50"
                  )}
               >
                 <span className="flex items-center gap-2">
                   {(() => {
                     const activeOption = sortOptions.find(s => s.key === sortBy);
                     return activeOption ? (
                       <>
                         {sortDirection === 'desc' ? activeOption.labelAlt : activeOption.label}
                         {sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                       </>
                     ) : 'Sort By';
                   })()}
                 </span>
                 <ChevronDown className={cn("w-3 h-3 transition-transform", mobileSortOpen ? "rotate-180" : "")} />
               </button>

               {/* Mobile Dropdown Menu */}
               <AnimatePresence>
                 {mobileSortOpen && (
                   <motion.div
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 10 }}
                     className={cn(
                       "absolute top-full right-0 mt-2 w-full md:w-auto min-w-[180px] z-50 border shadow-xl md:hidden",
                       theme === 'light' ? "bg-white border-stone-200" : "bg-stone-900 border-stone-800"
                     )}
                   >
                     {sortOptions.map((s) => (
                       <button
                         key={s.key}
                         onClick={() => {
                           handleSortClick(s.key);
                           setMobileSortOpen(false);
                         }}
                         className={cn(
                           "w-full text-left px-4 py-3 text-xs uppercase tracking-wider font-medium border-b last:border-0 hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between transition-colors",
                           theme === 'light' ? "border-stone-100 text-stone-900" : "border-stone-800 text-stone-200"
                         )}
                       >
                         <span>{sortDirection === 'desc' && sortBy === s.key ? s.labelAlt : s.label}</span>
                         {sortBy === s.key && (
                           sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                         )}
                       </button>
                     ))}
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* Desktop Buttons */}
               <div className="hidden md:flex flex-wrap gap-2">
                {sortOptions.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => handleSortClick(s.key)}
                    className={cn(
                      "pl-3 pr-2 py-2 text-[10px] md:text-xs uppercase tracking-wider font-medium border transition-all whitespace-nowrap flex items-center gap-2",
                      sortBy === s.key 
                        ? (theme === 'light' ? "bg-stone-900 text-stone-50 border-stone-900" : "bg-stone-50 text-stone-900 border-stone-50")
                        : (theme === 'light' ? "text-stone-400 border-transparent hover:border-stone-200" : "text-stone-500 border-transparent hover:border-stone-800")
                    )}
                  >
                    {sortBy === s.key && sortDirection === 'desc' ? s.labelAlt : s.label}
                    {sortBy === s.key && (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    )}
                  </button>
                ))}
               </div>
            </div>
          </div>
        </div>

        {/* Family Grid */}
        {sortedFamilies.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "relative text-center py-24 px-8 overflow-hidden group border",
              theme === 'light' 
                ? "bg-white border-stone-200 shadow-xl" 
                : "bg-stone-900 border-stone-800 shadow-2xl"
            )}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold-500/5 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center">
              <motion.div 
                whileHover={{ rotate: 15, scale: 1.1 }}
                className={cn(
                  "w-24 h-24 mb-8 flex items-center justify-center rounded-3xl shadow-2xl relative",
                  theme === 'light' ? "bg-stone-900 text-gold-500" : "bg-stone-800 text-gold-500"
                )}
              >
                <div className="absolute inset-0 bg-gold-500/20 blur-xl rounded-full scale-75 group-hover:scale-125 transition-transform duration-700" />
                <Crown className="w-10 h-10 relative z-10" color="#C6A87C" />
              </motion.div>
              
              <h3 className={cn(
                "text-4xl font-serif font-bold mb-6 tracking-tight",
                theme === 'light' ? "text-stone-900" : "text-stone-50"
              )}>
                Begin Your <span className="text-gold-500 italic">Collection</span>
              </h3>
              
              <p className={cn(
                "max-w-md mx-auto mb-12 text-lg font-light leading-relaxed",
                theme === 'light' ? "text-stone-500" : "text-stone-400"
              )}>
                Experience a new level of organization for your Google AI Family Plans. 
                Everything you need, presented with pure editorial elegance.
              </p>
              
              <button
                 onClick={() => setIsAddFamilyOpen(true)}
                 className={cn(
                   "group relative inline-flex items-center gap-4 px-10 py-5 font-bold rounded-none text-xs uppercase tracking-[0.3em] transition-all hover:-translate-y-1 shadow-2xl overflow-hidden",
                   theme === 'light'
                     ? "bg-stone-900 text-stone-50 hover:bg-stone-800"
                     : "bg-white text-stone-900 hover:bg-stone-200"
                 )}
              >
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gold-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500Origin-left" />
                <Plus className="w-4 h-4" />
                Add Your First Family
              </button>

              <p className={cn("mt-8 text-[10px] uppercase tracking-widest opacity-40 italic", theme === 'light' ? "text-stone-500" : "text-stone-400")}>
                Securely synced with Supabase Cloud
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-4">
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
      <Suspense fallback={null}>
        <AddFamilyModal
          isOpen={isAddFamilyOpen}
          onClose={() => setIsAddFamilyOpen(false)}
          onAdd={handleAddFamily}
        />

        <EditFamilyModal
          isOpen={!!editFamily}
          onClose={() => setEditFamily(null)}
          onSave={handleEditFamily}
          family={editFamily}
        />

        <AddMemberModal
          isOpen={!!addMemberFamilyId}
          onClose={() => setAddMemberFamilyId(null)}
          onAdd={handleAddMember}
          familyId={addMemberFamilyId}
        />

        <DeleteConfirmModal
          isOpen={!!deleteFamilyId}
          onClose={() => setDeleteFamilyId(null)}
          onConfirm={confirmDeleteFamily}
          familyName={families.find(f => f.id === deleteFamilyId)?.name || 'Family'}
        />

        {showTutorial && (
          <TutorialModal onClose={handleTutorialClose} />
        )}
      </Suspense>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
