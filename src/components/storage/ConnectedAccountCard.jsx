import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Trash2, AlertCircle, Cloud } from 'lucide-react';
import { cn, formatBytes } from '../../utils';

function timeAgo(iso) {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return 'never';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * Kartu satu akun Google Drive terhubung: identitas, bar kuota, tombol Sync & Disconnect.
 * onSync/onDisconnect mengembalikan ActionResult; toast ditangani oleh parent (StoragePage).
 */
export default function ConnectedAccountCard({ theme, account, onSync, onDisconnect, linkedToFamily = true, simulatePct = null }) {
  const isDark = theme === 'dark';
  const [syncing, setSyncing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const isUnlimited = account.totalBytes === null;
  const isDisconnected = account.status === 'disconnected';

  // Mode simulasi: used = simulatePct% dari total akun ASLI (untuk pratinjau warna).
  const simulating = simulatePct != null && !isUnlimited && account.totalBytes > 0;
  const usedBytes = simulating ? (simulatePct / 100) * account.totalBytes : account.usedBytes;
  const pct = !isUnlimited && account.totalBytes > 0
    ? Math.min(100, (usedBytes / account.totalBytes) * 100)
    : 0;

  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const pctTextColor = pct >= 90
    ? 'text-red-500'
    : pct >= 70
      ? 'text-amber-500'
      : (isDark ? 'text-emerald-400' : 'text-emerald-600');

  const handleSync = async () => {
    setSyncing(true);
    await onSync?.(account.id);
    setSyncing(false);
  };

  const handleDisconnect = async () => {
    setRemoving(true);
    await onDisconnect?.(account.id);
    // Bila sukses, kartu hilang (parent menghapus dari list); reset bila masih ada.
    setRemoving(false);
    setConfirming(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={cn(
        'relative overflow-hidden border p-5 flex flex-col gap-4',
        isDark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200',
        isDisconnected && 'opacity-70',
      )}
    >
      {/* Identity */}
      <div className="flex items-center gap-3">
        {account.avatarUrl ? (
          <img src={account.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', isDark ? 'bg-stone-800 text-stone-400' : 'bg-stone-100 text-stone-500')}>
            <Cloud className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-bold truncate', isDark ? 'text-stone-100' : 'text-stone-900')}>
            {account.displayName || account.email || 'Google Drive'}
          </p>
          <p className={cn('text-xs truncate', isDark ? 'text-stone-500' : 'text-stone-400')}>
            {account.email || account.providerAccountId}
          </p>
          {!linkedToFamily && (
            <span className={cn('inline-block mt-1 px-1.5 py-0.5 text-[9px] uppercase tracking-widest font-bold rounded-sm border', isDark ? 'border-amber-900/50 bg-amber-950/30 text-amber-400' : 'border-amber-200 bg-amber-50 text-amber-700')}>
              Not linked to a family
            </span>
          )}
        </div>
        {isDisconnected && (
          <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold text-red-500 border border-red-500/40 bg-red-500/10">
            <AlertCircle className="w-3 h-3" /> Reconnect
          </span>
        )}
      </div>

      {/* Quota */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className={cn('text-xs font-medium', isDark ? 'text-stone-400' : 'text-stone-600')}>
            {formatBytes(usedBytes)} {isUnlimited ? '' : `/ ${formatBytes(account.totalBytes)}`}
          </span>
          <span className={cn('text-xs uppercase tracking-widest font-bold', pctTextColor)}>
            {isUnlimited ? 'Unlimited' : `${pct.toFixed(0)}%`}
          </span>
        </div>
        <div className={cn('h-3 w-full overflow-hidden rounded-full', isDark ? 'bg-stone-800' : 'bg-stone-200')}>
          {!isUnlimited && pct > 0 && (
            <div
              style={{ width: `${Math.max(pct, 3)}%` }}
              className={cn('h-full rounded-full transition-all duration-500 ease-out', barColor)}
            />
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-1">
        <span className={cn('text-[10px] uppercase tracking-widest', isDark ? 'text-stone-600' : 'text-stone-400')}>
          Synced {timeAgo(account.lastSyncedAt)}
        </span>

        {confirming ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirming(false)}
              className={cn('text-[10px] uppercase tracking-widest font-bold px-2 py-1', isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-900')}
            >
              Cancel
            </button>
            <button
              onClick={handleDisconnect}
              disabled={removing}
              className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
            >
              {removing ? 'Removing…' : 'Confirm'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={handleSync}
              disabled={syncing}
              aria-label="Sync quota"
              title="Sync quota"
              className={cn('p-2 rounded-full transition-colors disabled:opacity-60', isDark ? 'hover:bg-stone-800 text-stone-400' : 'hover:bg-stone-100 text-stone-600')}
            >
              <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
            </button>
            <button
              onClick={() => setConfirming(true)}
              aria-label="Disconnect account"
              title="Disconnect"
              className={cn('p-2 rounded-full transition-colors', isDark ? 'hover:bg-red-900/40 text-stone-400 hover:text-red-400' : 'hover:bg-red-50 text-stone-600 hover:text-red-600')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
