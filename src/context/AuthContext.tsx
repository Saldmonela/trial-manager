/// <reference types="vite/client" />
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { AuthContextValue, UserProfile, UserRole } from '../types';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));

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

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/admin' },
    });
    if (error) throw new Error('Login Google tidak dapat dimulai. Coba lagi.');
  }, []);

  // Login email/password untuk testing lokal. UI-nya sengaja hanya dirender saat
  // `import.meta.env.DEV` (lihat LoginPage) supaya halaman login produksi tetap
  // Google-only. Tidak ada signUp di sini — akun dibuat manual di dashboard Supabase.
  const signInWithPassword = useCallback(async (email: string, password: string) => {
    // Gerbang ditegakkan di sini, bukan cuma di UI: kalau form-nya suatu saat dirender
    // tanpa syarat, build produksi tetap menolak. Hapus baris ini kalau memang mau aktif.
    if (!import.meta.env.DEV) return { success: false, error: 'Login email hanya tersedia di dev build' };
    if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true };
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
    if (!supabase) {
      return;
    }

    let mounted = true;
    let generation = 0;
    let currentUserId: string | null = null;

    // Safety timeout — absolute last resort
    const timeout = setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        if (!mounted) return;
        const current = ++generation;

        // CRITICAL: Defer processing with setTimeout(0).
        // On page refresh, Supabase fires SIGNED_IN from inside its internal
        // _recoverAndRefresh() method. Any async DB query made synchronously
        // in this callback will deadlock the SDK. setTimeout(0) escapes the
        // internal callback chain, allowing queries to execute normally.
        setTimeout(async () => {
          if (!mounted || current !== generation) return;

          const nextUserId = s?.user?.id ?? null;
          if (nextUserId !== currentUserId) {
            currentUserId = nextUserId; setProfile(null); setIsLoading(Boolean(nextUserId));
          }
          setSession(s);

          if (s?.user) {
            const p = await fetchProfile(s.user.id);

            if (mounted && current === generation) {
              setProfile(p);
            }

          } else {
            if (mounted) {
              setProfile(null);
            }
          }

          // Token refresh keeps the current profile while revalidating it.
          if (mounted && current === generation) {
            setIsLoading(false);
            clearTimeout(timeout);
          }
        }, 0);
      }
    );

    return () => {
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
    signInWithPassword,
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
