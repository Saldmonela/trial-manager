import React, { useState, useMemo, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getDaysRemaining } from '../hooks/useLocalStorage';
import { usePublicFamilies, createJoinRequest } from '../hooks/useSupabaseData';
import { useToast } from '../hooks/useToast';
import { cn } from '../utils';
import PublicMetricsRow from './dashboard/PublicMetricsRow';
import PublicFiltersBar from './dashboard/PublicFiltersBar';
import FamilyCardPublic from './family/FamilyCardPublic';
import ToastContainer from './ui/ToastContainer';

const JoinRequestModal = lazy(() => import('./modals/JoinRequestModal'));

export default function DashboardPublic() {
  const { theme } = useTheme();
  const { families, loading, error, refetch } = usePublicFamilies();
  const { toasts, addToast, removeToast } = useToast();
  const [joinRequestTarget, setJoinRequestTarget] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  const sortedFamilies = useMemo(() => {
    const filtered = families.filter((family) => {
      if (filter === 'all') return true;
      if (filter === 'available') return family.slotsAvailable > 0;
      if (filter === 'expiringSoon') {
        const daysRemaining = getDaysRemaining(family.expiryDate);
        return daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'name') {
        comparison = (a.familyName || '').localeCompare(b.familyName || '');
      } else if (sortBy === 'availability') {
        comparison = (a.slotsAvailable || 0) - (b.slotsAvailable || 0);
      } else if (sortBy === 'expiryDate') {
        const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : 0;
        const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
        comparison = dateA - dateB;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [families, filter, sortBy, sortDirection]);

  const stats = useMemo(() => {
    return {
      totalFamilies: families.length,
      totalAvailableSlots: families.reduce((acc, family) => acc + (family.slotsAvailable || 0), 0),
    };
  }, [families]);

  const handleSortByChange = (nextSortBy) => {
    if (sortBy === nextSortBy) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(nextSortBy);
    setSortDirection('asc');
  };

  const handleJoinSubmit = async (data) => {
    if (!joinRequestTarget) return;

    const result = await createJoinRequest({
      familyId: joinRequestTarget.id,
      ...data,
    });

    if (result.success) {
      addToast('Request sent successfully!', 'success');
      setJoinRequestTarget(null);
    } else {
      addToast(result.error || 'Failed to send request', 'error');
    }
  };

  if (loading) {
    return (
      <div
        className={cn(
          'min-h-screen flex items-center justify-center font-serif italic',
          theme === 'light' ? 'bg-stone-50 text-stone-500' : 'bg-stone-950 text-stone-400'
        )}
      >
        Loading public dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'min-h-screen flex flex-col items-center justify-center font-serif p-8 text-center',
          theme === 'light' ? 'bg-stone-50 text-stone-900' : 'bg-stone-950 text-stone-50'
        )}
      >
        <p className="text-xl mb-4 text-red-500">Error loading dashboard</p>
        <p className="opacity-70 mb-6 font-sans text-sm">{error}</p>
        <button
          onClick={() => refetch()}
          className={cn(
            'px-6 py-2 border text-xs uppercase tracking-widest font-bold transition-colors',
            theme === 'light'
              ? 'border-stone-900 hover:bg-stone-900 hover:text-stone-50'
              : 'border-stone-50 hover:bg-stone-50 hover:text-stone-900'
          )}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen', theme === 'light' ? 'bg-stone-50 text-stone-900' : 'bg-stone-950 text-stone-50')}>
      <header
        className={cn(
          'sticky top-0 z-40 backdrop-blur-md border-b',
          theme === 'light' ? 'bg-stone-50/90 border-stone-200' : 'bg-stone-950/90 border-stone-800'
        )}
      >
        <div className="container mx-auto px-4 py-4 md:px-6 md:py-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-gold-500" />
            <h1 className="font-serif text-xl md:text-2xl font-bold tracking-tight">Public Dashboard</h1>
          </div>
          <Link
            to="/login"
            className={cn(
              'px-4 py-2 text-xs uppercase tracking-widest font-bold border transition-colors',
              theme === 'light'
                ? 'border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-stone-50'
                : 'border-stone-200 text-stone-200 hover:bg-stone-50 hover:text-stone-900'
            )}
          >
            Admin Login
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8">
        <PublicMetricsRow
          theme={theme}
          totalFamilies={stats.totalFamilies}
          totalAvailableSlots={stats.totalAvailableSlots}
        />

        <PublicFiltersBar
          theme={theme}
          filter={filter}
          setFilter={setFilter}
          sortBy={sortBy}
          setSortBy={handleSortByChange}
          sortDirection={sortDirection}
        />

        {sortedFamilies.length === 0 ? (
          <div className={cn('border p-8 text-center', theme === 'light' ? 'bg-white border-stone-200 text-stone-500' : 'bg-stone-900 border-stone-800 text-stone-400')}>
            No families match the selected filters.
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {sortedFamilies.map((family) => (
              <FamilyCardPublic
                key={family.id}
                family={family}
                theme={theme}
                onJoinClick={() => setJoinRequestTarget(family)}
              />
            ))}
          </section>
        )}
      </main>

      <Suspense fallback={null}>
        <JoinRequestModal
          isOpen={!!joinRequestTarget}
          onClose={() => setJoinRequestTarget(null)}
          familyName={joinRequestTarget?.familyName}
          onSubmit={handleJoinSubmit}
        />
      </Suspense>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
