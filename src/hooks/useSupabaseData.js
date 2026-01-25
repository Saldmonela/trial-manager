import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useSupabaseData() {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial data & subscribe to changes
  useEffect(() => {
    if (!supabase) return;
    
    fetchFamilies();

    // Realtime subscription (Optional for simple use)
    const subscription = supabase
      .channel('public:families')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'families' }, fetchFamilies)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, fetchFamilies) 
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  async function fetchFamilies() {
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

       // Merge members into families for frontend compatibility
       const mergedData = (familiesData || []).map(family => ({
         ...family,
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
    
    const { data: { user } } = await supabase.auth.getUser();

    setFamilies(prev => [...prev, family]);

    const { error } = await supabase
      .from('families')
      .insert([{
        id,
        user_id: user?.id,
        name,
        owner_email: ownerEmail,
        owner_password: ownerPassword,
        expiry_date: expiryDate,
        storage_used: Number(storageUsed) || 0,
        notes,
        created_at: createdAt
      }]);

    if (error) {
       console.error("Error creating family:", error);
       fetchFamilies(); 
    }
  }

  async function updateFamily(updatedFamily) {
     const { id, name, ownerEmail, ownerPassword, expiryDate, storageUsed, notes } = updatedFamily;
     setFamilies(prev => prev.map(f => f.id === id ? updatedFamily : f));
     const { error } = await supabase
       .from('families')
       .update({
         name,
         owner_email: ownerEmail,
         owner_password: ownerPassword,
         expiry_date: expiryDate,
         storage_used: Number(storageUsed) || 0,
         notes
       })
       .eq('id', id);
      if (error) { fetchFamilies(); }
  }

  async function deleteFamily(familyId) {
    setFamilies(prev => prev.filter(f => f.id !== familyId));
    const { error } = await supabase.from('families').delete().eq('id', familyId);
    if (error) { fetchFamilies(); }
  }

  async function addMember(familyId, member) {
    const { id, name, email, addedAt } = member;
    setFamilies(prev => prev.map(f => {
      if (f.id === familyId) {
         return { ...f, members: [...(f.members || []), member] };
      }
      return f;
    }));
    const { error } = await supabase
      .from('members')
      .insert([{ id, family_id: familyId, name, email, added_at: addedAt }]);
    if (error) { fetchFamilies(); }
  }

  async function removeMember(familyId, memberId) {
     setFamilies(prev => prev.map(f => {
      if (f.id === familyId) {
         return { ...f, members: f.members.filter(m => m.id !== memberId) };
      }
      return f;
    }));
    const { error } = await supabase.from('members').delete().eq('id', memberId);
    if (error) { fetchFamilies(); }
  }


  return {
    families,
    loading,
    addFamily,
    updateFamily,
    deleteFamily,
    addMember,
    removeMember,
    refetch: fetchFamilies
  };
}
