import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils';

/**
 * Route guard that only allows admin users.
 * - No session → redirect to /login
 * - Session but role !== 'admin' → "no access" screen with sign-out (there is no public page)
 * - Admin → render children
 */
export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, isAdmin, isLoading, signOut } = useAuth();
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
    return (
      <div className={cn(
        "min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center",
        theme === 'light' ? "bg-stone-50 text-stone-900" : "bg-stone-950 text-stone-50"
      )}>
        <h1 className="font-serif text-2xl font-bold">Akun ini tidak punya akses</h1>
        <p className={cn("max-w-sm text-sm", theme === 'light' ? "text-stone-600" : "text-stone-400")}>
          {session.user?.email ? `${session.user.email} bukan akun admin.` : 'Akun ini bukan akun admin.'} Keluar, lalu masuk dengan akun admin.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className={cn(
            "px-6 py-3 text-xs font-bold uppercase tracking-widest border transition-colors",
            theme === 'light' ? "border-stone-900 hover:bg-stone-900 hover:text-stone-50" : "border-stone-50 hover:bg-stone-50 hover:text-stone-900"
          )}
        >
          Keluar
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
