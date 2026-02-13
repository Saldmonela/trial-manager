import React, { useMemo } from 'react';
import { Shield, ShieldCheck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils';
import { isEncrypted } from '../../lib/crypto';

/**
 * A dismissible banner that shows migration progress.
 * Auto-hides when all passwords are encrypted.
 */
export default function MigrationBanner({ families }) {
  const { theme } = useTheme();

  const { total, encrypted, plaintext } = useMemo(() => {
    const withPassword = (families || []).filter(f => f.owner_password);
    const enc = withPassword.filter(f => isEncrypted(f.owner_password));
    return {
      total: withPassword.length,
      encrypted: enc.length,
      plaintext: withPassword.length - enc.length,
    };
  }, [families]);

  // Don't render if there are no families or all are already encrypted
  if (total === 0 || plaintext === 0) return null;

  const progress = total > 0 ? Math.round((encrypted / total) * 100) : 0;

  return (
    <div className={cn(
      "border-b px-4 py-3 flex items-center gap-3",
      theme === 'light'
        ? "bg-blue-50 border-blue-200"
        : "bg-blue-900/10 border-blue-900/30"
    )}>
      <div className={cn(
        "p-2 rounded-full shrink-0",
        theme === 'light'
          ? "bg-blue-100 text-blue-600"
          : "bg-blue-900/30 text-blue-400"
      )}>
        {plaintext === 0 ? (
          <ShieldCheck className="w-4 h-4" />
        ) : (
          <Shield className="w-4 h-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs font-semibold",
          theme === 'light' ? "text-blue-900" : "text-blue-300"
        )}>
          🔒 Password Encryption Migration
        </p>
        <p className={cn(
          "text-xs mt-0.5",
          theme === 'light' ? "text-blue-700" : "text-blue-400/80"
        )}>
          {plaintext} of {total} password{total !== 1 ? 's' : ''} still unencrypted.
          They will be encrypted automatically on next data load.
        </p>

        {/* Progress bar */}
        <div className={cn(
          "mt-1.5 h-1 rounded-full overflow-hidden",
          theme === 'light' ? "bg-blue-200" : "bg-blue-900/40"
        )}>
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
