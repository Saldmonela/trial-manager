import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useSupabaseData() {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial data & subscribe to changes
  useEffect(() => {
    fetchFamilies();

    // Realtime subscription (Optional for simple use)
    const subscription = supabase
      .channel('public:families')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'families' }, fetchFamilies)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, fetchFamilies) // naive refresh
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  async function fetchFamilies() {
    if (!supabase) {
      console.warn('Supabase is not configured yet.');
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

       // Merge members into families for frontend compatibility
       const mergedData = (familiesData || []).map(family => ({
         ...family,
         // Map snake_case to camelCase for existing frontend
         ownerEmail: family.owner_email,
         ownerPassword: family.owner_password,
         expiryDate: family.expiry_date,
         storageUsed: family.storage_used,
         createdAt: family.created_at,
         members: (membersData || []).filter(m => m.family_id === family.id).map(m => ({
            ...m,
            addedAt: m.added_at
         }))
       }));

       setFamilies(mergedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  // --- Actions ---

  async function addFamily(family) {
    const { id, name, ownerEmail, ownerPassword, expiryDate, storageUsed, notes, createdAt } = family;
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Optimistic Update
    setFamilies(prev => [...prev, family]);

    const { error } = await supabase
      .from('families')
      .insert([{
        id,
        user_id: user?.id, // Explicitly link to user
        name,
        owner_email: ownerEmail,
        owner_password: ownerPassword,
        expiry_date: expiryDate,
        storage_used: storageUsed,
        notes,
        created_at: createdAt
      }]);

    if (error) {
       console.error("Error creating family:", error);
       fetchFamilies(); // Revert on error
    }
  }

  async function updateFamily(updatedFamily) {
     const { id, name, ownerEmail, ownerPassword, expiryDate, storageUsed, notes } = updatedFamily;
     
     // Optimistic Update
     setFamilies(prev => prev.map(f => f.id === id ? updatedFamily : f));

     const { error } = await supabase
       .from('families')
       .update({
         name,
         owner_email: ownerEmail,
         owner_password: ownerPassword,
         expiry_date: expiryDate,
         storage_used: storageUsed,
         notes
       })
       .eq('id', id);

      if (error) {
        console.error("Error updating family:", error);
        fetchFamilies();
      }
  }

  async function deleteFamily(familyId) {
    // Optimistic Update
    setFamilies(prev => prev.filter(f => f.id !== familyId));

    const { error } = await supabase.from('families').delete().eq('id', familyId);
     if (error) {
        console.error("Error deleting family:", error);
        fetchFamilies();
      }
  }

  async function addMember(familyId, member) {
    const { id, name, email, addedAt } = member;

    // Optimistic Update (Complex, maybe skip or do naive)
    // Naive local update for responsiveness
    setFamilies(prev => prev.map(f => {
      if (f.id === familyId) {
         return { ...f, members: [...(f.members || []), member] };
      }
      return f;
    }));

    const { error } = await supabase
      .from('members')
      .insert([{
        id,
        family_id: familyId,
        name,
        email,
        added_at: addedAt
      }]);
    
    if (error) {
       console.error("Error adding member:", error);
       fetchFamilies();
    }
  }

  async function removeMember(familyId, memberId) {
     setFamilies(prev => prev.map(f => {
      if (f.id === familyId) {
         return { ...f, members: f.members.filter(m => m.id !== memberId) };
      }
      return f;
    }));

    const { error } = await supabase.from('members').delete().eq('id', memberId);
    if (error) {
       console.error("Error removing member:", error);
       fetchFamilies();
    }
  }

  // --- Auth ---
  async function signInWithGoogle() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
    } catch (error) {
       console.error("Error signing in:", error);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Error signing out:", error);
    setFamilies([]); // Clear data on sign out
  }

  // --- Auto Claim Data ---
  async function claimDataForUser(userId) {
     // 1. Check if there are orphaned families (user_id is NULL)
     // In a real app, we might want to be more careful, but for this migration tool
     // we assume ALL local/anonymous data belongs to the first person who claims it.
     
     const { count } = await supabase
       .from('families')
       .select('*', { count: 'exact', head: true })
       .is('user_id', null);

     if (count > 0) {
       console.log(`Found ${count} orphaned families. Claiming for user ${userId}...`);
       
       const { error } = await supabase
         .from('families')
         .update({ user_id: userId })
         .is('user_id', null);

       if (error) {
         console.error("Error claiming data:", error);
       } else {
         console.log("Data successfully claimed!");
         fetchFamilies(); // Refresh data to show ownership
       }
     }
  }
  
  // Listen for Auth Changes
  useEffect(() => {
    if (!supabase) return;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
         console.log("User signed in:", session.user.id);
         await claimDataForUser(session.user.id);
         fetchFamilies();
      } else if (event === 'SIGNED_OUT') {
         setFamilies([]);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);


  return {
    families,
    loading,
    addFamily,
    updateFamily,
    deleteFamily,
    addMember,
    removeMember,
    refetch: fetchFamilies,
    signInWithGoogle,
    signOut
  };
}
