import { useState, useEffect, useCallback } from 'react';
import { supabase, supabasePublic } from '../supabaseClient';
import { encryptPassword, decryptPassword, isEncrypted } from '../lib/crypto';
import { debounce } from '../utils/performance';
import { MAX_FAMILY_SLOTS } from '../lib/familyUtils';
import type {
  Family,
  FamilyInput,
  Member,
  ActionResult,
  JoinRequest,
  JoinRequestInput,
  JoinRequestStatus,
  PublicFamily,
  UseJoinRequestsReturn,
  UseSupabaseDataReturn,
  UsePublicFamiliesReturn,
} from '../types';

/**
 * Gets the current user's stable ID for encryption key derivation.
 * Uses user.id (UUID, never changes) instead of access_token (JWT, rotates every ~1hr)
 * to ensure passwords remain decryptable across sessions.
 */
async function getEncryptionKey(): Promise<string> {
  if (!supabase) return '';
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || '';
}

interface PublicFamilyRow {
  id: string;
  name: string | null;
  expiry_date: string | null;
  storage_used: number | null;
  created_at?: string;
  price_monthly?: number;
  price_annual?: number;
  price_sale?: number;
  currency?: string;
  product_type?: 'slot' | 'account_ready' | 'account_custom';
  sold_at?: string | null;
  is_banned?: boolean;
}

interface PublicMemberRow {
  family_id: string;
}

interface JoinRequestRow {
  id: string;
  family_id: string;
  name?: string;
  email?: string;
  note?: string | null;
  // New schema fields
  requester_name?: string;
  requester_email?: string;
  message?: string | null;
  status: JoinRequestStatus;
  billing_cycle?: 'monthly' | 'annual';
  product_type?: 'slot' | 'account_ready' | 'account_custom';
  created_at: string;
  // Join fields
  families?: {
    name: string;
    price_monthly: number;
    price_annual: number;
    price_sale: number;
    currency: string;
    product_type: 'slot' | 'account_ready' | 'account_custom';
  };
}

function parsePublicFamilyName(rawName: string | null): { familyName: string; serviceName?: string } {
  const normalized = (rawName || '').trim();
  if (!normalized) {
    return { familyName: 'Family Plan' };
  }

  const [familyName, ...serviceParts] = normalized.split(',');
  const trimmedFamilyName = familyName.trim() || normalized;
  const serviceName = serviceParts.join(',').trim();

  if (!serviceName) {
    return { familyName: trimmedFamilyName };
  }

  return {
    familyName: trimmedFamilyName,
    serviceName,
  };
}

export async function fetchPublicFamilies(): Promise<PublicFamily[]> {
  // Gunakan supabasePublic untuk memastikan request selalu anonim
  // dan tidak terganggu oleh session user yang mungkin invalid (401)
  const client = supabasePublic || supabase;
  if (!client) return [];

  const { data: rawFamilies, error: familiesError } = await client
    .from('families')
    .select('id,name,expiry_date,storage_used,price_monthly,price_annual,price_sale,currency,product_type,created_at,sold_at,is_banned');

  if (familiesError) throw familiesError;

  const { data: rawMembers, error: membersError } = await client
    .from('members')
    .select('family_id');

  if (membersError) throw membersError;

  // Fetch pending join_requests for account_ready families to detect reserved/booked accounts
  const { data: pendingRequests } = await client
    .from('join_requests')
    .select('family_id')
    .eq('status', 'pending')
    .not('family_id', 'is', null);

  const pendingFamilyIds = new Set(
    (pendingRequests || []).map((r: { family_id: string }) => r.family_id)
  );

  const members = (rawMembers || []) as PublicMemberRow[];
  const memberCountByFamily = members.reduce<Record<string, number>>((acc, member) => {
    acc[member.family_id] = (acc[member.family_id] || 0) + 1;
    return acc;
  }, {});

  const families = (rawFamilies || []) as PublicFamilyRow[];

  // Filter out banned accounts
  const validFamilies = families.filter(f => !f.is_banned);

  // No longer filter out sold ready accounts — show them with SOLD status
  return validFamilies.map((family) => {
    const { familyName, serviceName } = parsePublicFamilyName(family.name);
    const slotsUsed = memberCountByFamily[family.id] || 0;

    return {
      id: family.id,
      familyName,
      serviceName,
      expiryDate: family.expiry_date,
      storageUsed: Number(family.storage_used) || 0,
      slotsAvailable: Math.max(0, MAX_FAMILY_SLOTS - slotsUsed),
      priceMonthly: Number(family.price_monthly) || 0,
      priceAnnual: Number(family.price_annual) || 0,
      priceSale: Number(family.price_sale) || 0,
      currency: family.currency || 'IDR',
      productType: family.product_type || 'slot',
      createdAt: family.created_at,
      soldAt: family.sold_at || null,
      hasPendingOrder: pendingFamilyIds.has(family.id),
    };
  });
}

