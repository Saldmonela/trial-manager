import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { debounce } from '../utils/performance';
import type {
  ActionResult,
  ConnectedAccount,
  StorageAggregate,
  UseConnectedAccountsReturn,
} from '../types';

// Kolom aman — JANGAN sertakan kolom token (di-REVOKE dari client di DB).
const SAFE_COLUMNS =
  'id,provider,provider_account_id,email,display_name,avatar_url,status,total_bytes,used_bytes,available_bytes,trash_bytes,last_synced_at,created_at';

function mapRow(r: any): ConnectedAccount {
  // NUMERIC dikembalikan PostgREST sebagai string → bungkus Number().
  return {
    id: r.id,
    provider: r.provider,
    providerAccountId: r.provider_account_id,
    email: r.email ?? null,
    displayName: r.display_name ?? null,
    avatarUrl: r.avatar_url ?? null,
    status: r.status,
    totalBytes: r.total_bytes === null || r.total_bytes === undefined ? null : Number(r.total_bytes),
    usedBytes: Number(r.used_bytes) || 0,
    availableBytes:
      r.available_bytes === null || r.available_bytes === undefined ? null : Number(r.available_bytes),
    trashBytes: Number(r.trash_bytes) || 0,
    lastSyncedAt: r.last_synced_at ?? null,
    createdAt: r.created_at,
  };
}

/**
 * Mengelola akun cloud terhubung (Google Drive) milik user saat ini + kuotanya.
 * Meniru pola useSupabaseData: optimistic update + rollback, subscription Realtime.
 * Bagian server-side (OAuth, panggil Drive API) ditangani Supabase Edge Functions.
 */
export function useConnectedAccounts(): UseConnectedAccountsReturn {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async (): Promise<void> => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from('connected_accounts')
        .select(SAFE_COLUMNS)
        .order('created_at', { ascending: true });
      if (fetchErr) throw fetchErr;
      setAccounts((data || []).map(mapRow));
    } catch (e) {
      console.error('Error fetching connected accounts:', e);
      setError((e as Error).message);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + Realtime
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void fetchAccounts();

    // Subscription Realtime untuk update lintas-tab. CATATAN KEAMANAN: jangan tambahkan
    // connected_accounts ke publication `supabase_realtime` — payload postgres_changes
    // akan mengirim SEMUA kolom (termasuk token terenkripsi) ke browser. Tanpa publication,
    // subscription ini inert dan kita mengandalkan refetch eksplisit setelah tiap aksi.
    const debouncedFetch = debounce(() => void fetchAccounts(), 800);
    const subscription = supabase
      .channel('public:connected_accounts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connected_accounts' },
        debouncedFetch,
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(subscription);
    };
  }, [fetchAccounts]);

  // Agregat dihitung dari akun yang masih 'connected' saja.
  const aggregate = useMemo<StorageAggregate>(() => {
    const connected = accounts.filter((a) => a.status === 'connected');
    let totalBytes = 0;
    let usedBytes = 0;
    let availableBytes = 0;
    let hasUnlimited = false;

    for (const a of connected) {
      usedBytes += a.usedBytes || 0;
      if (a.totalBytes === null) {
        hasUnlimited = true;
      } else {
        totalBytes += a.totalBytes;
        availableBytes += a.availableBytes ?? Math.max(0, a.totalBytes - (a.usedBytes || 0));
      }
    }

    return {
      totalBytes,
      usedBytes,
      availableBytes,
      accountCount: connected.length,
      hasUnlimited,
    };
  }, [accounts]);

  const connectGoogleDrive = useCallback(async (): Promise<ActionResult> => {
    if (!supabase) return { success: false, error: 'Supabase is not configured' };
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('drive-connect-url', {
        body: { redirectTo: '/storage', origin: window.location.origin },
      });
      if (fnErr) throw fnErr;
      if (!data?.url) throw new Error('Connect URL not returned');
      // Full-page redirect ke consent Google.
      window.location.href = data.url as string;
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }, []);

  const syncQuota = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!supabase) return { success: false, error: 'Supabase is not configured' };
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('drive-sync-quota', {
          body: { accountId: id },
        });
        if (fnErr) throw fnErr;
        const result = data?.results?.[0];
        if (result && result.ok === false) throw new Error(result.error || 'Sync failed');
        await fetchAccounts();
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    },
    [fetchAccounts],
  );

  const syncAll = useCallback(async (): Promise<ActionResult> => {
    if (!supabase) return { success: false, error: 'Supabase is not configured' };
    try {
      const { error: fnErr } = await supabase.functions.invoke('drive-sync-quota', {
        body: { all: true },
      });
      if (fnErr) throw fnErr;
      await fetchAccounts();
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }, [fetchAccounts]);

  const disconnect = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!supabase) return { success: false, error: 'Supabase is not configured' };
      const previous = accounts;
      try {
        setAccounts((prev) => prev.filter((a) => a.id !== id)); // optimistic
        const { error: delErr } = await supabase.from('connected_accounts').delete().eq('id', id);
        if (delErr) throw delErr;
        return { success: true };
      } catch (e) {
        setAccounts(previous); // rollback
        return { success: false, error: (e as Error).message };
      }
    },
    [accounts],
  );

  return {
    accounts,
    aggregate,
    loading,
    error,
    connectGoogleDrive,
    syncQuota,
    syncAll,
    disconnect,
    refetch: fetchAccounts,
  };
}
