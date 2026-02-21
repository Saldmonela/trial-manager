import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils';

/**
 * Route guard that only allows admin users.
 * - No session → redirect to /login
 * - Session but role !== 'admin' → redirect to /dashboard
 * - Admin → render children
 */
export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, isAdmin, isLoading } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center font-serif italic text-center",
        theme === 'light' ? "bg-stone-50 text-stone-900" : "bg-stone-950 text-stone-50"
      )}>
        <p className="animate-pulse">Verifying access...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
