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
  const { data: { user } } = await supabase!.auth.getUser();
  return user?.id || '';
}

interface PublicFamilyRow {
  id: string;
  name: string | null;
  expiry_date: string | null;
  storage_used: number | null;
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
  created_at: string;
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
    .select('id,name,expiry_date,storage_used');

  if (familiesError) throw familiesError;

  const { data: rawMembers, error: membersError } = await client
    .from('members')
    .select('family_id');

  if (membersError) throw membersError;

  const members = (rawMembers || []) as PublicMemberRow[];
  const memberCountByFamily = members.reduce<Record<string, number>>((acc, member) => {
    acc[member.family_id] = (acc[member.family_id] || 0) + 1;
    return acc;
  }, {});

  const families = (rawFamilies || []) as PublicFamilyRow[];

  return families.map((family) => {
    const { familyName, serviceName } = parsePublicFamilyName(family.name);
    const slotsUsed = memberCountByFamily[family.id] || 0;

    return {
      id: family.id,
      familyName,
      serviceName,
      expiryDate: family.expiry_date,
      storageUsed: Number(family.storage_used) || 0,
      slotsAvailable: Math.max(0, MAX_FAMILY_SLOTS - slotsUsed),
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
  };
}

export async function createJoinRequest(input: JoinRequestInput): Promise<ActionResult> {
  if (!supabase) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    // Use the schema from screenshot: requester_name, requester_email, message
    // Also include name/email/note for redundancy if needed, but primary fields are key.
    const { error } = await supabase
      .from('join_requests')
      .insert([
        {
          id,
          family_id: input.familyId,
          // Map to correct columns based on user screenshot
          requester_name: input.name,
          requester_email: input.email,
          message: input.note || null,
          // Keep old columns just in case, or for migration safety
          name: input.name,
          email: input.email,
          note: input.note || null,
          
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
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
        .select('id,family_id,requester_name,requester_email,message,name,email,note,status,created_at')
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
      const { error } = await supabase
        .from('join_requests')
        .update({ status })
        .eq('id', requestId);

      if (error) throw error;

      setJoinRequests((prev) => prev.map((request) => (
        request.id === requestId ? { ...request, status } : request
      )));

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, []);

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

    // Realtime subscription (Optional for simple use)
    const debouncedFetch = debounce(fetchFamilies, 1000);
    const subscription = supabase
      .channel('public:families')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'families' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, debouncedFetch)
      .subscribe();

    return () => {
      supabase!.removeChannel(subscription);
    };
  }, []);

  async function fetchFamilies(): Promise<void> {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      const { data: familiesData, error: familiesError } = await supabase
        .from('families')
        .select('*');

      if (familiesError) throw familiesError;

      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*');

      if (membersError) throw membersError;

      // Decrypt passwords and merge members into families
      const key = await getEncryptionKey();
      const mergedData: Family[] = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (familiesData || []).map(async (family: any) => {
          const decryptedPassword = await decryptPassword(family.owner_password, key);

          // LAZY MIGRATION: If the stored value is plaintext (not encrypted),
          // encrypt it now and write it back to the database silently.
          if (family.owner_password && !isEncrypted(family.owner_password)) {
            try {
              const encrypted = await encryptPassword(family.owner_password, key);
              await supabase!
                .from('families')
                .update({ owner_password: encrypted })
                .eq('id', family.id);
            } catch (migrationErr) {
              console.warn('Lazy migration failed for family:', family.id, migrationErr);
            }
          }

          return {
            ...family,
            ownerEmail: family.owner_email,
            ownerPassword: decryptedPassword,
            expiryDate: family.expiry_date,
            storageUsed: family.storage_used,
            createdAt: family.created_at,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            members: (membersData || []).filter((m: any) => m.family_id === family.id).map((m: any) => ({
              ...m,
              addedAt: m.added_at,
            })),
          } as Family;
        })
      );

      setFamilies(mergedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  // --- Actions ---

  async function addFamily(family: FamilyInput): Promise<ActionResult> {
    const { id, name, ownerEmail, ownerPassword, expiryDate, storageUsed, notes, createdAt } = family;

    try {
      const { data: { user } } = await supabase!.auth.getUser();
      const key = await getEncryptionKey();
      const encryptedPassword = await encryptPassword(ownerPassword, key);

      setFamilies((prev) => [...prev, family as unknown as Family]);

      const { error } = await supabase!
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
        }]);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error creating family:', error);
      fetchFamilies();
      return { success: false, error: (error as Error).message };
    }
  }

  async function updateFamily(updatedFamily: FamilyInput): Promise<ActionResult> {
    const { id, name, ownerEmail, ownerPassword, expiryDate, storageUsed, notes } = updatedFamily;
    try {
      const key = await getEncryptionKey();
      const encryptedPassword = await encryptPassword(ownerPassword, key);

      setFamilies((prev) => prev.map((f) => (f.id === id ? (updatedFamily as unknown as Family) : f)));
      const { error } = await supabase!
        .from('families')
        .update({
          name,
          owner_email: ownerEmail,
          owner_password: encryptedPassword,
          expiry_date: expiryDate,
          storage_used: Number(storageUsed) || 0,
          notes,
        })
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error updating family:', error);
      fetchFamilies();
      return { success: false, error: (error as Error).message };
    }
  }

  async function deleteFamily(familyId: string): Promise<ActionResult> {
    try {
      setFamilies((prev) => prev.filter((f) => f.id !== familyId));
      const { error } = await supabase!.from('families').delete().eq('id', familyId);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting family:', error);
      fetchFamilies();
      return { success: false, error: (error as Error).message };
    }
  }

  async function addMember(familyId: string, member: Omit<Member, 'family_id'>): Promise<ActionResult> {
    const { id, name, email, addedAt } = member;
    try {
      setFamilies((prev) =>
        prev.map((f) => {
          if (f.id === familyId) {
            return { ...f, members: [...(f.members || []), member as Member] };
          }
          return f;
        })
      );
      const { error } = await supabase!
        .from('members')
        .insert([{ id, family_id: familyId, name, email, added_at: addedAt }]);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error adding member:', error);
      fetchFamilies();
      return { success: false, error: (error as Error).message };
    }
  }

  async function removeMember(familyId: string, memberId: string): Promise<ActionResult> {
    try {
      setFamilies((prev) =>
        prev.map((f) => {
          if (f.id === familyId) {
            return { ...f, members: f.members.filter((m) => m.id !== memberId) };
          }
          return f;
        })
      );
      const { error } = await supabase!.from('members').delete().eq('id', memberId);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error removing member:', error);
      fetchFamilies();
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
    refetch: fetchFamilies,
  };
}
