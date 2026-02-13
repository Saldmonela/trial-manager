import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { encryptPassword, decryptPassword, isEncrypted } from '../lib/crypto';
import { debounce } from '../utils/performance';
import type { Family, FamilyInput, Member, ActionResult, UseSupabaseDataReturn } from '../types';

/**
 * Gets the current user's stable ID for encryption key derivation.
 * Uses user.id (UUID, never changes) instead of access_token (JWT, rotates every ~1hr)
 * to ensure passwords remain decryptable across sessions.
 */
async function getEncryptionKey(): Promise<string> {
  const { data: { user } } = await supabase!.auth.getUser();
  return user?.id || '';
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
