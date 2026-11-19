import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Crown, Search, Check } from 'lucide-react';
import { cn } from '../utils';
import { isFamilyFull, getSlotsAvailable, getDaysRemaining, getLowStorageAlerts, isFamilyAttentionNeeded, isFamilyValidStorage } from '../lib/familyUtils';
import {
  buildCooldownSummaryMap,
  computeFamilyDowngradeImpact,
  isPersonalAccountEmail,
} from '../lib/cooldownLogic';
import { normalizeEmail } from '../lib/cockpitParser';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { useConnectedAccounts } from '../hooks/useConnectedAccounts';
import { useCockpitAccounts } from '../hooks/useCockpitAccounts';
import { useAccountFamilyHistory } from '../hooks/useAccountFamilyHistory';
import { useToast } from '../hooks/useToast';
import { supabase } from '../supabaseClient';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import DashboardHeader from './dashboard/DashboardHeader';
import MetricsRow from './dashboard/MetricsRow';
import FiltersBar from './dashboard/FiltersBar';
import FamiliesGrid from './dashboard/FamiliesGrid';

const AddFamilyModal = lazy(() => import('./modals/AddFamilyModal'));
const EditFamilyModal = lazy(() => import('./modals/EditFamilyModal'));
const AddMemberModal = lazy(() => import('./modals/AddMemberModal'));
const EditMemberModal = lazy(() => import('./modals/EditMemberModal'));
const DeleteConfirmModal = lazy(() => import('./modals/DeleteConfirmModal'));
const DeleteMemberConfirmModal = lazy(() => import('./modals/DeleteMemberConfirmModal'));
const MigrationTool = lazy(() => import('./MigrationTool'));
const TutorialModal = lazy(() => import('./TutorialModal'));
const SettingsModal = lazy(() => import('./modals/SettingsModal'));
import AccountFamilyHistoryDrawer from './cooldown/AccountFamilyHistoryDrawer';
import ToastContainer from './ui/ToastContainer';
import MigrationBanner from './ui/MigrationBanner';

