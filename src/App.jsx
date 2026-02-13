import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useTheme } from './context/ThemeContext';
import { cn } from './utils';
import { supabase } from './supabaseClient';
import { ErrorBoundary } from './components/ErrorBoundary';

// Pages
import Dashboard from './components/Dashboard';
import LandingPage from './components/LandingPage';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';

function App() {
  const [session, setSession] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const { theme } = useTheme();
  const navigate = useNavigate();

  const signInWithGoogle = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard' }
    });
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    navigate('/');
  };

  const claimData = async (userId) => {
    if (!supabase) return;
    const { count } = await supabase.from('families').select('*', { count: 'exact', head: true }).is('user_id', null);
    if (count > 0) {
      await supabase.from('families').update({ user_id: userId }).is('user_id', null);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setIsInitializing(false);
      return;
    }

    const timeout = setTimeout(() => setIsInitializing(false), 3000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializing(false);
      clearTimeout(timeout);
    }).catch(() => {
      setIsInitializing(false);
      clearTimeout(timeout);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setIsInitializing(false);
      if (event === 'SIGNED_IN' && session?.user) {
        claimData(session.user.id);
        navigate('/dashboard');
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  if (isInitializing) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center font-serif italic text-center",
        theme === 'light' ? "bg-stone-50 text-stone-900" : "bg-stone-950 text-stone-50"
      )}>
        <p className="animate-pulse">Establishing secure connection...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={
          session ? <Navigate to="/dashboard" replace /> : <LandingPage onGoToLogin={() => navigate('/login')} />
        } />
        <Route path="/login" element={
          session ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={signInWithGoogle} />
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute session={session}>
            <Dashboard key={session?.user?.id} onLogout={signOut} />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
