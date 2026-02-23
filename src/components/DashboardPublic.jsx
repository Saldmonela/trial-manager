import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getDaysRemaining, MAX_FAMILY_SLOTS } from '../lib/familyUtils';
import { usePublicFamilies, createJoinRequest, useAppSetting } from '../hooks/useSupabaseData';
import { useToast } from '../hooks/useToast';
import { cn } from '../utils';

// Shared Components
import DashboardHeader from './dashboard/DashboardHeader';
import MetricsRow from './dashboard/MetricsRow';
import FiltersBar from './dashboard/FiltersBar';
import FamiliesGrid from './dashboard/FamiliesGrid';
import ServicesSection from './dashboard/ServicesSection';
import ToastContainer from './ui/ToastContainer';

const JoinRequestModal = lazy(() => import('./modals/JoinRequestModal'));
const SettingsModal = lazy(() => import('./modals/SettingsModal'));
const TutorialModal = lazy(() => import('./TutorialModal'));

export default function DashboardPublic({ session, onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const { t, language, toggleLanguage } = useLanguage();
  const { families, loading, error, refetch } = usePublicFamilies();
  const { toasts, addToast, removeToast } = useToast();
  
  const [joinRequestTarget, setJoinRequestTarget] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [filter, setFilter] = useState('available');
  const [sortBy, setSortBy] = useState('created');
  const [sortDirection, setSortDirection] = useState('desc');
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const { value: serviceStyle } = useAppSetting('service_card_style', 'editorial');

  const sortOptions = [
    { key: 'created', label: 'ADDED: OLDEST', labelAlt: 'ADDED: NEWEST' },
    { key: 'expiry', label: 'EXPIRY: SOONEST', labelAlt: 'EXPIRY: LATEST' },
    { key: 'storage', label: 'STORAGE: LOWEST', labelAlt: 'STORAGE: HIGHEST' },
  ];

  const handleSortClick = (key) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
  };

  // Transform PublicFamily to Family structure for shared components
  const mappedFamilies = useMemo(() => {
    return families.map(f => ({
      ...f,
      name: f.familyName,       // Map for FamilyCard
      notes: f.serviceName,     // Map for FamilyCard
      soldAt: f.soldAt || null,
      hasPendingOrder: f.hasPendingOrder || false,
      members: Array(Math.max(0, 5 - (f.slotsAvailable || 0))).fill({ id: 'hidden' })
    }));
  }, [families]);

  const sortedFamilies = useMemo(() => {
    const filtered = mappedFamilies.filter((family) => {
      if (filter === 'all') return true;
      if (filter === 'available') return (family.slotsAvailable || 0) > 0;
      if (filter === 'expiringSoon') {
        const daysRemaining = getDaysRemaining(family.expiryDate);
        return daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;
      }
      return true;
    });

    // Sold ready accounts always go to the bottom
    return [...filtered].sort((a, b) => {
      const aIsSold = a.productType === 'account_ready' && a.soldAt;
      const bIsSold = b.productType === 'account_ready' && b.soldAt;
      if (aIsSold && !bIsSold) return 1;
      if (!aIsSold && bIsSold) return -1;

      let comparison = 0;

      if (sortBy === 'created') {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        comparison = dateA - dateB;
      } else if (sortBy === 'storage') {
        comparison = (a.storageUsed || 0) - (b.storageUsed || 0);
      } else if (sortBy === 'expiry') {
        const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : 0;
        const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
        // If one is 0 (no expiry), treat as infinity? Or 0?
        // Let's treat No Date as "Far Future" (Latest) or "Past"?
        // Usually No Date = Infinite validity.
        // For now, simple timestamp comparison.
        comparison = dateA - dateB;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [mappedFamilies, filter, sortBy, sortDirection]);

  // Fetch global settings
  const { value: upgradePriceSettings } = useAppSetting('upgrade_service_price', 45000);
  const { value: serviceTitle } = useAppSetting('upgrade_service_title', 'Google AI Pro');
  const { value: serviceDesc } = useAppSetting('upgrade_service_desc', 'Upgrade your personal account to premium status. Enjoy all benefits without joining a family group.');
  const { value: serviceFeaturesRaw } = useAppSetting('upgrade_service_features', JSON.stringify(['Private Account', 'Full Warranty', 'Instant Activation']));
  const { value: paymentType } = useAppSetting('upgrade_payment_type', 'One-Time Payment');
  const { value: validity } = useAppSetting('upgrade_validity', 'Lifetime Validity');

  // Static Upgrade Service (not tied to any family in DB)
  const upgradeService = useMemo(() => {
    let features = [];
    try {
      features = typeof serviceFeaturesRaw === 'string' ? JSON.parse(serviceFeaturesRaw) : serviceFeaturesRaw;
    } catch(e) {
      features = ['Private Account', 'Full Warranty', 'Instant Activation'];
    }

    return {
      id: 'upgrade-service',
      familyName: 'Premium Upgrade',
      serviceName: 'Premium Upgrade',
      name: 'Premium Upgrade',
      notes: serviceTitle,
      description: serviceDesc,
      features: features,
      paymentType: paymentType,
      validity: validity,
      productType: 'account_custom',
      priceSale: upgradePriceSettings,
      currency: 'IDR',
      expiryDate: null,
      storageUsed: 0,
      slotsAvailable: 99, // unlimited
    };
  }, [upgradePriceSettings, serviceTitle, serviceDesc, serviceFeaturesRaw, paymentType, validity]);

  const services = useMemo(() => [upgradeService], [upgradeService]);
  const standardFamilies = sortedFamilies; // all DB families are standard now

  const stats = useMemo(() => {
    return {
      total: families.length,
      availableSlots: families.reduce((acc, family) => acc + (family.slotsAvailable || 0), 0),
      // 'full' count isn't directly needed for PublicMetricsRow if we reuse generic MetricsRow?
      // Check MetricsRow props: { total, full, availableSlots, totalMembers }
      full: families.filter(f => (f.slotsAvailable || 0) === 0).length,
      totalMembers: families.reduce((acc, family) => acc + (MAX_FAMILY_SLOTS - (family.slotsAvailable || 0)), 0)
    };
  }, [families]);

  const expiringSoonCount = useMemo(() => {
    return families.filter((f) => {
        const days = getDaysRemaining(f.expiryDate);
        return days !== null && days <= 7 && days >= 0;
    }).length;
  }, [families]);

  const handleJoinSubmit = async (data) => {
    if (!joinRequestTarget) return;

    const result = await createJoinRequest({
      familyId: joinRequestTarget.id === 'upgrade-service' ? null : joinRequestTarget.id,
      ...data,
    });

    if (result.success) {
      addToast('Request sent successfully!', 'success');
      setJoinRequestTarget(null);
    } else {
      // Translate the error if it's a key
      addToast(t(result.error) || 'Failed to send request', 'error');
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
    <div className={cn('min-h-screen transition-colors duration-500 font-sans', theme === 'light' ? 'bg-stone-50 text-stone-900' : 'bg-stone-950 text-stone-50')}>
      <DashboardHeader
        theme={theme}
        t={t}
        language={language}
        onToggleLanguage={toggleLanguage}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setShowSettings(true)}
        onShowTutorial={() => setShowTutorial(true)}
        publicMode={true}
        session={session}
        onLogout={onLogout}
      />

      <main className="container mx-auto px-4 md:px-6 py-8">
        <MetricsRow
            theme={theme}
            t={t}
            stats={stats}
            familiesCount={families.length}
            expiringSoonCount={expiringSoonCount}
            onExpiringSoonClick={() => {
                setFilter('all');
                setSortBy('expiry');
                setSortDirection('asc'); // Soonest
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

        <ServicesSection 
          services={services}
          theme={theme}
          style={serviceStyle}
          // No onToggleStyle prop here -> Button will be hidden
          onRequest={setJoinRequestTarget}
        />

        <FamiliesGrid
          theme={theme}
          sortedFamilies={standardFamilies}
          readOnly={true}
          onRequest={setJoinRequestTarget}
        />
      </main>

      <Suspense fallback={null}>
        <JoinRequestModal
          isOpen={!!joinRequestTarget}
          onClose={() => setJoinRequestTarget(null)}
          family={joinRequestTarget}
          onSubmit={handleJoinSubmit}
        />
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          language={language}
          onToggleLanguage={toggleLanguage}
          onShowTutorial={() => setShowTutorial(true)}
          publicMode={true}
          onLogout={onLogout}
          session={session}
        />
        {showTutorial && (
          <TutorialModal onClose={() => setShowTutorial(false)} publicMode={true} />
        )}
      </Suspense>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
