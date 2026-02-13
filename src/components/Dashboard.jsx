import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Crown, Search, Check } from 'lucide-react';
import { cn } from '../utils';
import { isFamilyFull, getSlotsAvailable, getDaysRemaining } from '../hooks/useLocalStorage';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { useToast } from '../hooks/useToast';
import { supabase } from '../supabaseClient';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import DashboardHeader from './dashboard/DashboardHeader';
import MetricsRow from './dashboard/MetricsRow';
import FiltersBar from './dashboard/FiltersBar';
import FamiliesGrid from './dashboard/FamiliesGrid';

const AddFamilyModal = lazy(() => import('./modals/AddFamilyModal'));
const EditFamilyModal = lazy(() => import('./modals/EditFamilyModal'));
const AddMemberModal = lazy(() => import('./modals/AddMemberModal'));
const DeleteConfirmModal = lazy(() => import('./modals/DeleteConfirmModal'));
const JoinRequestsListModal = lazy(() => import('./modals/JoinRequestsListModal'));
const MigrationTool = lazy(() => import('./MigrationTool'));
const TutorialModal = lazy(() => import('./TutorialModal'));
import ToastContainer from './ui/ToastContainer';
import MigrationBanner from './ui/MigrationBanner';

export default function Dashboard({ onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const { t, language, toggleLanguage } = useLanguage();
  const { families, loading, addFamily, updateFamily, deleteFamily, addMember, removeMember } = useSupabaseData();
  const { toasts, addToast, removeToast } = useToast();

  const [isAddFamilyOpen, setIsAddFamilyOpen] = useState(false);
  const [isJoinRequestsOpen, setIsJoinRequestsOpen] = useState(false);
  const [editFamily, setEditFamily] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
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
    { key: 'storage', label: 'Storage: Highest', labelAlt: 'Storage: Lowest' },
  ];

  useEffect(() => {
    async function checkTutorialStatus() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const tourKey = `fm_tour_seen_${user.id}`;
      const hasSeen = localStorage.getItem(tourKey);

      const createdAt = new Date(user.created_at).getTime();
      const tenMinutes = 10 * 60 * 1000;
      const isNewUser = Date.now() - createdAt < tenMinutes;

      if (!hasSeen && isNewUser) {
        setTimeout(() => setShowTutorial(true), 2000);
      }
    }

    checkTutorialStatus();
  }, []);

  const handleTutorialClose = useCallback(async () => {
    setShowTutorial(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      localStorage.setItem(`fm_tour_seen_${user.id}`, 'true');
    }
  }, []);

  const handleSearch = useCallback(() => {
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
  }, [families, searchQuery]);

  const handleSortClick = useCallback((key) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
  }, [sortBy]);

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

  const handleDeleteFamily = useCallback((id) => {
    setDeleteFamilyId(id);
  }, []);

  const confirmDeleteFamily = useCallback(async () => {
    if (deleteFamilyId) {
      const familyName = families.find((f) => f.id === deleteFamilyId)?.name || 'Family';
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
    const filtered = families.filter((f) => {
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

  const stats = useMemo(
    () => ({
      total: families.length,
      full: families.filter((f) => isFamilyFull(f)).length,
      availableSlots: families.reduce((acc, f) => acc + getSlotsAvailable(f), 0),
      totalMembers: families.reduce((acc, f) => acc + (f.members?.length || 0), 0),
    }),
    [families]
  );

  const expiringSoonCount = useMemo(() => {
    return families.filter((f) => {
      const days = getDaysRemaining(f.expiryDate);
      return days !== null && days <= 7 && days >= 0;
    }).length;
  }, [families]);

  if (loading) {
    return (
      <div
        className={cn(
          'min-h-screen flex items-center justify-center font-serif italic text-center',
          theme === 'light' ? 'bg-stone-50 text-stone-400' : 'bg-stone-950 text-stone-600'
        )}
      >
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen transition-colors duration-500 font-sans', theme === 'light' ? 'bg-stone-50 text-stone-900' : 'bg-stone-950 text-stone-50')}>
      <DashboardHeader
        theme={theme}
        t={t}
        language={language}
        onLogout={onLogout}
        onShowTutorial={() => setShowTutorial(true)}
        onToggleLanguage={toggleLanguage}
        onToggleTheme={toggleTheme}
        onOpenAddFamily={() => setIsAddFamilyOpen(true)}
        onOpenJoinRequests={() => setIsJoinRequestsOpen(true)}
      />

      <main className="container mx-auto px-6 py-8">
        <MigrationBanner families={families} />

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

        <div className="mb-10">
          <div className="flex flex-col md:flex-row gap-4">
            <div id="tour-search" className="relative flex-1 group">
              <Search
                className={cn(
                  'absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300',
                  theme === 'light' ? 'text-stone-400 group-focus-within:text-stone-900' : 'text-stone-500 group-focus-within:text-stone-50'
                )}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('dashboard.search_placeholder')}
                className={cn(
                  'w-full pl-8 pr-4 py-3 bg-transparent border-b-2 font-serif text-lg focus:outline-none transition-all duration-300',
                  theme === 'light'
                    ? 'border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-900'
                    : 'border-stone-800 text-stone-50 placeholder-stone-600 focus:border-stone-50'
                )}
              />
            </div>
            <button
              onClick={handleSearch}
              className={cn(
                'w-full md:w-auto px-8 py-3 font-medium uppercase tracking-widest text-sm transition-all duration-300 min-h-[44px]',
                theme === 'light' ? 'bg-stone-900 text-stone-50 hover:bg-stone-800' : 'bg-stone-50 text-stone-900 hover:bg-stone-200'
              )}
            >
              {t('common.search')}
            </button>
            {searchResult && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResult(null);
                }}
                className={cn(
                  'w-full md:w-auto px-4 py-3 transition-colors min-h-[44px]',
                  theme === 'light' ? 'text-stone-400 hover:text-stone-900' : 'text-stone-500 hover:text-cream'
                )}
              >
                {t('common.clear')}
              </button>
            )}
          </div>

          <AnimatePresence>
            {searchResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  'mt-6 mb-8 p-6 border rounded-none transition-colors',
                  theme === 'light' ? 'bg-stone-50 border-stone-200' : 'bg-stone-900 border-stone-800'
                )}
              >
                {searchResult === 'not_found' ? (
                  <div className="flex items-center gap-3">
                    <Check className={cn('w-5 h-5', theme === 'light' ? 'text-stone-400' : 'text-stone-500')} />
                    <span className={cn('font-serif italic', theme === 'light' ? 'text-stone-600' : 'text-stone-400')}>
                      Email <strong className={cn(theme === 'light' ? 'text-stone-900' : 'text-stone-200')}>&quot;{searchQuery}&quot;</strong> belum terdaftar.
                    </span>
                  </div>
                ) : (
                  <div>
                    <h4 className={cn('text-xs uppercase tracking-widest font-bold mb-6', theme === 'light' ? 'text-stone-400' : 'text-stone-500')}>
                      Found {searchResult.length} result(s)
                    </h4>
                    <div className="space-y-0">
                      {searchResult.map((result, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'flex items-center justify-between py-4 border-b border-dashed last:border-0',
                            theme === 'light' ? 'border-stone-200' : 'border-stone-800'
                          )}
                        >
                          <div className="flex items-center gap-4">
                            {result.role === 'Owner' ? (
                              <Crown className={cn('w-4 h-4', theme === 'light' ? 'text-stone-900' : 'text-stone-200')} />
                            ) : (
                              <Users className={cn('w-4 h-4', theme === 'light' ? 'text-stone-400' : 'text-stone-600')} />
                            )}
                            <span className={cn('font-medium', theme === 'light' ? 'text-stone-900' : 'text-stone-50')}>{result.email}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                'px-2 py-1 text-[10px] uppercase tracking-widest border font-bold',
                                result.role === 'Owner'
                                  ? theme === 'light'
                                    ? 'border-stone-900 text-stone-900 bg-stone-100'
                                    : 'border-stone-200 text-stone-200 bg-stone-800'
                                  : theme === 'light'
                                    ? 'border-stone-200 text-stone-400'
                                    : 'border-stone-700 text-stone-600'
                              )}
                            >
                              {result.role}
                            </span>
                            <span className={cn('text-xs font-serif italic', theme === 'light' ? 'text-stone-400' : 'text-stone-600')}>
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

        <MetricsRow
          theme={theme}
          t={t}
          stats={stats}
          familiesCount={families.length}
          expiringSoonCount={expiringSoonCount}
          onExpiringSoonClick={() => {
            setFilter('all');
            setSortBy('expiry');
            setSortDirection('asc');
          }}
        />

        <FiltersBar
          theme={theme}
          t={t}
          filter={filter}
          sortBy={sortBy}
          sortDirection={sortDirection}
          sortOptions={sortOptions}
          mobileSortOpen={mobileSortOpen}
          setFilter={setFilter}
          setMobileSortOpen={setMobileSortOpen}
          onSortClick={handleSortClick}
        />

        <FamiliesGrid
          theme={theme}
          sortedFamilies={sortedFamilies}
          onOpenAddFamily={() => setIsAddFamilyOpen(true)}
          onDelete={handleDeleteFamily}
          onEdit={setEditFamily}
          onAddMember={setAddMemberFamilyId}
          onRemoveMember={handleRemoveMember}
        />
      </main>

      <Suspense fallback={null}>
        <AddFamilyModal isOpen={isAddFamilyOpen} onClose={() => setIsAddFamilyOpen(false)} onAdd={handleAddFamily} />

        <JoinRequestsListModal isOpen={isJoinRequestsOpen} onClose={() => setIsJoinRequestsOpen(false)} />

        <EditFamilyModal isOpen={!!editFamily} onClose={() => setEditFamily(null)} onSave={handleEditFamily} family={editFamily} />

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
          familyName={families.find((f) => f.id === deleteFamilyId)?.name || 'Family'}
        />

        {showTutorial && <TutorialModal onClose={handleTutorialClose} />}
      </Suspense>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
