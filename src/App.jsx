import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';
import { cn } from './utils';
import { ErrorBoundary } from './components/ErrorBoundary';

// Pages
import DashboardAdmin from './components/DashboardAdmin';
import LoginPage from './components/auth/LoginPage';
import AdminRoute from './components/auth/AdminRoute';
import StoragePage from './components/storage/StoragePage';

function App() {
  const { session, user, isLoading, signInWithGoogle, signInWithPassword, signOut } = useAuth();
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
        {/* Alat internal: tidak ada halaman publik. AdminRoute yang memutuskan login / tanpa akses. */}
        <Route path="/login" element={
          session
            ? <Navigate to="/admin" replace />
            : <LoginPage onLogin={signInWithGoogle} onLoginWithPassword={signInWithPassword} />
        } />
        <Route path="/admin" element={
          <AdminRoute>
            <DashboardAdmin key={user?.id} onLogout={signOut} />
          </AdminRoute>
        } />
        <Route path="/storage" element={
          <AdminRoute>
            <StoragePage />
          </AdminRoute>
        } />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
