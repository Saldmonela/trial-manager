import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  Upload,
  Search,
  RefreshCw,
  AlertTriangle,
  Clock,
  Trash2,
  ArrowUpRight,
  Sun,
  Moon,
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
  Layers,
  History,
} from 'lucide-react';
import { cn } from '../../utils';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../hooks/useToast';
import { useSupabaseData } from '../../hooks/useSupabaseData';
import { useConnectedAccounts } from '../../hooks/useConnectedAccounts';
import { useCockpitAccounts } from '../../hooks/useCockpitAccounts';
import { useAccountFamilyHistory } from '../../hooks/useAccountFamilyHistory';
import {
  buildCockpitOverview,
  filterAndSortCockpitViews,
  getRecommendedFamiliesForAccount,
} from '../../lib/cockpitLogic';
import { normalizeEmail } from '../../lib/cockpitParser';
import ToastContainer from '../ui/ToastContainer';
import CockpitImportModal from './CockpitImportModal';
import FamilyRecommendationDrawer from './FamilyRecommendationDrawer';
import CooldownStatusBadge from '../cooldown/CooldownStatusBadge';
import AccountFamilyHistoryDrawer from '../cooldown/AccountFamilyHistoryDrawer';

const FILTER_OPTIONS = [
  { key: 'all', label: 'Semua' },
  { key: 'free_candidates', label: 'Belum Masuk Family' },
  { key: 'in_pro_family', label: 'Sudah PRO' },
  { key: 'family_downgraded', label: 'Family Turun FREE' },
  { key: 'cooldown_active', label: 'Cooldown Aktif' },
  { key: 'safe_to_move', label: 'Aman Dipindah' },
  { key: 'conflicts', label: 'Konflik Family' },
  { key: 'no_argon', label: 'No Argon' },
  { key: 'need_verif', label: 'Need Verif' },
  { key: 'banned', label: 'Kena Ban' },
  { key: 'untagged', label: 'Belum Ditandai' },
];

function formatSyncTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function EligibilityBadge({ status, isDark }) {
  if (status === 'bisa') {
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 text-[11px] font-semibold border',
          isDark
            ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300'
            : 'border-emerald-700/25 bg-emerald-50 text-emerald-800',
        )}
      >
        Bisa
      </span>
    );
  }
  if (status === 'ban') {
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 text-[11px] font-semibold border',
          isDark
            ? 'border-red-500/35 bg-red-500/15 text-red-300'
            : 'border-red-700/30 bg-red-50 text-red-800',
        )}
      >
        Ban
      </span>
    );
  }
  if (status === 'need_verif') {
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 text-[11px] font-semibold border',
          isDark
            ? 'border-amber-500/35 bg-amber-500/15 text-amber-300'
            : 'border-amber-700/30 bg-amber-50 text-amber-800',
        )}
      >
        Need Verif
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[11px] font-medium border',
        isDark
          ? 'border-stone-700 bg-stone-800/70 text-stone-300'
          : 'border-stone-300 bg-stone-100 text-stone-600',
      )}
    >
      Belum Ditandai
    </span>
  );
}

function ArgonBadge({ status, argonPct, isDark }) {
  if (status === 'available') {
    return (
      <span
        title="Kuota Gemini 4 Argon tersedia (model lengkap: Neon, Argon, Hydrogen, Opus/Sonnet 5.5)"
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold border tabular-nums',
          isDark
            ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300'
            : 'border-emerald-700/30 bg-emerald-50 text-emerald-800',
        )}
      >
        Ada Argon{argonPct !== null ? ` · ${argonPct}%` : ''}
      </span>
    );
  }
  if (status === 'missing') {
    return (
      <span
        title="Kuota Gemini 4 Argon tidak muncul (model terbatas: 3.8 Flash, Opus/Sonnet 4.6, GPT-OSS). Tidak diprioritaskan & aman gabung di Family sama."
        className={cn(
          'inline-flex items-center px-2 py-0.5 text-[11px] font-semibold border',
          isDark
            ? 'border-amber-500/35 bg-amber-500/12 text-amber-300'
            : 'border-amber-700/30 bg-amber-50 text-amber-800',
        )}
      >
        No Argon
      </span>
    );
  }
  return (
    <span
      title="Status kuota Gemini 4 Argon belum dicek (dianggap prioritas sampai ditandai No Argon)"
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[11px] font-medium border',
        isDark
          ? 'border-stone-700 bg-stone-800/70 text-stone-400'
          : 'border-stone-300 bg-stone-100 text-stone-600',
      )}
    >
      Belum Dicek
    </span>
  );
}

