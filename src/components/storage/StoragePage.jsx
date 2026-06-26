import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ChevronLeft, RefreshCw, Cloud, Info, FlaskConical, HardDrive } from 'lucide-react';
import { cn } from '../../utils';
import { supabase } from '../../supabaseClient';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../hooks/useToast';
import { useConnectedAccounts } from '../../hooks/useConnectedAccounts';
import ToastContainer from '../ui/ToastContainer';
import ConnectAccountButton from './ConnectAccountButton';
import StorageAggregateCard from './StorageAggregateCard';
import ConnectedAccountCard from './ConnectedAccountCard';
import StoragePreviewPanel from './StoragePreviewPanel';

const ERROR_MESSAGES = {
  invalid_state: 'Connection link expired. Please try connecting again.',
  missing_code_or_state: 'Connection was interrupted. Please try again.',
  callback_failed: 'Could not complete the connection. Please try again.',
  access_denied: 'You declined the Google permission request.',
};

/**
 * Halaman /storage (admin-only, di-guard oleh AdminRoute di App.jsx).
 * Menampilkan akun Google Drive terhubung + agregat kuota, dan menangani
 * redirect balik setelah OAuth (query: drive_connected / drive_error).
 */
export default function StoragePage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toasts, addToast, removeToast } = useToast();
  const {
    accounts,
    loading,
    error,
    connectGoogleDrive,
    syncQuota,
    syncAll,
    disconnect,
    refetch,
  } = useConnectedAccounts();

  const handledRef = useRef(false);
  const [sortBy, setSortBy] = useState('used-desc');
  const [showSimulator, setShowSimulator] = useState(false);
  const [simPct, setSimPct] = useState(80);

  const sortedAccounts = useMemo(() => {
    const list = [...accounts];
    if (sortBy === 'used-desc') {
      return list.sort((a, b) => (b.usedBytes || 0) - (a.usedBytes || 0));
    }
    if (sortBy === 'used-asc') {
      return list.sort((a, b) => (a.usedBytes || 0) - (b.usedBytes || 0));
    }
    if (sortBy === 'name') {
      return list.sort((a, b) => {
        const nameA = (a.displayName || a.email || '').toLowerCase();
        const nameB = (b.displayName || b.email || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }
    if (sortBy === 'date-added') {
      return list.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      });
    }
    return list;
  }, [accounts, sortBy]);

  // Ambil family + email member-nya, dikelompokkan per family. Dipakai untuk:
  // (a) badge "Not linked" (union semua email), dan
  // (b) agregat pool-aware: 1 family = 1 pool Google One (limit dihitung sekali).
  const [ownerEmails, setOwnerEmails] = useState(() => new Set()); // union semua email tertaut
  const [familyGroups, setFamilyGroups] = useState([]); // array of Set<email> per family
  const [ownersLoaded, setOwnersLoaded] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    (async () => {
      const { data: fams } = await supabase
        .from('families')
        .select('id, owner_email, members(email)');
      if (!active) return;
      const union = new Set();
      const groups = [];
      (fams || []).forEach((f) => {
        const g = new Set();
        if (f.owner_email) { const e = f.owner_email.toLowerCase(); g.add(e); union.add(e); }
        (f.members || []).forEach((m) => {
          if (m.email) { const e = m.email.toLowerCase(); g.add(e); union.add(e); }
        });
        if (g.size) groups.push(g);
      });
      setOwnerEmails(union);
      setFamilyGroups(groups);
      setOwnersLoaded(true);
    })();
    return () => { active = false; };
  }, []);

  // Agregat POOL-AWARE: tiap family = 1 pool (limit dihitung sekali, usage dijumlah).
  // Akun yang tak masuk family mana pun (orphan) = pool sendiri.
  const poolAggregate = useMemo(() => {
    const connected = accounts.filter((a) => a.status === 'connected');
    const counted = new Set();
    let totalBytes = 0;
    let usedBytes = 0;
    let availableBytes = 0;
    let hasUnlimited = false;

    for (const group of familyGroups) {
      const accts = connected.filter((a) => a.email && group.has(a.email.toLowerCase()));
      if (accts.length === 0) continue;
      accts.forEach((a) => counted.add(a.id));
      const poolUsed = accts.reduce((s, a) => s + (a.usedBytes || 0), 0);
      usedBytes += poolUsed;
      if (accts.some((a) => a.totalBytes === null)) {
        hasUnlimited = true;
      } else {
        const poolLimit = Math.max(...accts.map((a) => a.totalBytes || 0));
        totalBytes += poolLimit;
        availableBytes += Math.max(0, poolLimit - poolUsed);
      }
    }

    for (const a of connected) {
      if (counted.has(a.id)) continue;
      usedBytes += a.usedBytes || 0;
      if (a.totalBytes === null) {
        hasUnlimited = true;
      } else {
        totalBytes += a.totalBytes;
        availableBytes += Math.max(0, (a.totalBytes || 0) - (a.usedBytes || 0));
      }
    }

    return { totalBytes, usedBytes, availableBytes, accountCount: connected.length, hasUnlimited };
  }, [accounts, familyGroups]);

  // Tangani redirect balik dari OAuth sekali, lalu bersihkan query params.
  useEffect(() => {
    const connected = searchParams.get('drive_connected');
    const errCode = searchParams.get('drive_error');
    if (!connected && !errCode) return;
    if (handledRef.current) return;
    handledRef.current = true;

    if (connected) {
      addToast('Google Drive connected successfully', 'success');
      void refetch();
    } else if (errCode) {
      addToast(ERROR_MESSAGES[errCode] || `Could not connect Google Drive (${errCode})`, 'error');
    }
    navigate('/storage', { replace: true });
  }, [searchParams, addToast, refetch, navigate]);

  const handleConnect = async () => {
    const res = await connectGoogleDrive();
    if (!res.success) addToast(res.error || 'Could not start Google connect', 'error');
    return res;
  };

  const handleSync = async (id) => {
    const res = await syncQuota(id);
    addToast(res.success ? 'Quota synced' : (res.error || 'Sync failed'), res.success ? 'success' : 'error');
    return res;
  };

  const handleSyncAll = async () => {
    const res = await syncAll();
    addToast(res.success ? 'All accounts synced' : (res.error || 'Sync failed'), res.success ? 'success' : 'error');
  };

  const handleDisconnect = async (id) => {
    const res = await disconnect(id);
    addToast(res.success ? 'Account disconnected' : (res.error || 'Failed to disconnect'), res.success ? 'success' : 'error');
    return res;
  };

  return (
    <div className={cn('min-h-screen transition-colors duration-500 font-sans', isDark ? 'bg-stone-950 text-stone-50' : 'bg-stone-50 text-stone-900')}>
      {/* Header */}
      <header className={cn('sticky top-0 z-40 backdrop-blur-md border-b transition-colors', isDark ? 'bg-stone-950/90 border-stone-800' : 'bg-stone-50/90 border-stone-200')}>
        <div className="container mx-auto px-4 py-4 md:px-6 md:py-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => navigate('/admin')}
              aria-label="Back to dashboard"
              className={cn('p-2 rounded-full transition-colors', isDark ? 'hover:bg-stone-800 text-stone-400' : 'hover:bg-stone-200 text-stone-600')}
              title="Back to dashboard"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span
              aria-hidden="true"
              title="Cloud Storage"
              className={cn(
                'hidden sm:flex items-center justify-center p-2 rounded-full',
                isDark ? 'bg-stone-800 text-gold-400' : 'bg-stone-200 text-gold-600'
              )}
            >
              <HardDrive className="w-5 h-5" />
            </span>
            <div>
              <h1 className={cn('font-serif text-2xl font-bold tracking-tight', isDark ? 'text-white' : 'text-stone-900')}>
                Storage <span className="text-gold-500 italic">Overview</span>
              </h1>
              <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] opacity-60">Total kuota & semua akun Drive</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto justify-center md:justify-end">
            <button
              onClick={() => setShowSimulator((v) => !v)}
              title="Preview / simulasi warna"
              className={cn(
                'flex items-center justify-center gap-2 transition-colors border rounded-full md:rounded-none w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2.5 text-xs font-bold uppercase tracking-widest shrink-0 min-h-[40px] md:min-h-[44px]',
                showSimulator
                  ? (isDark ? 'bg-stone-800 border-stone-700 text-gold-400' : 'bg-stone-100 border-stone-300 text-gold-600')
                  : (isDark ? 'border-stone-800 hover:bg-stone-800 text-stone-300' : 'border-stone-200 hover:bg-stone-200 text-stone-700'),
              )}
            >
              <FlaskConical className="w-4 h-4" />
              <span className="hidden md:inline">Preview</span>
            </button>
            {accounts.length > 0 && (
              <button
                onClick={handleSyncAll}
                title="Sync All Accounts"
                className={cn(
                  'flex items-center justify-center gap-2 transition-colors border rounded-full md:rounded-none w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2.5 text-xs font-bold uppercase tracking-widest shrink-0 min-h-[40px] md:min-h-[44px]',
                  isDark ? 'border-stone-800 hover:bg-stone-800 text-stone-300' : 'border-stone-200 hover:bg-stone-200 text-stone-700'
                )}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden md:inline">Sync All</span>
              </button>
            )}
            <ConnectAccountButton theme={theme} onConnect={handleConnect} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Penjelasan peran halaman ini (overview / jaring pengaman) */}
        <div className={cn('flex items-start gap-3 border px-4 py-3 text-sm', isDark ? 'border-stone-800 bg-stone-900/50 text-stone-400' : 'border-stone-200 bg-white text-stone-600')}>
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-gold-500" />
          <p>
            Ini halaman <b>ringkasan</b>: total kuota gabungan semua akun + tempat mengelola akun
            yang belum tertaut family. Untuk menghubungkan Drive ke family tertentu, gunakan tombol
            <b> Connect</b> di kartu family pada dashboard. Akun bertanda <b>Not linked to a family</b>
            belum cocok dengan email owner mana pun.
          </p>
        </div>

        <AnimatePresence>
          {showSimulator && (
            <StoragePreviewPanel theme={theme} pct={simPct} onChange={setSimPct} onClose={() => setShowSimulator(false)} />
          )}
        </AnimatePresence>

        {error && (
          <div className="border border-red-500/40 bg-red-500/10 text-red-500 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {accounts.length > 0 && (
          <StorageAggregateCard theme={theme} aggregate={poolAggregate} simulatePct={showSimulator ? simPct : null} />
        )}

        <section>
          <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-2 border-b', isDark ? 'border-stone-800' : 'border-stone-200')}>
            <h2 className={cn('font-serif text-lg font-bold', isDark ? 'text-stone-100' : 'text-stone-900')}>
              Connected Accounts
            </h2>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs uppercase tracking-widest font-semibold', isDark ? 'text-stone-500' : 'text-stone-400')}>
                Sort by:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-transparent border focus:outline-none transition-colors cursor-pointer rounded-none',
                  isDark
                    ? 'border-stone-800 text-stone-300 focus:border-stone-600 bg-stone-950'
                    : 'border-stone-200 text-stone-700 focus:border-stone-400 bg-white'
                )}
              >
                <option value="used-desc" className={isDark ? 'bg-stone-900 text-white' : 'bg-white text-black'}>Storage Used (Most → Least)</option>
                <option value="used-asc" className={isDark ? 'bg-stone-900 text-white' : 'bg-white text-black'}>Storage Used (Least → Most)</option>
                <option value="name" className={isDark ? 'bg-stone-900 text-white' : 'bg-white text-black'}>Name</option>
                <option value="date-added" className={isDark ? 'bg-stone-900 text-white' : 'bg-white text-black'}>Date Added</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p className={cn('font-serif italic text-sm', isDark ? 'text-stone-500' : 'text-stone-400')}>Loading accounts…</p>
          ) : accounts.length === 0 ? (
            <div className={cn('flex flex-col items-center justify-center text-center gap-4 border border-dashed py-16 px-6', isDark ? 'border-stone-800' : 'border-stone-300')}>
              <div className={cn('w-16 h-16 flex items-center justify-center border-2', isDark ? 'border-stone-700 bg-stone-900 text-gold-500' : 'border-stone-200 bg-white text-gold-600')}>
                <Cloud className="w-8 h-8" />
              </div>
              <div>
                <p className={cn('font-serif text-lg font-bold', isDark ? 'text-stone-100' : 'text-stone-900')}>No storage connected yet</p>
                <p className={cn('text-sm max-w-sm', isDark ? 'text-stone-500' : 'text-stone-400')}>
                  Connect a Google Drive account to pool its free storage and track real quota here.
                </p>
              </div>
              <ConnectAccountButton theme={theme} onConnect={handleConnect} label="Connect your first Drive" hideTextMobile={false} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {sortedAccounts.map((account) => (
                  <ConnectedAccountCard
                    key={account.id}
                    theme={theme}
                    account={account}
                    linkedToFamily={!ownersLoaded || ownerEmails.has(account.email?.toLowerCase())}
                    onSync={handleSync}
                    onDisconnect={handleDisconnect}
                    simulatePct={showSimulator ? simPct : null}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
