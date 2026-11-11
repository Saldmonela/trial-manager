import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { invokeApi } from '../lib/api';
import type { ActionResult, ConnectedAccount, JustConnectedDrive, StorageAggregate, UseConnectedAccountsReturn } from '../types';
const SAFE_COLUMNS = 'id,provider,provider_account_id,email,display_name,avatar_url,status,total_bytes,used_bytes,available_bytes,trash_bytes,last_synced_at,created_at';
const completions = new Map<string, Promise<ActionResult<{ id?: string; intent?: string | null }>>>();
export async function beginDriveConnection(path: '/admin' | '/storage' = '/storage', loginHint = '', intent = ''): Promise<ActionResult> {
  try {
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    const result = await invokeApi<{ state?: string; url: string }>('drive-connect-url', { redirectTo: path, origin: window.location.origin, loginHint, browserNonce: nonce });
    if (!result.success || !result.data?.url) return { success: false, error: result.error || 'Tidak bisa memulai koneksi Drive.' };
    const url = new URL(result.data.url);
    if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') return { success: false, error: 'URL Google tidak valid.' };
    if (result.data.state) {
      sessionStorage.setItem('drive-nonce:' + result.data.state, nonce);
      if (intent) sessionStorage.setItem('drive-intent:' + result.data.state, intent);
    }
    window.location.assign(url.href); return { success: true };
  } catch { return { success: false, error: 'Tidak bisa memulai koneksi Drive.' }; }
}
export async function completeDriveConnection(): Promise<ActionResult<{ id?: string; intent?: string | null }> | null> {
  const params = new URLSearchParams(window.location.hash.slice(1)); const state = params.get('drive_state'); const code = params.get('drive_code'); const error = params.get('drive_error');
  if (!state && !code && !error) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (error) return { success: false, error: 'Koneksi Google tidak selesai. Ulangi dari browser ini.' };
  if (!state || !code) return { success: false, error: 'Sesi koneksi tidak valid.' };
  if (completions.has(state)) return completions.get(state)!;
  const nonce = sessionStorage.getItem('drive-nonce:' + state);
  const intent = sessionStorage.getItem('drive-intent:' + state) || null;
  if (!nonce) return { success: false, error: 'Selesaikan koneksi dari browser yang memulainya.' };
  const promise = invokeApi<{ id?: string }>('drive-complete-connect', { state, code, browserNonce: nonce })
    .then((res): ActionResult<{ id?: string; intent?: string | null }> => res.success ? { success: true, data: { id: res.data?.id, intent } } : res)
    .finally(() => { sessionStorage.removeItem('drive-nonce:' + state); sessionStorage.removeItem('drive-intent:' + state); completions.delete(state); });
  completions.set(state, promise); return promise;
}
function mapRow(r: Record<string, any>): ConnectedAccount {
  return { id: r.id, provider: r.provider, providerAccountId: r.provider_account_id, email: r.email, displayName: r.display_name, avatarUrl: r.avatar_url,
    status: r.status, totalBytes: r.total_bytes == null ? null : Number(r.total_bytes), usedBytes: Number(r.used_bytes) || 0,
    availableBytes: r.available_bytes == null ? null : Number(r.available_bytes), trashBytes: Number(r.trash_bytes) || 0,
    lastSyncedAt: r.last_synced_at, createdAt: r.created_at };
}
export function useConnectedAccounts(): UseConnectedAccountsReturn {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState<JustConnectedDrive | null>(null);
  const clearJustConnected = useCallback(() => setJustConnected(null), []);
  const refetch = useCallback(async () => {
    try {
      if (!supabase) throw new Error();
      const { data, error: fetchError } = await supabase.from('connected_accounts').select(SAFE_COLUMNS).order('created_at', { ascending: true });
      if (fetchError) throw fetchError; setAccounts((data || []).map(mapRow)); setError(null);
    } catch { setError('Koneksi Drive tidak dapat dimuat. Coba lagi.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await completeDriveConnection();
      await refetch();
      if (!active) return;
      if (result?.success === false) setError(result.error || 'Koneksi gagal.');
      else if (result?.success && result.data?.id) setJustConnected({ accountId: result.data.id, intent: result.data.intent ?? null });
    })();
    const refresh = () => void refetch(); window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); };
  }, [refetch]);
  const sync = useCallback(async (body: object): Promise<ActionResult> => {
    const result = await invokeApi<{ results: { ok: boolean; error?: string }[] }>('drive-sync-quota', body);
    if (!result.success) return result;
    const results = result.data?.results;
    if (!results?.length) return { success: false, error: 'Server tidak mengirim hasil sinkronisasi.' };
    await refetch();
    const failed = results.filter(r => !r.ok);
    if (failed.length) return { success: false, code: 'PARTIAL_SYNC', error: failed.length + ' akun gagal disinkronkan. ' + (failed[0].error || '') };
    return { success: true };
  }, [refetch]);
  const disconnect = useCallback(async (id: string) => {
    const result = await invokeApi('drive-disconnect', { accountId: id });
    if (result.success) { await refetch(); return result; }
    if (!supabase) return result;
    const { error: delErr } = await supabase.from('connected_accounts').delete().eq('id', id);
    if (delErr) return { success: false, error: delErr.message };
    await refetch();
    return { success: true };
  }, [refetch]);
  const aggregate = useMemo<StorageAggregate>(() => {
    const connected = accounts.filter(a => a.status === 'connected');
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
    return { totalBytes, usedBytes, availableBytes, accountCount: connected.length, hasUnlimited };
  }, [accounts]);
  return { accounts, aggregate, loading, error, justConnected, clearJustConnected, connectGoogleDrive: beginDriveConnection, syncQuota: id => sync({ accountId: id }), syncAll: () => sync({ all: true }), disconnect, refetch };
}
