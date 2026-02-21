import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabasePublic } from '../supabaseClient';
import type { AuthContextValue, UserProfile, UserRole } from '../types';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const user = session?.user ?? null;
  const role: UserRole = profile?.role ?? 'public';
  const isAdmin = role === 'admin';

  /**
   * Fetch profile (role) from Supabase profiles table.
   * Must use the authenticated supabase client because the profiles table
   * has RLS that requires auth. This is safe because all callers defer
   * this function via setTimeout(0), allowing the SDK to finish token
   * refresh before this query runs.
   */
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('[AuthContext] Profile fetch failed:', error.message);
        return null;
      }

      return data as UserProfile;
    } catch (err) {
      console.warn('[AuthContext] Profile fetch exception:', err);
      return null;
    }
  }, []);

  /** Claim orphaned guest data after login */
  const claimData = useCallback(async (userId: string) => {
    if (!supabase) return;
    try {
      const guestFamilyIds = JSON.parse(localStorage.getItem('fm_guest_family_ids') || '[]');
      if (guestFamilyIds.length === 0) return;

      const { error } = await supabase
        .from('families')
        .update({ user_id: userId })
        .in('id', guestFamilyIds)
        .is('user_id', null);

      if (!error) {
        localStorage.removeItem('fm_guest_family_ids');
      }
    } catch (e) {
      console.error('Error claiming data:', e);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/admin' },
    });
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[AuthContext] Sign out error:', e);
    }
    setSession(null);
    setProfile(null);
    window.location.href = '/';
  }, []);

  useEffect(() => {
    console.log('[AuthContext] useEffect mount. supabase:', !!supabase);
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;
    let initialLoadComplete = false;

    // Safety timeout — absolute last resort
    const timeout = setTimeout(() => {
      console.log('[AuthContext] timeout hit! forcing isLoading = false');
      if (mounted) setIsLoading(false);
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, s) => {
        if (!mounted) return;
        console.log('[AuthContext] auth event:', event, 'user:', s?.user?.email);

        // CRITICAL: Defer processing with setTimeout(0).
        // On page refresh, Supabase fires SIGNED_IN from inside its internal
        // _recoverAndRefresh() method. Any async DB query made synchronously
        // in this callback will deadlock the SDK. setTimeout(0) escapes the
        // internal callback chain, allowing queries to execute normally.
        setTimeout(async () => {
          if (!mounted) return;

          setSession(s);

          if (s?.user) {
            console.log('[AuthContext] fetching profile for:', s.user.id);
            const p = await fetchProfile(s.user.id);
            console.log('[AuthContext] profile result:', p);

            if (mounted) {
              setProfile(p);
            }

            if (event === 'SIGNED_IN') {
              console.log('[AuthContext] SIGNED_IN — claiming guest data');
              await claimData(s.user.id);
            }
          } else {
            console.log('[AuthContext] no user — clearing profile');
            if (mounted) {
              setProfile(null);
            }
          }

          // Unlock UI after the FIRST event is fully processed
          if (!initialLoadComplete && mounted) {
            initialLoadComplete = true;
            console.log('[AuthContext] ✅ first event done — isLoading = false');
            setIsLoading(false);
            clearTimeout(timeout);
          }
        }, 0);
      }
    );

    return () => {
      console.log('[AuthContext] unmounting');
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value: AuthContextValue = {
    session,
    user,
    profile,
    role,
    isAdmin,
    isLoading,
    signInWithGoogle,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