const DRIVE_AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export default function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { session } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();

  const { 
    families, 
    loading,
    refreshing, error: familiesError, refetch: refetchFamilies,
    addFamily, 
    updateFamily, 
    deleteFamily, 
    addMember, 
    updateMember,
    removeMember,
    cancelSale,
    setFamilyPlanStatus,
  } = useSupabaseData();
  const { toasts, addToast, removeToast } = useToast();
  const { accounts: cockpitAccounts } = useCockpitAccounts();
  const {
    entries: historyEntries,
    loading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
    addManualHistory,
    updateHistory,
    deleteHistory,
  } = useAccountFamilyHistory();
  const [historyDrawerEmail, setHistoryDrawerEmail] = useState(null);

  const cooldownByEmail = useMemo(
    () => buildCooldownSummaryMap(historyEntries, families, cockpitAccounts),
    [historyEntries, families, cockpitAccounts],
  );

  // --- Google Drive integration (kuota asli di kartu) ---
  const {
    accounts: connectedAccounts,
    loading: accountsLoading,
    justConnected,
    clearJustConnected,
    connectGoogleDrive, error: driveError,
    syncQuota,
    syncAll,
    disconnect: disconnectDrive,
    refetch: refetchAccounts,
  } = useConnectedAccounts();
  const [searchParams] = useSearchParams();
  const driveParamHandled = useRef(false);
  const autoSyncInFlightRef = useRef(false);
  const lastAutoSyncAtRef = useRef(0);
  const connectedAccountsRef = useRef(connectedAccounts);
  connectedAccountsRef.current = connectedAccounts;

  // Tangani redirect balik dari OAuth (mendarat di /admin saat connect dari kartu).
  useEffect(() => {
    const ok = searchParams.get('drive_connected');
    const err = searchParams.get('drive_error');
    if ((!ok && !err) || driveParamHandled.current) return;
    driveParamHandled.current = true;
    if (ok) {
      addToast('Google Drive berhasil terhubung', 'success');
      void refetchAccounts();
    } else {
      addToast(`Gagal menghubungkan Drive: ${err}`, 'error');
    }
    navigate('/admin', { replace: true });
  }, [searchParams, addToast, refetchAccounts, navigate]);

  const handleConnectDrive = useCallback(async (email) => {
    const result = await connectGoogleDrive('/admin', email || '');
    if (!result.success) addToast(result.error || 'Koneksi gagal.', 'error');
    return result;
  }, [connectGoogleDrive, addToast]);

  const handleConnectDriveForNewFamily = useCallback(async () => {
    const result = await connectGoogleDrive('/admin', '', 'add-family');
    if (!result.success) addToast(result.error || 'Koneksi gagal.', 'error');
    return result;
  }, [connectGoogleDrive, addToast]);

  const notifyLowStorageResults = useCallback((results, { isAuto = false } = {}) => {
    const alerts = getLowStorageAlerts(results, { onlyNewlyExpired: isAuto });
    if (alerts.some((a) => a.hasNewlyExpired)) {
      void refetchFamilies?.();
    }
    for (const alert of alerts) {
      addToast(alert.message, alert.hasNewlyExpired ? 'error' : 'warning', 8000);
    }
    return alerts;
  }, [refetchFamilies, addToast]);

  const handleSyncDrive = useCallback(async (id) => {
    const r = await syncQuota(id);
    const alerts = notifyLowStorageResults(r?.data?.results, { isAuto: false });
    if (r.success && alerts.length === 0) {
      addToast('Quota Drive ter-sync', 'success');
    } else if (!r.success) {
      addToast(r.error || 'Sync gagal', 'error');
    }
  }, [syncQuota, notifyLowStorageResults, addToast]);

  const handleDisconnectDrive = useCallback(async (id) => {
    const r = await disconnectDrive(id);
    addToast(r.success ? 'Drive terputus' : (r.error || 'Gagal memutus Drive'), r.success ? 'success' : 'error');
  }, [disconnectDrive, addToast]);

  const handleSyncAllDrives = useCallback(async () => {
    const r = await syncAll();
    const alerts = notifyLowStorageResults(r?.data?.results, { isAuto: false });
    if (r.success && alerts.length === 0) {
      addToast('Semua Drive ter-sync', 'success');
    } else if (!r.success) {
      addToast(r.error || 'Sync gagal', 'error');
    }
  }, [syncAll, notifyLowStorageResults, addToast]);

  const runAutoDriveSync = useCallback(async (forceStaleCheck = true) => {
    if (autoSyncInFlightRef.current) return;
    const activeAccounts = connectedAccountsRef.current.filter((a) => a.status === 'connected');
    if (activeAccounts.length === 0) return;
    const now = Date.now();
    if (now - lastAutoSyncAtRef.current < DRIVE_AUTO_SYNC_INTERVAL_MS) return;
    if (forceStaleCheck) {
      const hasStale = activeAccounts.some(
        (a) => !a.lastSyncedAt || now - Date.parse(a.lastSyncedAt) >= DRIVE_AUTO_SYNC_INTERVAL_MS,
      );
      if (!hasStale) return;
    }
    autoSyncInFlightRef.current = true;
    lastAutoSyncAtRef.current = now;
    try {
      const r = await syncAll();
      notifyLowStorageResults(r?.data?.results, { isAuto: true });
    } finally {
      autoSyncInFlightRef.current = false;
    }
  }, [syncAll, notifyLowStorageResults]);

  useEffect(() => {
    if (accountsLoading) return;
    void runAutoDriveSync(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void runAutoDriveSync(false);
      }
    }, DRIVE_AUTO_SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [accountsLoading, runAutoDriveSync]);

  const [isAddFamilyOpen, setIsAddFamilyOpen] = useState(false);
  const handledDriveToastRef = useRef(null);

  const unlinkedAccounts = useMemo(() => {
    const usedEmails = new Set();
    for (const f of families) {
      if (f.ownerEmail) usedEmails.add(f.ownerEmail.toLowerCase());
      for (const m of (f.members || [])) {
        if (m.email) usedEmails.add(m.email.toLowerCase());
      }
    }
    return connectedAccounts.filter(
      (a) => a.status === 'connected' && a.email && !usedEmails.has(a.email.toLowerCase())
    );
  }, [families, connectedAccounts]);

  const autoPrefillAccount = useMemo(() => {
    if (!justConnected || justConnected.intent !== 'add-family' || loading) return null;
    const acct = connectedAccounts.find((a) => a.id === justConnected.accountId);
    if (!acct) return null;
    const exists = acct.email
      ? families.some((f) => !f.isBanned && f.ownerEmail?.toLowerCase() === acct.email.toLowerCase())
      : false;
    return exists ? null : acct;
  }, [justConnected, loading, connectedAccounts, families]);

  useEffect(() => {
    if (!justConnected || loading) return;
    const acct = connectedAccounts.find((a) => a.id === justConnected.accountId);
    if (!acct || handledDriveToastRef.current === justConnected.accountId) return;
    handledDriveToastRef.current = justConnected.accountId;

    if (justConnected.expiredFamilies?.length > 0) {
      void refetchFamilies?.();
      const names = justConnected.expiredFamilies.map((f) => f.name).filter(Boolean).join(', ');
      addToast(
        `Storage ${acct.email || 'Drive'} terdeteksi ${justConnected.lowStorageTier}! Masa berlaku ${names} otomatis diubah menjadi EXPIRED.`,
        'error',
        8000,
      );
      clearJustConnected?.();
      return;
    }

    if (justConnected.createdFamily) {
      void refetchFamilies?.();
      addToast(
        `Akun ${acct.email || 'Google'} terhubung & otomatis dibuatkan ${justConnected.createdFamily.name} (password masih kosong).`,
        'success',
        6000,
      );
      clearJustConnected?.();
      return;
    }

    if (justConnected.intent === 'add-family') {
      const existing = acct.email
        ? families.find((f) => !f.isBanned && f.ownerEmail?.toLowerCase() === acct.email.toLowerCase())
        : null;
      if (existing) {
        addToast(`Akun ${acct.email} sudah terdaftar & Google Drive terhubung`, 'success');
        clearJustConnected?.();
      } else {
        addToast(`Akun ${acct.email || 'Google'} terhubung! Pilih masa aktif & isi password.`, 'success');
      }
    } else {
      addToast('Google Drive berhasil terhubung', 'success');
      clearJustConnected?.();
    }
  }, [justConnected, loading, connectedAccounts, families, clearJustConnected, addToast, refetchFamilies]);
  const [editFamily, setEditFamily] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [addMemberFamilyId, setAddMemberFamilyId] = useState(null);
  const [editMemberData, setEditMemberData] = useState(null);
  const [deleteMemberData, setDeleteMemberData] = useState(null);
  const [deleteFamilyId, setDeleteFamilyId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [showBanned, setShowBanned] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [sortBy, setSortBy] = useState('created');
  const [sortDirection, setSortDirection] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showMigration, setShowMigration] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Highlighting & Scrolling State
  const [activeHighlight, setActiveHighlight] = useState({ familyId: null, expand: false, matchedEmail: null, role: null });

  const sortOptions = [
    { key: 'created', label: 'ADDED: OLDEST', labelAlt: 'ADDED: NEWEST' },
    { key: 'expiry', label: 'EXPIRY: SOONEST', labelAlt: 'EXPIRY: LATEST' },
    { key: 'storage', label: 'STORAGE: LOWEST', labelAlt: 'STORAGE: HIGHEST' },
  ];

  useEffect(() => {
    let tutorialTimer;
    async function checkTutorialStatus() {
      if (!supabase) return;
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
        tutorialTimer = setTimeout(() => setShowTutorial(true), 2000);
      }
    }

    checkTutorialStatus();

    return () => {
      if (tutorialTimer) clearTimeout(tutorialTimer);
    };
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
    setActiveIndex(-1);
    if (!searchQuery.trim()) {
      setSearchResult(null);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const results = [];

    families.forEach((family) => {
      const isBanned = Boolean(family.isBanned || family.is_banned);
      const isIssue = isFamilyAttentionNeeded(family, connectedAccounts, families);

      if (family.name?.toLowerCase().includes(query)) {
        results.push({
          familyId: family.id,
          familyName: family.name || 'Family Plan',
          role: 'Family',
          email: family.name || 'Family Plan',
          isIssue,
          isBanned,
        });
      }

      if (family.ownerEmail?.toLowerCase().includes(query)) {
        results.push({
          familyId: family.id,
          familyName: family.name || 'Family Plan',
          role: 'Owner',
          email: family.ownerEmail,
          isIssue,
          isBanned,
        });
      }

      family.members?.forEach((member) => {
        if (member.email?.toLowerCase().includes(query) || member.name?.toLowerCase().includes(query)) {
          results.push({
            familyId: family.id,
            familyName: family.name || 'Family Plan',
            role: 'Member',
            email: member.email || member.name,
            isIssue,
            isBanned,
          });
        }
      });
    });

    setSearchResult(results.length > 0 ? results : 'not_found');
  }, [families, searchQuery, connectedAccounts]);

  const handleResultClick = useCallback((familyId, isMember, email, role) => {
    const targetFamily = families.find((f) => f.id === familyId);
    if (targetFamily) {
      const targetIsBanned = Boolean(targetFamily.isBanned || targetFamily.is_banned);
      const targetIsIssue = isFamilyAttentionNeeded(targetFamily, connectedAccounts, families);

      if (targetIsBanned && !showBanned) {
        setShowBanned(true);
      }

      if (targetIsIssue) {
        if (filter !== 'issues' && !showIssues) {
          setFilter('issues');
        }
      } else {
        const days = getDaysRemaining(targetFamily.expiryDate);
        const matchesCurrentFilter =
          filter === 'all' ||
          (filter === 'full' && isFamilyFull(targetFamily)) ||
          (filter === 'available' && !isFamilyFull(targetFamily)) ||
          (filter === 'expiring' && days !== null && days >= 0 && days <= 7);

        if (!matchesCurrentFilter) {
          setFilter('all');
        }
      }
    }

    setActiveHighlight({ familyId, expand: isMember, matchedEmail: email, role });
    setActiveIndex(-1); // Reset keyboard selection on click

    // Scroll to the card after filter/tab switch & layout settle (retry briefly if AnimatePresence is mounting)
    const scrollToCard = (attempt = 0) => {
      const element = document.getElementById(`family-card-${familyId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (attempt < 6) {
        setTimeout(() => scrollToCard(attempt + 1), 80);
      }
    };
    setTimeout(() => scrollToCard(0), 100);

    // Reset highlight after 3 seconds
    setTimeout(() => {
      setActiveHighlight((prev) => {
        if (prev.familyId === familyId) {
          return { familyId: null, expand: false, matchedEmail: null, role: null };
        }
        return prev;
      });
    }, 3000);
  }, [families, connectedAccounts, filter, showIssues, showBanned]);

  const handleKeyDown = useCallback((e) => {
    if (!searchResult || searchResult === 'not_found' || searchResult.length === 0) {
      if (e.key === 'Enter') {
        handleSearch();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < searchResult.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : searchResult.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < searchResult.length) {
        const selected = searchResult[activeIndex];
        handleResultClick(selected.familyId, selected.role === 'Member', selected.email, selected.role);
      } else {
        handleSearch();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchQuery('');
      setSearchResult(null);
      setActiveIndex(-1);
    }
  }, [searchResult, activeIndex, handleSearch, handleResultClick]);

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
    return result;
  }, [addFamily, addToast]);

  const handleEditFamily = useCallback(async (updatedFamily) => {
    const result = await updateFamily(updatedFamily);
    if (result?.success) {
      addToast('Family updated!', 'success');
    } else {
      addToast(result?.error || 'Failed to update family', 'error');
    }
    return result;
  }, [updateFamily, addToast]);

  const handleDeleteFamily = useCallback((id) => {
    setDeleteFamilyId(id);
  }, []);

  const confirmDeleteFamily = useCallback(async () => {
    if (deleteFamilyId) {
      const familyName = families.find((f) => f.id === deleteFamilyId)?.name || 'Family';
      const result = await deleteFamily(deleteFamilyId);
      if (result?.success) {
        setDeleteFamilyId(null);
        addToast(`"${familyName}" deleted!`, 'success');
      } else {
        addToast(result?.error || 'Failed to delete family', 'error');
      }
      return result;
    }
    return { success: false, error: "Pilih data terlebih dahulu." };
  }, [deleteFamilyId, families, deleteFamily, addToast]);

  const handleAddMember = useCallback(async (familyId, member, options) => {
    const result = await addMember(familyId, member, options);
    if (result?.success) {
      const targetFamily = families.find((f) => f.id === familyId);
      const isPersonal = isPersonalAccountEmail(
        member.email,
        member.memberType || member.member_type,
        cockpitAccounts,
        families,
      );
      if (isPersonal) {
        void refetchHistory();
        addToast(
          `Akun ${normalizeEmail(member.email)} tercatat masuk ke ${targetFamily?.name || 'Family'}.`,
          'success',
        );
      } else {
        addToast('Member added!', 'success');
      }
    } else {
      addToast(result?.error || 'Failed to add member', 'error');
    }
    return result;
  }, [addMember, families, cockpitAccounts, refetchHistory, addToast]);

  const handleRemoveMember = useCallback((familyId, memberId) => {
    const family = families.find((f) => f.id === familyId);
    const member = family?.members?.find((m) => m.id === memberId);
    const isPersonal = Boolean(
      member &&
        isPersonalAccountEmail(
          member.email,
          member.memberType || member.member_type,
          cockpitAccounts,
          families,
        ),
    );
    setDeleteMemberData({
      familyId,
      familyName: family?.name || family?.ownerEmail || 'Family',
      memberId,
      memberName: member?.name?.trim() || member?.email || 'Member',
      memberEmail: member?.email || '',
      isPersonal,
    });
  }, [families, cockpitAccounts]);

  const confirmDeleteMember = useCallback(async (options) => {
    if (deleteMemberData) {
      const { familyId, familyName, memberId, memberEmail, isPersonal } = deleteMemberData;
      const result = await removeMember(familyId, memberId, options);
      if (result?.success) {
        setDeleteMemberData(null);
        if (isPersonal) {
          void refetchHistory();
          if (options?.removalMode === 'local_correction') {
            addToast('Data dikoreksi secara lokal tanpa mempengaruhi status cooldown.', 'info');
          } else {
            addToast(
              `Akun ${normalizeEmail(memberEmail) || deleteMemberData.memberName} dikeluarkan dari ${familyName} dan riwayat tersimpan.`,
              'success',
            );
          }
        } else {
          addToast('Member removed!', 'success');
        }
      } else {
        addToast(result?.error || 'Failed to remove member', 'error');
      }
      return result;
    }
    return { success: false, error: "Pilih data terlebih dahulu." };
  }, [deleteMemberData, removeMember, refetchHistory, addToast]);

  const handleToggleFamilyPlanStatus = useCallback(async (family, nextStatus) => {
    if (!setFamilyPlanStatus) return { success: false };
    const result = await setFamilyPlanStatus(family.id, nextStatus, null);
    const famLabel = family.name || family.ownerEmail || 'Family';
    if (result?.success) {
      if (nextStatus === 'downgraded_free') {
        const impact = computeFamilyDowngradeImpact({
          family,
          cockpitAccounts,
          historyEntries,
          historyLoadError: historyError,
        });
        if (impact.totalPersonalAccounts === 0) {
          addToast(
            `${famLabel} ditandai PRO Hilang (FREE). Tidak ada akun pribadi yang terdampak.`,
            'warning',
          );
        } else {
          addToast(
            `${famLabel} ditandai PRO Hilang (FREE). ${impact.safeToMove.length} akun pribadi aman dipindah, ${impact.cooldownLocked.length} akun sedang cooldown.`,
            'warning',
            7000,
          );
        }
      } else {
        addToast(`${famLabel} dipulihkan menjadi PRO Aktif.`, 'success');
      }
    } else {
      addToast(result?.error || 'Gagal mengubah status Family. Periksa koneksi dan coba lagi.', 'error');
    }
    return result;
  }, [setFamilyPlanStatus, cockpitAccounts, historyEntries, historyError, addToast]);

  const handleUpdateMember = useCallback(async (familyId, memberId, updatedFields) => {
    const result = await updateMember(familyId, memberId, updatedFields);
    if (result?.success) {
      addToast('Member updated!', 'success');
    } else {
      addToast(result?.error || 'Failed to update member', 'error');
    }
    return result;
  }, [updateMember, addToast]);

  const sortedFamilies = useMemo(() => {
    const filtered = families.filter((f) => {
      if (!showBanned && (f.isBanned || f.is_banned)) return false;

      if (filter === 'issues') return isFamilyAttentionNeeded(f, connectedAccounts, families);
      if (!showIssues && isFamilyAttentionNeeded(f, connectedAccounts, families)) return false;

      if (filter === 'all') return true;
      if (filter === 'full') return isFamilyFull(f);
      if (filter === 'available') return !isFamilyFull(f);
      if (filter === 'expiring') {
        const days = getDaysRemaining(f.expiryDate);
        return days !== null && days >= 0 && days <= 7;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'expiry') {
        const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : 0;
        const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
        comparison = dateA - dateB;
      } else if (sortBy === 'storage') {
        const getStorage = (f) => {
          const emails = new Set();
          if (f.ownerEmail) emails.add(f.ownerEmail.toLowerCase());
          (f.members || []).forEach((m) => m.email && emails.add(m.email.toLowerCase()));

          const accts = (connectedAccounts || []).filter(
            (acc) => acc.status === 'connected' && acc.email && emails.has(acc.email.toLowerCase())
          );

          if (accts.length > 0) {
            const poolUsed = Math.max(...accts.map((acc) => Number(acc.usedBytes) || 0));
            return poolUsed / (1024 * 1024 * 1024);
          }

          const ownerStorageUsed = Number(f.storageUsed ?? f.storage_used ?? 0) || 0;
          const memberSum = (f.members || []).reduce(
            (s, m) => s + (Number(m.storageUsed ?? m.storage_used ?? 0) || 0),
            0
          );
          return ownerStorageUsed + memberSum;
        };
        comparison = getStorage(a) - getStorage(b);
      } else { // created
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        comparison = dateA - dateB;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [families, filter, sortBy, sortDirection, showBanned, showIssues, connectedAccounts]);

  const handleToggleIssues = useCallback(() => {
    setShowIssues((prev) => {
      const next = !prev;
      if (!next && filter === 'issues') {
        setFilter('all');
      }
      return next;
    });
  }, [filter]);

  const stats = useMemo(() => {
    const validFamilies = families.filter(
      (f) => !f.isBanned && !f.is_banned && isFamilyValidStorage(f, connectedAccounts, families),
    );
    return {
      total: validFamilies.length,
      full: validFamilies.filter((f) => isFamilyFull(f)).length,
      availableSlots: validFamilies.reduce((acc, f) => acc + getSlotsAvailable(f), 0),
      totalMembers: validFamilies.reduce((acc, f) => acc + (f.members?.length || 0), 0),
      activeCount: validFamilies.length,
    };
  }, [families, connectedAccounts]);
  
  const expiringSoonCount = useMemo(() => {
    return families.filter((f) => {
      if (f.isBanned || f.is_banned) return false;
      if (!isFamilyValidStorage(f, connectedAccounts, families)) return false;
      const days = getDaysRemaining(f.expiryDate);
      return days !== null && days <= 7 && days >= 0;
    }).length;
  }, [families, connectedAccounts]);

  const issuesCount = useMemo(() => {
    return families.filter((f) => {
      if (!showBanned && (f.isBanned || f.is_banned)) return false;
      return isFamilyAttentionNeeded(f, connectedAccounts, families);
    }).length;
  }, [families, showBanned, connectedAccounts]);

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
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenStorage={() => navigate('/storage')}
        onOpenCockpit={() => navigate('/cockpit')}
        onSyncAllDrives={handleSyncAllDrives}
      />

      <main className="container mx-auto px-6 py-8">
        {(familiesError || driveError) && (
          <div role="alert" className="mb-6 flex flex-col gap-3 border border-red-300 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <span>{familiesError || driveError}</span>
            <button type="button" className="shrink-0 underline underline-offset-4" onClick={() => refetchFamilies()}>{t('admin.load.retry')}</button>
          </div>
        )}
        {/* Refresh otomatis jalan tiap 15 detik. Di luar aliran layout supaya kartu tidak bergeser
            (layout framer-motion menganimasikan geseran itu), dan baru tampil kalau refresh lebih dari 1 detik. */}
        <p
          role="status"
          className={cn(
            'pointer-events-none fixed bottom-4 left-4 z-40 border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-700 transition-opacity dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300',
            refreshing ? 'opacity-90 delay-1000 duration-300' : 'opacity-0 duration-0'
          )}
        >
          {refreshing ? t('admin.load.refreshing') : ''}
        </p>
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
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveIndex(-1);
                  if (e.target.value.trim() === '') {
                    setSearchResult(null);
                  }
                }}
                onKeyDown={handleKeyDown}
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
                  setActiveIndex(-1);
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
                      {t('dashboard.email_not_found').replace('{email}', searchQuery)}
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
                          onClick={() => handleResultClick(result.familyId, result.role === 'Member', result.email, result.role)}
                          className={cn(
                            'flex items-center justify-between py-4 border-b border-dashed last:border-0 cursor-pointer transition-colors px-2 rounded-sm',
                            theme === 'light' 
                              ? cn('border-stone-200 hover:bg-stone-100', idx === activeIndex && 'bg-stone-200/80') 
                              : cn('border-stone-800 hover:bg-stone-800/60', idx === activeIndex && 'bg-stone-800')
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
                          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
                            {result.isBanned && (
                              <span className="px-2 py-0.5 text-[10px] uppercase tracking-widest border font-bold border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400">
                                Banned
                              </span>
                            )}
                            {result.isIssue && (
                              <span className="px-2 py-0.5 text-[10px] uppercase tracking-widest border font-bold border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                Expired
                              </span>
                            )}
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
                            {result.role !== 'Family' && (
                              <span className={cn('text-xs font-serif italic', theme === 'light' ? 'text-stone-400' : 'text-stone-600')}>
                                in {result.familyName}
                              </span>
                            )}
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
          familiesCount={stats.activeCount} // Pass filtered count instead of raw families.length
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
          showBanned={showBanned}
          onToggleBanned={() => setShowBanned(prev => !prev)}
          showIssues={showIssues}
          onToggleIssues={handleToggleIssues}
          issuesCount={issuesCount}
        />

        <FamiliesGrid
          theme={theme}
          t={t}
          sortedFamilies={sortedFamilies}
          allFamilies={families}
          hasAnyFamilies={families.length > 0}
          onClearFilters={() => {
            setFilter('all');
            setShowBanned(false);
            setShowIssues(false);
          }}
          onOpenAddFamily={() => setIsAddFamilyOpen(true)}
          onDelete={handleDeleteFamily}
          onEdit={setEditFamily}
          onAddMember={setAddMemberFamilyId}
          onRemoveMember={handleRemoveMember}
          onEditMember={(familyId, member) => setEditMemberData({ familyId, member })}
          onCancelSale={async (familyId) => {
            const result = await cancelSale(familyId);
            if (result.success) {
              addToast('Sale cancelled! Account is now available again.', 'success');
            } else {
              addToast(`Failed to cancel sale: ${result.error}`, 'error');
            }
          }}
          highlightedFamilyId={activeHighlight.familyId}
          forceExpandFamilyId={activeHighlight.expand ? activeHighlight.familyId : null}
          highlightedEmail={activeHighlight.matchedEmail}
          connectedAccounts={connectedAccounts}
          onConnectDrive={handleConnectDrive}
          onSyncDrive={handleSyncDrive}
          onDisconnectDrive={handleDisconnectDrive}
          cockpitAccounts={cockpitAccounts}
          historyEntries={historyEntries}
          cooldownByEmail={cooldownByEmail}
          historyLoading={historyLoading}
          historyError={historyError}
          onRetryHistory={() => void refetchHistory()}
          onOpenHistory={(email) => setHistoryDrawerEmail(email)}
          onTogglePlanStatus={handleToggleFamilyPlanStatus}
          onMigrateAccount={(email) =>
            navigate(`/cockpit?migrateEmail=${encodeURIComponent(email)}`)
          }
        />
      </main>

      <Suspense fallback={null}>
        <AddFamilyModal
          isOpen={isAddFamilyOpen || Boolean(autoPrefillAccount)}
          onClose={() => {
            setIsAddFamilyOpen(false);
            handledDriveToastRef.current = null;
            clearJustConnected?.();
          }}
          onAdd={handleAddFamily}
          prefillAccount={autoPrefillAccount}
          unlinkedAccounts={unlinkedAccounts}
          onConnectGoogle={handleConnectDriveForNewFamily}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          language={language}
          onToggleLanguage={toggleLanguage}
          onShowTutorial={() => setShowTutorial(true)}
          onLogout={onLogout}
          session={supabase ? session : null}
        />
        
        <EditFamilyModal isOpen={!!editFamily} onClose={() => setEditFamily(null)} onSave={handleEditFamily} family={editFamily} />

        <AddMemberModal
          isOpen={!!addMemberFamilyId}
          onClose={() => setAddMemberFamilyId(null)}
          onAdd={handleAddMember}
          familyId={addMemberFamilyId}
          targetFamily={families.find((f) => f.id === addMemberFamilyId) || null}
          families={families}
          cockpitAccounts={cockpitAccounts}
          historyEntries={historyEntries}
          historyError={historyError}
          onRetryHistory={() => void refetchHistory()}
        />

        <EditMemberModal
          isOpen={!!editMemberData}
          onClose={() => setEditMemberData(null)}
          onUpdate={handleUpdateMember}
          familyId={editMemberData?.familyId}
          member={editMemberData?.member}
          families={families}
        />

        <DeleteConfirmModal
          isOpen={!!deleteFamilyId}
          onClose={() => setDeleteFamilyId(null)}
          onConfirm={confirmDeleteFamily}
          familyName={families.find((f) => f.id === deleteFamilyId)?.name || 'Family'}
        />

        <DeleteMemberConfirmModal
          isOpen={!!deleteMemberData}
          onClose={() => setDeleteMemberData(null)}
          onConfirm={confirmDeleteMember}
          memberName={deleteMemberData?.memberName || 'Member'}
          memberEmail={deleteMemberData?.memberEmail || ''}
          familyName={deleteMemberData?.familyName || ''}
          isPersonal={Boolean(deleteMemberData?.isPersonal)}
          cooldownSummary={
            deleteMemberData?.isPersonal && deleteMemberData?.memberEmail
              ? cooldownByEmail.get(normalizeEmail(deleteMemberData.memberEmail)) || null
              : null
          }
          historyError={historyError}
          onRetryHistory={() => void refetchHistory()}
        />

        <AccountFamilyHistoryDrawer
          isOpen={Boolean(historyDrawerEmail)}
          isDark={theme !== 'light'}
          accountEmail={historyDrawerEmail}
          families={families}
          historyEntries={historyEntries}
          historyLoading={historyLoading}
          historyError={historyError}
          onRetryHistory={() => void refetchHistory()}
          onClose={() => setHistoryDrawerEmail(null)}
          onAddManual={addManualHistory}
          onUpdateEntry={updateHistory}
          onDeleteEntry={deleteHistory}
          onFeedback={(msg, type = 'success') => addToast(msg, type)}
        />

        {showTutorial && <TutorialModal onClose={handleTutorialClose} />}
      </Suspense>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
