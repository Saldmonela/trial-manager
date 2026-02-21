import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';
import { cn } from './utils';
import { ErrorBoundary } from './components/ErrorBoundary';

// Pages
import DashboardPublic from './components/DashboardPublic';
import DashboardAdmin from './components/DashboardAdmin';
import LandingPage from './components/LandingPage';
import LoginPage from './components/auth/LoginPage';
import AdminRoute from './components/auth/AdminRoute';

function App() {
  const { session, user, isAdmin, isLoading, signInWithGoogle, signOut } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
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
          session
            ? (isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />)
            : <LandingPage onGoToLogin={() => window.location.href = '/dashboard'} />
        } />
        <Route path="/login" element={
          session
            ? (isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />)
            : <LoginPage onLogin={signInWithGoogle} />
        } />
        <Route path="/dashboard" element={<DashboardPublic session={session} onLogout={signOut} />} />
        <Route path="/admin" element={
          <AdminRoute>
            <DashboardAdmin key={user?.id} onLogout={signOut} />
          </AdminRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