export function usePublicFamilies(): UsePublicFamiliesReturn {
  const [families, setFamilies] = useState<PublicFamily[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadPublicFamilies = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const publicFamilies = await fetchPublicFamilies();
      setFamilies(publicFamilies);
    } catch (err) {
      console.error('Error fetching public families:', err);
      setError((err as Error).message || 'Failed to load public families');
      setFamilies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPublicFamilies();
  }, [loadPublicFamilies]);

  return {
    families,
    loading,
    error,
    refetch: loadPublicFamilies,
  };
}

function mapJoinRequestRow(row: JoinRequestRow): JoinRequest {
  return {
    id: row.id,
    familyId: row.family_id,
    name: row.requester_name || row.name || 'Unknown',
    email: row.requester_email || row.email || 'No email',
    note: row.message || row.note || '',
    status: row.status,
    createdAt: row.created_at,
    // Enhanced fields
    familyName: row.families?.name || (row.product_type === 'account_custom' ? 'Premium Upgrade' : 'Unknown Family'),
    priceMonthly: row.families?.price_monthly || 0,
    priceAnnual: row.families?.price_annual || 0,
    priceSale: row.families?.price_sale || 0,
    currency: row.families?.currency || 'IDR',
    productType: row.product_type || row.families?.product_type || 'slot',
    billingCycle: row.billing_cycle || 'monthly',
  };
}