export default function CockpitPage() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toasts, addToast, removeToast } = useToast();

  const {
    families,
    loading: familiesLoading,
    refetch: refetchFamilies,
  } = useSupabaseData();
  const {
    accounts: connectedAccounts,
    loading: driveLoading,
    refetch: refetchDrive,
  } = useConnectedAccounts();
  const {
    accounts: cockpitAccounts,
    loading: cockpitLoading,
    error: cockpitError,
    refetch: refetchCockpit,
    importSnapshot,
    updatePlanTier,
    updateArgonStatus,
    deleteAccount,
    assignToFamily,
  } = useCockpitAccounts();
  const {
    entries: historyEntries,
    loading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
    addManualHistory,
    updateHistory,
    deleteHistory,
  } = useAccountFamilyHistory();

  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('priority');
  const [searchQuery, setSearchQuery] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [recTargetView, setRecTargetView] = useState(null);
  const [historyDrawerEmail, setHistoryDrawerEmail] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const migrateParamHandledRef = useRef(false);

  const isLoading = cockpitLoading || familiesLoading || driveLoading;

  const overview = useMemo(
    () =>
      buildCockpitOverview(
        cockpitAccounts,
        families,
        connectedAccounts,
        Date.now(),
        historyEntries,
      ),
    [cockpitAccounts, families, connectedAccounts, historyEntries],
  );

  // Deep-link dari Dashboard Admin (Panel Dampak Family Turun FREE -> Cari Family PRO Pengganti)
  useEffect(() => {
    const migrateEmail = searchParams.get('migrateEmail');
    if (!migrateEmail || isLoading || migrateParamHandledRef.current) return;
    const normalized = normalizeEmail(migrateEmail);
    const matched = overview.views.find((v) => normalizeEmail(v.account.email) === normalized);
    migrateParamHandledRef.current = true;
    if (matched) {
      setRecTargetView(matched);
    } else {
      setSearchQuery(migrateEmail);
    }
    navigate('/cockpit', { replace: true });
  }, [searchParams, isLoading, overview.views, navigate]);

  const visibleViews = useMemo(
    () => filterAndSortCockpitViews(overview.views, filter, sortBy, searchQuery),
    [overview.views, filter, sortBy, searchQuery],
  );

  const recTargetAccount = recTargetView?.account || null;
  const recTargetCooldown = recTargetView?.cooldown || null;
  const isRecLastSwitch = Boolean(
    recTargetCooldown &&
      (recTargetCooldown.status === 'safe_first_family' ||
        recTargetCooldown.status === 'ready_last_switch'),
  );

  const recommendationsForTarget = useMemo(() => {
    if (!recTargetAccount) return [];
    return getRecommendedFamiliesForAccount(
      recTargetAccount,
      cockpitAccounts,
      families,
      connectedAccounts,
      { prioritizeStability: isRecLastSwitch },
    );
  }, [recTargetAccount, cockpitAccounts, families, connectedAccounts, isRecLastSwitch]);

  const existingEmails = useMemo(
    () => cockpitAccounts.map((a) => a.email),
    [cockpitAccounts],
  );

  const filterCounts = useMemo(
    () => ({
      all: overview.metrics.totalAccounts,
      free_candidates: overview.metrics.freeCandidatesCount,
      in_pro_family: overview.views.filter(
        (v) => v.resolvedTier === 'PRO' && v.isArgonPriority,
      ).length,
      family_downgraded: overview.metrics.downgradedAffectedCount,
      cooldown_active: overview.metrics.cooldownLockedCount,
      safe_to_move: overview.metrics.safeToMoveCount,
      conflicts: overview.metrics.conflictAccountsCount,
      no_argon: overview.metrics.noArgonCount,
      need_verif: overview.metrics.needVerifCount,
      banned: overview.metrics.bannedCount,
      untagged: overview.metrics.untaggedCount,
    }),
    [overview],
  );

  const handleRefreshAll = async () => {
    await Promise.all([
      refetchCockpit(),
      refetchFamilies(),
      refetchDrive(),
      refetchHistory(),
    ]);
    addToast('Data Cockpit, Family, Drive, dan Riwayat Cooldown diperbarui.', 'info');
  };

  const handleConfirmImport = async (sanitizedAccounts, clientSkippedCount) => {
    const res = await importSnapshot(sanitizedAccounts, clientSkippedCount);
    if (res.success && res.data) {
      const { imported, created, updated, skipped } = res.data;
      const totalSkipped = Math.max(clientSkippedCount, skipped?.length || 0);
      if (totalSkipped > 0) {
        addToast(
          `Berhasil memperbarui ${imported} akun. ${totalSkipped} baris dilewati karena format email tidak valid.`,
          'warning',
        );
      } else {
        addToast(
          `Berhasil memperbarui ${imported} akun dari Cockpit Tools (${created} baru, ${updated} diperbarui).`,
          'success',
        );
      }
    }
    return res;
  };

  const handleTierOverride = async (accountId, nextTier) => {
    const res = await updatePlanTier(accountId, nextTier);
    if (!res.success) {
      addToast(res.error || 'Gagal mengubah status paket.', 'error');
    } else {
      addToast('Status paket akun diperbarui.', 'success');
    }
  };

  const handleArgonOverride = async (accountId, nextStatus) => {
    const res = await updateArgonStatus(accountId, nextStatus);
    if (!res.success) {
      addToast(res.error || 'Gagal mengubah status kuota Argon.', 'error');
    } else {
      addToast(
        nextStatus === 'missing'
          ? 'Ditandai No Argon — tidak diprioritaskan & aman berbagi Family.'
          : nextStatus === 'available'
            ? 'Ditandai Ada Argon — diprioritaskan untuk Family PRO unik.'
            : 'Status Argon direset ke Belum Dicek.',
        'success',
      );
    }
  };

  const handleConfirmDelete = async (account) => {
    setDeletingId(account.id);
    try {
      const res = await deleteAccount(account.id);
      if (res.success) {
        addToast(`${account.email} dihapus dari daftar pantauan Cockpit.`, 'success');
        setConfirmDeleteId(null);
      } else {
        addToast(res.error || 'Gagal menghapus akun.', 'error');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleAssign = async (accountId, familyId, memberName, familyName, options) => {
    const res = await assignToFamily(accountId, familyId, memberName, familyName, options);
    if (res.success) {
      await Promise.all([refetchFamilies(), refetchCockpit(), refetchHistory()]);
    }
    return res;
  };

  const resetFilters = () => {
    setFilter('all');
    setSortBy('priority');
    setSearchQuery('');
  };

  const hasActiveFilters = filter !== 'all' || sortBy !== 'priority' || searchQuery.trim() !== '';

  return (
    <div
      className={cn(
        'min-h-screen transition-colors duration-300 font-sans',
        isDark ? 'bg-stone-950 text-stone-50' : 'bg-cream text-stone-900',
      )}
    >
      {/* Header */}
      <header
        className={cn(
          'sticky top-0 z-40 border-b transition-colors duration-200',
          isDark ? 'bg-stone-950/95 border-stone-800' : 'bg-cream/95 border-stone-200',
        )}
      >
        <div className="container mx-auto px-4 py-4 md:px-6 md:py-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/admin')}
              aria-label="Kembali ke dashboard"
              title="Kembali ke dashboard"
              className={cn(
                'p-2 rounded-full transition-colors shrink-0',
                isDark ? 'hover:bg-stone-800 text-stone-400 hover:text-stone-100' : 'hover:bg-stone-200 text-stone-600 hover:text-stone-900',
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1
                className={cn(
                  'font-serif text-2xl font-bold tracking-tight leading-tight',
                  isDark ? 'text-white' : 'text-stone-900',
                )}
              >
                Akun <span className={cn('italic', isDark ? 'text-gold-400' : 'text-gold-700')}>Cockpit</span>
              </h1>
              <p className={cn('text-xs mt-0.5', isDark ? 'text-stone-400' : 'text-stone-600')}>
                Pemetaan sebaran akun pribadi ke Family PRO unik &amp; sisa penyimpanan Google Drive
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
              title={isDark ? 'Mode terang' : 'Mode gelap'}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
                isDark ? 'hover:bg-stone-800 text-stone-400' : 'hover:bg-stone-200 text-stone-600',
              )}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleRefreshAll}
              title="Muat ulang data"
              aria-label="Muat ulang data"
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border transition-colors duration-150',
                isDark
                  ? 'border-stone-800 hover:bg-stone-800 text-stone-300'
                  : 'border-stone-300 bg-paper hover:bg-stone-200 text-stone-700',
              )}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Segarkan</span>
            </button>

            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-colors duration-150',
                isDark
                  ? 'bg-stone-50 text-stone-900 hover:bg-stone-200'
                  : 'bg-stone-900 text-stone-50 hover:bg-stone-800',
              )}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Impor Snapshot</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-7 space-y-6">
        {/* Error state */}
        {cockpitError && (
          <div
            role="alert"
            className={cn(
              'flex flex-col sm:flex-row sm:items-center justify-between gap-3 border px-4 py-3 text-sm',
              isDark
                ? 'border-red-500/40 bg-red-500/10 text-red-200'
                : 'border-red-600/35 bg-red-50 text-red-900',
            )}
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{cockpitError}</span>
            </div>
            <button
              type="button"
              onClick={refetchCockpit}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold border shrink-0 self-start sm:self-auto',
                isDark ? 'border-red-400/40 hover:bg-red-500/20' : 'border-red-700/30 hover:bg-red-100',
              )}
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Conflict alert banner (BR-02) */}
        {!isLoading && overview.conflicts.length > 0 && (
          <div
            role="alert"
            className={cn(
              'border px-4 py-3.5 space-y-2',
              isDark
                ? 'border-red-500/40 bg-red-500/10 text-red-100'
                : 'border-red-700/35 bg-red-50 text-red-950',
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Terdeteksi {overview.conflicts.length} Konflik Family Ganda (pool kuota AI akan habis bersamaan)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFilter('conflicts')}
                className={cn(
                  'px-3 py-1 text-xs font-semibold border self-start sm:self-auto transition-colors',
                  isDark ? 'border-red-400/40 hover:bg-red-500/20' : 'border-red-700/30 hover:bg-red-100',
                )}
              >
                Tampilkan Konflik
              </button>
            </div>
            <ul className="space-y-1 text-xs pl-6 list-disc">
              {overview.conflicts.map((c) => (
                <li key={c.familyId}>
                  <strong>{c.familyName}</strong> menampung {c.count} akun pribadi aktif:{' '}
                  <span className="font-mono">{c.emails.join(', ')}</span> — pindahkan salah satu ke Family lain.
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Stale data indicator (BR-06) */}
        {!isLoading && overview.metrics.isAnyStale && (
          <div
            className={cn(
              'flex flex-col sm:flex-row sm:items-center justify-between gap-2 border px-4 py-2.5 text-xs',
              isDark
                ? 'border-amber-500/35 bg-amber-500/10 text-amber-200'
                : 'border-amber-700/30 bg-amber-50 text-amber-900',
            )}
          >
            <span className="inline-flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />
              Data terakhir diperbarui lebih dari 24 jam lalu ({formatSyncTime(overview.metrics.latestSyncedAt)}). Impor ulang snapshot untuk status terbaru.
            </span>
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="underline font-semibold self-start sm:self-auto"
            >
              Impor Sekarang
            </button>
          </div>
        )}

        {/* Partial Error Banner: History failed to load (AC-02-03 Fail-Safe) */}
        {!isLoading && historyError && (
          <div
            role="alert"
            className={cn(
              'flex flex-col sm:flex-row sm:items-center justify-between gap-2 border px-4 py-2.5 text-xs',
              isDark
                ? 'border-red-500/40 bg-red-950/35 text-red-200'
                : 'border-red-700/35 bg-red-50 text-red-900',
            )}
          >
            <span className="inline-flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {historyError}
            </span>
            <button
              type="button"
              onClick={() => void refetchHistory()}
              className="underline font-semibold self-start sm:self-auto cursor-pointer"
            >
              Muat Ulang Riwayat
            </button>
          </div>
        )}

        {/* US-09: Banner Pengingat H-14 Menjelang Bebas Cooldown */}
        {!isLoading && !historyError && overview.metrics.unlockingSoonCount > 0 && (
          <div
            className={cn(
              'flex flex-col sm:flex-row sm:items-center justify-between gap-2 border px-4 py-2.5 text-xs',
              isDark
                ? 'border-gold-500/40 bg-gold-500/10 text-gold-300'
                : 'border-gold-700/35 bg-gold-300/25 text-stone-900',
            )}
          >
            <span className="inline-flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />
              {overview.metrics.unlockingSoonCount} akun pribadi akan bebas dari cooldown 12 bulan dalam ≤ 14 hari lagi.
            </span>
            <button
              type="button"
              onClick={() => setFilter('cooldown_active')}
              className="underline font-semibold self-start sm:self-auto cursor-pointer"
            >
              Lihat Daftar Cooldown
            </button>
          </div>
        )}

        {/* Compact Summary Strip (Operate Ledger — not hero metric cards) */}
        {overview.metrics.totalAccounts > 0 && (
          <section
            aria-label="Ringkasan sebaran akun"
            className={cn(
              'grid grid-cols-2 sm:grid-cols-6 border divide-y sm:divide-y-0 sm:divide-x',
              isDark
                ? 'border-stone-800 divide-stone-800 bg-stone-900/60'
                : 'border-stone-200 divide-stone-200 bg-paper',
            )}
          >
            <div className="px-4 py-3">
              <div className={cn('text-xs', isDark ? 'text-stone-400' : 'text-stone-600')}>
                Tersebar di PRO Unik
              </div>
              <div className="mt-1 flex items-baseline gap-2 tabular-nums">
                <span className="text-xl font-bold">{overview.metrics.uniqueProPct}%</span>
                <span className={cn('text-xs', isDark ? 'text-stone-400' : 'text-stone-500')}>
                  {overview.metrics.uniqueProCount}/{overview.metrics.activeEligibleCount} aktif
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setFilter('free_candidates')}
              className={cn(
                'px-4 py-3 text-left transition-colors cursor-pointer',
                isDark ? 'hover:bg-stone-800/60' : 'hover:bg-stone-100/80',
              )}
            >
              <div className={cn('text-xs', isDark ? 'text-stone-400' : 'text-stone-600')}>
                Kandidat FREE
              </div>
              <div className="mt-1 flex items-baseline gap-2 tabular-nums">
                <span className={cn('text-xl font-bold', overview.metrics.freeCandidatesCount > 0 ? (isDark ? 'text-gold-400' : 'text-gold-700') : '')}>
                  {overview.metrics.freeCandidatesCount}
                </span>
                <span className={cn('text-xs', isDark ? 'text-stone-400' : 'text-stone-500')}>
                  siap PRO
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFilter('cooldown_active')}
              className={cn(
                'px-4 py-3 text-left transition-colors cursor-pointer',
                isDark ? 'hover:bg-stone-800/60' : 'hover:bg-stone-100/80',
              )}
            >
              <div className={cn('text-xs', isDark ? 'text-stone-400' : 'text-stone-600')}>
                Terkunci Cooldown
              </div>
              <div className="mt-1 flex items-baseline gap-2 tabular-nums">
                <span
                  className={cn(
                    'text-xl font-bold',
                    overview.metrics.cooldownLockedCount > 0
                      ? isDark
                        ? 'text-red-400'
                        : 'text-red-700'
                      : isDark
                        ? 'text-emerald-400'
                        : 'text-emerald-700',
                  )}
                >
                  {historyError ? '—' : overview.metrics.cooldownLockedCount}
                </span>
                <span className={cn('text-xs', isDark ? 'text-stone-400' : 'text-stone-500')}>
                  0x pindah
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFilter('family_downgraded')}
              className={cn(
                'px-4 py-3 text-left transition-colors cursor-pointer',
                isDark ? 'hover:bg-stone-800/60' : 'hover:bg-stone-100/80',
              )}
            >
              <div className={cn('text-xs', isDark ? 'text-stone-400' : 'text-stone-600')}>
                Family Turun FREE
              </div>
              <div className="mt-1 flex items-baseline gap-2 tabular-nums">
                <span
                  className={cn(
                    'text-xl font-bold',
                    overview.metrics.downgradedAffectedCount > 0
                      ? isDark
                        ? 'text-amber-300'
                        : 'text-amber-800'
                      : '',
                  )}
                >
                  {overview.metrics.downgradedAffectedCount}
                </span>
                <span className={cn('text-xs', isDark ? 'text-stone-400' : 'text-stone-500')}>
                  butuh migrasi
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFilter('conflicts')}
              className={cn(
                'px-4 py-3 text-left transition-colors cursor-pointer',
                isDark ? 'hover:bg-stone-800/60' : 'hover:bg-stone-100/80',
              )}
            >
              <div className={cn('text-xs', isDark ? 'text-stone-400' : 'text-stone-600')}>
                Konflik Ganda
              </div>
              <div className="mt-1 flex items-baseline gap-2 tabular-nums">
                <span
                  className={cn(
                    'text-xl font-bold',
                    overview.metrics.conflictGroupsCount > 0
                      ? isDark
                        ? 'text-red-400'
                        : 'text-red-700'
                      : isDark
                        ? 'text-emerald-400'
                        : 'text-emerald-700',
                  )}
                >
                  {overview.metrics.conflictGroupsCount}
                </span>
                <span className={cn('text-xs', isDark ? 'text-stone-400' : 'text-stone-500')}>
                  target: 0
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFilter('banned')}
              className={cn(
                'px-4 py-3 text-left transition-colors cursor-pointer',
                isDark ? 'hover:bg-stone-800/60' : 'hover:bg-stone-100/80',
              )}
            >
              <div className={cn('text-xs', isDark ? 'text-stone-400' : 'text-stone-600')}>
                Need Verif / Ban
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2 tabular-nums">
                <span className="text-xl font-bold">
                  {overview.metrics.needVerifCount}/{overview.metrics.bannedCount}
                </span>
                <span className={cn('text-[11px]', isDark ? 'text-stone-500' : 'text-stone-500')}>
                  {formatSyncTime(overview.metrics.latestSyncedAt)}
                </span>
              </div>
            </button>
          </section>
        )}

        {/* Controls Bar: Filter tabs + Search + Sort */}
        {overview.metrics.totalAccounts > 0 && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter status akun Cockpit">
              {FILTER_OPTIONS.map((opt) => {
                const active = filter === opt.key;
                const count = filterCounts[opt.key] ?? 0;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(opt.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-colors duration-150',
                      active
                        ? isDark
                          ? 'bg-stone-100 text-stone-950 border-stone-100'
                          : 'bg-stone-900 text-stone-50 border-stone-900'
                        : isDark
                          ? 'bg-transparent border-stone-800 text-stone-300 hover:bg-stone-900'
                          : 'bg-paper border-stone-300 text-stone-700 hover:bg-stone-100',
                    )}
                  >
                    <span>{opt.label}</span>
                    <span
                      className={cn(
                        'tabular-nums text-[11px]',
                        active ? 'opacity-80' : 'opacity-60',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
                <input
                  type="search"
                  maxLength={100}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari email akun, nama Family, atau tag…"
                  aria-label="Cari akun Cockpit"
                  className={cn(
                    'w-full pl-9 pr-3 py-2 text-sm border transition-colors',
                    isDark
                      ? 'bg-stone-900 border-stone-800 text-stone-100 placeholder:text-stone-500 focus:border-gold-500'
                      : 'bg-paper border-stone-300 text-stone-900 placeholder:text-stone-400 focus:border-gold-700',
                  )}
                />
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="cockpit-sort"
                  className={cn('text-xs font-medium shrink-0', isDark ? 'text-stone-400' : 'text-stone-600')}
                >
                  Urutkan:
                </label>
                <select
                  id="cockpit-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={cn(
                    'px-3 py-2 text-xs font-semibold border cursor-pointer',
                    isDark
                      ? 'bg-stone-900 border-stone-800 text-stone-200'
                      : 'bg-paper border-stone-300 text-stone-800',
                  )}
                >
                  <option value="priority">Prioritas Aksi (Konflik &amp; FREE dulu)</option>
                  <option value="expiry_asc">Masa Aktif Family Terdekat</option>
                  <option value="quota_desc">Sisa Kuota Tertinggi</option>
                  <option value="email_asc">Email A–Z</option>
                </select>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className={cn(
                      'inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold border transition-colors',
                      isDark
                        ? 'border-stone-800 text-stone-300 hover:bg-stone-800'
                        : 'border-stone-300 text-stone-700 hover:bg-stone-200',
                    )}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Filter
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Main Content: Skeleton / Empty / Editorial Table */}
        <section aria-label="Daftar akun Cockpit">
          {isLoading ? (
            <div
              className={cn(
                'border divide-y',
                isDark ? 'border-stone-800 divide-stone-800 bg-stone-900/40' : 'border-stone-200 divide-stone-200 bg-paper',
              )}
              aria-busy="true"
              aria-label="Memuat daftar akun Cockpit"
            >
              {[0, 1, 2, 3, 4].map((idx) => (
                <div key={idx} className="px-4 py-4 flex items-center justify-between gap-4 animate-pulse">
                  <div className="space-y-2 flex-1">
                    <div className={cn('h-4 w-56', isDark ? 'bg-stone-800' : 'bg-stone-200')} />
                    <div className={cn('h-3 w-36', isDark ? 'bg-stone-800/70' : 'bg-stone-200/70')} />
                  </div>
                  <div className={cn('h-7 w-28', isDark ? 'bg-stone-800' : 'bg-stone-200')} />
                </div>
              ))}
            </div>
          ) : overview.metrics.totalAccounts === 0 ? (
            <div
              className={cn(
                'border border-dashed px-6 py-14 text-center max-w-2xl mx-auto space-y-5',
                isDark ? 'border-stone-800 bg-stone-900/40' : 'border-stone-300 bg-paper',
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 mx-auto flex items-center justify-center border',
                  isDark ? 'border-stone-700 bg-stone-900 text-gold-400' : 'border-stone-300 bg-white text-gold-700',
                )}
              >
                <Layers className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h2 className="font-serif text-xl font-bold">Belum ada data akun Cockpit</h2>
                <p className={cn('text-sm max-w-md mx-auto', isDark ? 'text-stone-400' : 'text-stone-600')}>
                  Belum ada data akun Cockpit. Impor snapshot dari Cockpit Tools untuk mulai memantau status dan penempatan Family PRO unik.
                </p>
              </div>
              <ol
                className={cn(
                  'text-left text-xs space-y-2 max-w-md mx-auto border px-4 py-3.5',
                  isDark ? 'border-stone-800 bg-stone-950/60 text-stone-300' : 'border-stone-200 bg-white text-stone-700',
                )}
              >
                <li>1. Buka <strong>Cockpit Tools</strong> lalu ekspor daftar akun sebagai JSON.</li>
                <li>2. Klik <strong>Impor Snapshot</strong> — field <code className="font-mono">refresh_token</code> dibuang otomatis di browser.</li>
                <li>3. Lihat akun yang belum masuk Family PRO, lalu gunakan <strong>Cari Family PRO</strong> bebas konflik ganda.</li>
              </ol>
              <button
                type="button"
                onClick={() => setIsImportOpen(true)}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold transition-colors',
                  isDark
                    ? 'bg-stone-50 text-stone-900 hover:bg-stone-200'
                    : 'bg-stone-900 text-stone-50 hover:bg-stone-800',
                )}
              >
                <Upload className="w-4 h-4" />
                Impor Snapshot Pertama
              </button>
            </div>
          ) : visibleViews.length === 0 ? (
            <div
              className={cn(
                'border px-6 py-12 text-center space-y-3',
                isDark ? 'border-stone-800 bg-stone-900/40' : 'border-stone-200 bg-paper',
              )}
            >
              <p className="text-sm font-medium">
                {filter === 'cooldown_active' && !searchQuery.trim()
                  ? 'Tidak ada akun pribadi yang sedang cooldown 12 bulan. Semua jatah pindah aman.'
                  : 'Tidak ada akun yang cocok dengan filter atau pencarian ini.'}
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border transition-colors cursor-pointer',
                  isDark
                    ? 'border-stone-700 text-stone-200 hover:bg-stone-800'
                    : 'border-stone-300 text-stone-800 hover:bg-stone-200',
                )}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {filter === 'cooldown_active' && !searchQuery.trim()
                  ? 'Tampilkan Semua Akun'
                  : 'Reset Filter'}
              </button>
            </div>
          ) : (
            <div
              className={cn(
                'border overflow-x-auto',
                isDark ? 'border-stone-800 bg-stone-900/40' : 'border-stone-200 bg-paper',
              )}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className={cn(
                      'border-b text-xs font-semibold',
                      isDark
                        ? 'border-stone-800 bg-stone-900 text-stone-400'
                        : 'border-stone-200 bg-stone-100/70 text-stone-600',
                    )}
                  >
                    <th className="py-3 px-4">Akun Email</th>
                    <th className="py-3 px-4">Kelayakan</th>
                    <th className="py-3 px-4">Kuota Argon</th>
                    <th className="py-3 px-4">Paket</th>
                    <th className="py-3 px-4">Posisi Family</th>
                    <th className="py-3 px-4">Status Pindah</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y text-sm', isDark ? 'divide-stone-800/80' : 'divide-stone-200')}>
                  {visibleViews.map((view) => {
                    const {
                      account,
                      primaryMatch,
                      resolvedTier,
                      tierSource,
                      hasConflict,
                      isFreeCandidate,
                      isArgonPriority,
                      argonQuotaPct,
                    } = view;
                    const isNoArgon = account.argonStatus === 'missing';
                    const isConfirmingDelete = confirmDeleteId === account.id;

                    return (
                      <tr
                        key={account.id}
                        className={cn(
                          'transition-colors duration-150 align-top',
                          hasConflict
                            ? isDark
                              ? 'bg-red-500/[0.06] hover:bg-red-500/[0.09]'
                              : 'bg-red-50/70 hover:bg-red-50'
                            : isNoArgon
                              ? isDark
                                ? 'opacity-75 hover:opacity-100 hover:bg-stone-900/90'
                                : 'opacity-80 hover:opacity-100 hover:bg-white'
                              : isDark
                                ? 'hover:bg-stone-900/90'
                                : 'hover:bg-white',
                        )}
                      >
                        {/* Email & Quotas if present */}
                        <td className="py-3.5 px-4 min-w-[220px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={cn(
                                'font-mono text-xs sm:text-sm font-medium break-all',
                                account.eligibilityStatus === 'ban' && 'line-through opacity-65',
                              )}
                            >
                              {account.email}
                            </span>
                            {account.isCurrent && (
                              <span
                                className={cn(
                                  'px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border',
                                  isDark
                                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                    : 'border-emerald-700/35 bg-emerald-50 text-emerald-800',
                                )}
                              >
                                Current
                              </span>
                            )}
                          </div>

                          {hasConflict && (
                            <p className={cn('mt-1 text-xs font-medium inline-flex items-center gap-1', isDark ? 'text-red-300' : 'text-red-700')}>
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              Konflik Family Ganda ({view.conflictFamilyNames.join(', ')})
                            </p>
                          )}

                          {view.isNearExpiryWithQuota && (
                            <p className={cn('mt-1 text-xs font-medium', isDark ? 'text-gold-400' : 'text-gold-700')}>
                              Pakai Dulu — Family hampir kedaluwarsa &amp; kuota masih {view.highestQuotaPct}%
                            </p>
                          )}

                          {isNoArgon && view.isActiveEligibility && (
                            <p className={cn('mt-1 text-xs', isDark ? 'text-amber-300/85' : 'text-amber-800')}>
                              Prioritas rendah (tanpa kuota Gemini 4 Argon · aman gabung di Family sama)
                            </p>
                          )}

                          {account.quotas.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {account.quotas.slice(0, 5).map((q) => (
                                <span
                                  key={q.model}
                                  className={cn(
                                    'text-[11px] tabular-nums px-1.5 py-0.5 border',
                                    isDark ? 'border-stone-800 bg-stone-950 text-stone-300' : 'border-stone-200 bg-white text-stone-700',
                                  )}
                                >
                                  {q.model}: {q.remaining_pct !== null ? `${q.remaining_pct}%` : '—'}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Kelayakan */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <EligibilityBadge status={account.eligibilityStatus} isDark={isDark} />
                        </td>

                        {/* Kuota Argon + quick override */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <ArgonBadge
                              status={account.argonStatus}
                              argonPct={argonQuotaPct}
                              isDark={isDark}
                            />
                            <select
                              aria-label={`Ubah status kuota Argon untuk ${account.email}`}
                              value={account.argonStatus}
                              onChange={(e) => handleArgonOverride(account.id, e.target.value)}
                              className={cn(
                                'text-[11px] bg-transparent border-0 p-0 cursor-pointer underline underline-offset-2 opacity-70 hover:opacity-100',
                                isDark ? 'text-stone-400' : 'text-stone-600',
                              )}
                            >
                              <option value="unknown" className={isDark ? 'bg-stone-900' : 'bg-white'}>
                                Belum Dicek
                              </option>
                              <option value="available" className={isDark ? 'bg-stone-900' : 'bg-white'}>
                                Tandai Ada Argon
                              </option>
                              <option value="missing" className={isDark ? 'bg-stone-900' : 'bg-white'}>
                                Tandai No Argon
                              </option>
                            </select>
                          </div>
                        </td>

                        {/* Paket + quick override */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 text-[11px] font-bold border',
                                resolvedTier === 'PRO'
                                  ? isDark
                                    ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300'
                                    : 'border-emerald-700/30 bg-emerald-50 text-emerald-800'
                                  : isDark
                                    ? 'border-gold-500/35 bg-gold-500/15 text-gold-300'
                                    : 'border-gold-700/35 bg-gold-500/15 text-gold-700',
                              )}
                            >
                              {resolvedTier}
                              {tierSource === 'manual' ? ' (Manual)' : ''}
                            </span>
                            <select
                              aria-label={`Ubah status paket untuk ${account.email}`}
                              value={account.planTier}
                              onChange={(e) => handleTierOverride(account.id, e.target.value)}
                              className={cn(
                                'text-[11px] bg-transparent border-0 p-0 cursor-pointer underline underline-offset-2 opacity-70 hover:opacity-100',
                                isDark ? 'text-stone-400' : 'text-stone-600',
                              )}
                            >
                              <option value="AUTO_FAMILY" className={isDark ? 'bg-stone-900' : 'bg-white'}>
                                Auto (dari Family)
                              </option>
                              <option value="PRO" className={isDark ? 'bg-stone-900' : 'bg-white'}>
                                Tandai PRO
                              </option>
                              <option value="FREE" className={isDark ? 'bg-stone-900' : 'bg-white'}>
                                Tandai FREE
                              </option>
                            </select>
                          </div>
                        </td>

                        {/* Posisi Family */}
                        <td className="py-3.5 px-4 min-w-[180px]">
                          {primaryMatch ? (
                            <div className="space-y-0.5">
                              <div className="font-semibold text-xs sm:text-sm">
                                {primaryMatch.familyName}
                              </div>
                              <div className={cn('text-xs flex items-center gap-2 flex-wrap', isDark ? 'text-stone-400' : 'text-stone-600')}>
                                <span>{primaryMatch.role === 'owner' ? 'Owner' : 'Member'}</span>
                                {primaryMatch.daysRemaining !== null && (
                                  <span className="tabular-nums">
                                    · {primaryMatch.daysRemaining >= 0 ? `${primaryMatch.daysRemaining}h tersisa` : 'Kedaluwarsa'}
                                  </span>
                                )}
                                {primaryMatch.isBanned && (
                                  <span className={cn('font-semibold', isDark ? 'text-red-400' : 'text-red-700')}>
                                    · Family Banned
                                  </span>
                                )}
                              </div>
                              {view.isInDowngradedFamily && (
                                <p className={cn('text-[11px] font-semibold', isDark ? 'text-red-300' : 'text-red-700')}>
                                  FREE (Family Turun Paket)
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className={cn('text-xs', isDark ? 'text-stone-500' : 'text-stone-500')}>
                              Belum masuk Family
                            </span>
                          )}
                        </td>

                        {/* Status Pindah / Cooldown 12 Bulan (US-02, US-04) */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <CooldownStatusBadge
                            summary={view.cooldown}
                            isDark={isDark}
                            loading={historyLoading}
                            error={historyError}
                            onClick={() => setHistoryDrawerEmail(account.email)}
                            onRetry={() => void refetchHistory()}
                          />
                        </td>

                        {/* Aksi */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {(isFreeCandidate || view.isInDowngradedFamily) && (
                              <button
                                type="button"
                                onClick={() => setRecTargetView(view)}
                                className={cn(
                                  'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                                  view.isInDowngradedFamily && view.cooldown.status === 'cooldown_active'
                                    ? isDark
                                      ? 'border border-red-500/45 bg-red-950/40 text-red-200 hover:bg-red-950/70'
                                      : 'border border-red-700/40 bg-red-50 text-red-900 hover:bg-red-100'
                                    : isDark
                                      ? 'bg-stone-100 text-stone-950 hover:bg-stone-200'
                                      : 'bg-stone-900 text-stone-50 hover:bg-stone-800',
                                )}
                              >
                                {view.isInDowngradedFamily
                                  ? view.cooldown.status === 'cooldown_active'
                                    ? 'Terkunci · Lihat Opsi'
                                    : 'Pindah ke Family PRO'
                                  : 'Cari Family PRO'}
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setHistoryDrawerEmail(account.email)}
                              aria-label={`Lihat riwayat Family untuk ${account.email}`}
                              title="Lihat & catat riwayat Family"
                              className={cn(
                                'p-1.5 transition-colors cursor-pointer',
                                isDark
                                  ? 'text-stone-400 hover:text-gold-400 hover:bg-stone-800'
                                  : 'text-stone-500 hover:text-gold-700 hover:bg-stone-100',
                              )}
                            >
                              <History className="w-4 h-4" />
                            </button>

                            {!isFreeCandidate && resolvedTier === 'PRO' && !hasConflict && isArgonPriority && (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 text-xs',
                                  isDark ? 'text-emerald-400' : 'text-emerald-700',
                                )}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Aman
                              </span>
                            )}

                            {isNoArgon && view.isActiveEligibility && (
                              <span
                                className={cn(
                                  'text-xs',
                                  isDark ? 'text-stone-500' : 'text-stone-500',
                                )}
                              >
                                Non-prioritas
                              </span>
                            )}

                            {isConfirmingDelete ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={deletingId === account.id}
                                  onClick={() => handleConfirmDelete(account)}
                                  className={cn(
                                    'px-2.5 py-1 text-xs font-semibold border transition-colors',
                                    isDark
                                      ? 'border-red-500/50 bg-red-500/20 text-red-200 hover:bg-red-500/30'
                                      : 'border-red-700/40 bg-red-600 text-white hover:bg-red-700',
                                  )}
                                >
                                  {deletingId === account.id ? 'Menghapus…' : 'Hapus'}
                                </button>
                                <button
                                  type="button"
                                  disabled={deletingId === account.id}
                                  onClick={() => setConfirmDeleteId(null)}
                                  className={cn(
                                    'px-2 py-1 text-xs border',
                                    isDark ? 'border-stone-700 text-stone-300' : 'border-stone-300 text-stone-700',
                                  )}
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(account.id)}
                                aria-label={`Hapus ${account.email} dari daftar pantauan Cockpit`}
                                title="Hapus dari daftar pantauan Cockpit (tidak menghapus data Family)"
                                className={cn(
                                  'p-1.5 transition-colors',
                                  isDark
                                    ? 'text-stone-500 hover:text-red-400 hover:bg-stone-800'
                                    : 'text-stone-400 hover:text-red-700 hover:bg-stone-100',
                                )}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <CockpitImportModal
        isOpen={isImportOpen}
        isDark={isDark}
        existingEmails={existingEmails}
        onClose={() => setIsImportOpen(false)}
        onConfirmImport={handleConfirmImport}
      />

      <FamilyRecommendationDrawer
        isOpen={Boolean(recTargetAccount)}
        isDark={isDark}
        targetAccount={recTargetAccount}
        cooldownSummary={recTargetCooldown}
        historyError={historyError}
        onRetryHistory={() => void refetchHistory()}
        leavePreviousFamilyId={recTargetView?.isInDowngradedFamily ? recTargetView.downgradedFamilyId : null}
        leavePreviousFamilyName={recTargetView?.isInDowngradedFamily ? recTargetView.downgradedFamilyName : null}
        recommendations={recommendationsForTarget}
        onClose={() => setRecTargetView(null)}
        onAssign={handleAssign}
        onAssignSuccess={(email, famName) => {
          addToast(`Akun ${email} tercatat masuk ke ${famName}.`, 'success');
        }}
        onCopyFeedback={(msg, type = 'success') => addToast(msg, type)}
      />

      <AccountFamilyHistoryDrawer
        isOpen={Boolean(historyDrawerEmail)}
        isDark={isDark}
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

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