export async function createJoinRequest(input: JoinRequestInput): Promise<ActionResult> {
  if (!supabase) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    // Guard: block duplicate orders for Ready Account type (only 1 pending order allowed)
    if (input.productType === 'account_ready' && input.familyId) {
      const { data: existingPending } = await supabase
        .from('join_requests')
        .select('id')
        .eq('family_id', input.familyId)
        .eq('status', 'pending')
        .limit(1);

      if (existingPending && existingPending.length > 0) {
        return { success: false, error: 'This account has already been reserved by another buyer.' };
      }
    }

    const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    const { error } = await supabase
      .from('join_requests')
      .insert([
        {
          id,
          family_id: input.familyId || null,
          requester_name: input.name,
          requester_email: input.email,
          message: input.note || null,
          billing_cycle: input.billingCycle,
          product_type: input.productType || 'slot',
          
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('uniq_pending_join_request')) {
      return { 
        success: false, 
        error: 'dashboard.errors.pending_request' 
      };
    }
    return { success: false, error: message };
  }
}

export function useJoinRequests(): UseJoinRequestsReturn {
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchJoinRequests = useCallback(async (): Promise<void> => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Select ALL relevant columns to support hybrid schema
      const { data, error } = await supabase
        .from('join_requests')
        .select(`
          id,family_id,requester_name,requester_email,message,name,email,note,status,created_at,billing_cycle,product_type,
          families (
            name,
            price_monthly,
            price_annual,
            price_sale,
            currency,
            product_type
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = ((data || []) as any[]).map(mapJoinRequestRow);
      setJoinRequests(mapped);
    } catch (error) {
      console.error('Error fetching join requests:', error);
      setJoinRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJoinRequests();
  }, [fetchJoinRequests]);

  const updateStatus = useCallback(async (requestId: string, status: JoinRequestStatus): Promise<ActionResult> => {
    if (!supabase) {
      return { success: false, error: 'Supabase is not configured' };
    }

    try {
      // Update the request status
      const { error } = await supabase
        .from('join_requests')
        .update({ status })
        .eq('id', requestId);

      if (error) throw error;

      // Handle side effects on approval
      if (status === 'approved') {
        const request = joinRequests.find((r) => r.id === requestId);
        if (request) {
          switch (request.productType) {
            case 'slot': {
              // Sharing Account: Add buyer as member
              const { data: existingMembers } = await supabase
                .from('members')
                .select('id')
                .eq('family_id', request.familyId)
                .eq('email', request.email);

              if (!existingMembers || existingMembers.length === 0) {
                const memberId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
                const { error: memberError } = await supabase
                  .from('members')
                  .insert([{
                    id: memberId,
                    family_id: request.familyId,
                    name: request.name,
                    email: request.email,
                    added_at: new Date().toISOString(),
                  }]);
                if (memberError) throw memberError;
              }
              break;
            }
            case 'account_ready': {
              // Ready Account: Mark family as sold to buyer
              const { error: soldError } = await supabase
                .from('families')
                .update({
                  sold_to_name: request.name,
                  sold_to_email: request.email,
                  sold_at: new Date().toISOString(),
                })
                .eq('id', request.familyId);
              if (soldError) throw soldError;
              break;
            }
            case 'account_custom':
              // Upgrade: No side effect, just status update
              break;
          }
        }
      }

      setJoinRequests((prev) => prev.map((request) => (
        request.id === requestId ? { ...request, status } : request
      )));

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [joinRequests]);

  return {
    joinRequests,
    loading,
    refetch: fetchJoinRequests,
    updateStatus,
  };
}

export function useSupabaseData(): UseSupabaseDataReturn {
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch initial data & subscribe to changes
  useEffect(() => {
    if (!supabase) return;

    fetchFamilies();
    
    // CR-05: Run lazy migration ONCE on mount (not on every fetch)
    migratePasswords();

    // Realtime subscription (Optional for simple use)
    const debouncedFetch = debounce(fetchFamilies, 1000);
    const subscription = supabase
      .channel('public:families')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'families' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, debouncedFetch)
      .subscribe();

    return () => {
      supabase?.removeChannel(subscription);
    };
  }, []);

  /**
   * One-time migration to encrypt legacy plaintext passwords.
   * Runs only on mount to avoid performance penalty on every fetch.
   */
  async function migratePasswords() {
    if (!supabase) return;
    try {
      const { data: familiesData } = await supabase.from('families').select('id, owner_password');
      if (!familiesData) return;

      const key = await getEncryptionKey();
      if (!key) return;

      for (const family of familiesData) {
        if (family.owner_password && !isEncrypted(family.owner_password)) {
          try {
            const encrypted = await encryptPassword(family.owner_password, key);
            await supabase
              .from('families')
              .update({ owner_password: encrypted })
              .eq('id', family.id);
            console.log('Migrated password for family:', family.id);
          } catch (err) {
            console.warn('Failed to migrate password for family:', family.id, err);
          }
        }
      }
    } catch (error) {
      console.error('Error during password migration:', error);
    }
  }

  async function fetchFamilies(): Promise<void> {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // CR-06: Single query with JOIN instead of N+1
      const { data: familiesData, error } = await supabase
        .from('families')
        .select('*, members(*)');

      if (error) throw error;

      // Decrypt passwords and format data
      const key = await getEncryptionKey();
      const formattedData: Family[] = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (familiesData || []).map(async (family: any) => {
          const decryptedPassword = await decryptPassword(family.owner_password, key);

          return {
            ...family,
            ownerEmail: family.owner_email,
            ownerPassword: decryptedPassword,
            expiryDate: family.expiry_date,
            storageUsed: family.storage_used,
            createdAt: family.created_at,
            priceMonthly: family.price_monthly,
            priceAnnual: family.price_annual,
            priceSale: family.price_sale,
            currency: family.currency,
            productType: family.product_type || 'slot',
            isBanned: family.is_banned,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            members: (family.members || []).map((m: any) => ({
              ...m,
              addedAt: m.added_at,
            })),
          } as Family;
        })
      );

      setFamilies(formattedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  // --- Actions ---

  async function addFamily(family: FamilyInput): Promise<ActionResult> {
    const { id, name, ownerEmail, ownerPassword, expiryDate, storageUsed, notes, createdAt } = family;
    const previousFamilies = families;

    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { data: { user } } = await supabase.auth.getUser();
      const key = await getEncryptionKey();
      const encryptedPassword = await encryptPassword(ownerPassword, key);

      setFamilies((prev) => [...prev, family as unknown as Family]);

      const { error } = await supabase
        .from('families')
        .insert([{
          id,
          user_id: user?.id,
          name,
          owner_email: ownerEmail,
          owner_password: encryptedPassword,
          expiry_date: expiryDate,
          storage_used: Number(storageUsed) || 0,
          notes,
          created_at: createdAt,
          price_monthly: Number(family.priceMonthly) || 0,
          price_annual: Number(family.priceAnnual) || 0,
          price_sale: Number(family.priceSale) || 0,
          currency: family.currency || 'IDR',
          product_type: family.productType || 'slot',
          is_banned: Boolean(family.isBanned),
        }]);

      if (error) throw error;

      // Track locally created families for secure claiming later
      try {
        const existing = JSON.parse(localStorage.getItem('fm_guest_family_ids') || '[]');
        if (!existing.includes(id)) {
          existing.push(id);
          localStorage.setItem('fm_guest_family_ids', JSON.stringify(existing));
        }
      } catch (e) {
        console.warn('Failed to save guest family ID', e);
      }
      return { success: true };
    } catch (error) {
      console.error('Error creating family:', error);
      // Rollback optimistic update
      setFamilies(previousFamilies);
      return { success: false, error: (error as Error).message };
    }
  }

  async function updateFamily(updatedFamily: FamilyInput): Promise<ActionResult> {
    const { id, name, ownerEmail, ownerPassword, expiryDate, storageUsed, notes } = updatedFamily;
    const previousFamilies = families;
    try {
      const key = await getEncryptionKey();
      const encryptedPassword = await encryptPassword(ownerPassword, key);

      setFamilies((prev) => prev.map((f) => (f.id === id ? (updatedFamily as unknown as Family) : f)));
      
      if (!supabase) throw new Error('Supabase client not initialized');
      const { error } = await supabase
        .from('families')
        .update({
          name,
          owner_email: ownerEmail,
          owner_password: encryptedPassword,
          expiry_date: expiryDate,
          storage_used: Number(storageUsed) || 0,
          notes,
          price_monthly: Number(updatedFamily.priceMonthly) || 0,
          price_annual: Number(updatedFamily.priceAnnual) || 0,
          price_sale: Number(updatedFamily.priceSale) || 0,
          currency: updatedFamily.currency || 'IDR',
          product_type: updatedFamily.productType || 'slot',
          is_banned: Boolean(updatedFamily.isBanned),
        })
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error updating family:', error);
      setFamilies(previousFamilies); // Rollback
      return { success: false, error: (error as Error).message };
    }
  }

  async function deleteFamily(familyId: string): Promise<ActionResult> {
    const previousFamilies = families;
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      setFamilies((prev) => prev.filter((f) => f.id !== familyId));
      const { error } = await supabase.from('families').delete().eq('id', familyId);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting family:', error);
      setFamilies(previousFamilies); // Rollback
      return { success: false, error: (error as Error).message };
    }
  }

  async function addMember(familyId: string, member: Omit<Member, 'family_id'>): Promise<ActionResult> {
    const { id, name, email, addedAt } = member;
    const previousFamilies = families;
    try {
      setFamilies((prev) =>
        prev.map((f) => {
          if (f.id === familyId) {
            return { ...f, members: [...(f.members || []), member as Member] };
          }
          return f;
        })
      );
      if (!supabase) throw new Error('Supabase client not initialized');
      const { error } = await supabase
        .from('members')
        .insert([{ id, family_id: familyId, name, email, added_at: addedAt }]);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error adding member:', error);
      setFamilies(previousFamilies); // Rollback
      return { success: false, error: (error as Error).message };
    }
  }

  async function removeMember(familyId: string, memberId: string): Promise<ActionResult> {
    const previousFamilies = families;
    try {
      setFamilies((prev) =>
        prev.map((f) => {
          if (f.id === familyId) {
            return { ...f, members: (f.members || []).filter((m) => m.id !== memberId) };
          }
          return f;
        })
      );
      if (!supabase) throw new Error('Supabase client not initialized');
      const { error } = await supabase.from('members').delete().eq('id', memberId);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error removing member:', error);
      setFamilies(previousFamilies); // Rollback
      return { success: false, error: (error as Error).message };
    }
  }

  async function cancelSale(familyId: string): Promise<ActionResult> {
    const previousFamilies = families;
    try {
      if (!supabase) throw new Error('Supabase client not initialized');

      // Optimistic update: clear sold fields locally
      setFamilies((prev) =>
        prev.map((f) =>
          f.id === familyId
            ? { ...f, sold_to_name: null, sold_to_email: null, sold_at: null }
            : f
        )
      );

      // Clear sold fields on family
      const { error } = await supabase
        .from('families')
        .update({
          sold_to_name: null,
          sold_to_email: null,
          sold_at: null,
        })
        .eq('id', familyId);

      if (error) throw error;

      // Also mark the related approved join_request as 'cancelled'
      // Find the most recent approved request for this family
      const { data: approvedRequests } = await supabase
        .from('join_requests')
        .select('id')
        .eq('family_id', familyId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1);

      if (approvedRequests && approvedRequests.length > 0) {
        const { error: cancelError } = await supabase
          .from('join_requests')
          .update({ status: 'cancelled' })
          .eq('id', approvedRequests[0].id);
        if (cancelError) throw cancelError;
      }

      return { success: true };
    } catch (error) {
      console.error('Error cancelling sale:', error);
      setFamilies(previousFamilies); // Rollback
      return { success: false, error: (error as Error).message };
    }
  }

  return {
    families,
    loading,
    addFamily,
    updateFamily,
    deleteFamily,
    addMember,
    removeMember,
    cancelSale,
    refetch: fetchFamilies,
  };
}

export async function updateSetting(key: string, value: any) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) {
    console.error(`Error updating setting ${key}:`, error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export function useAppSetting(key: string, defaultValue: any) {
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  const fetchSetting = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', key)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error(`Error fetching setting ${key}:`, error);
      }

      if (data) {
        setValue(data.value);
      }
    } catch (err) {
      console.error(`Error in fetchSetting ${key}:`, err);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    let mounted = true;

    fetchSetting();

    if (supabase) {
      // Use unique channel name per key to avoid conflicts
      const channelName = `setting_${key}_${Math.random().toString(36).slice(2, 8)}`;
      const subscription = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'settings', filter: `key=eq.${key}` },
          (payload: any) => {
            if (mounted && payload.new?.value !== undefined) {
              setValue(payload.new.value);
            }
          }
        )
        .subscribe();

      return () => {
        mounted = false;
        supabase.removeChannel(subscription);
      };
    } else {
      setLoading(false);
    }
  }, [key, fetchSetting]);

  return { value, loading, setValue, refetch: fetchSetting };
}
