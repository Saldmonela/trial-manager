import React, { useState } from 'react';
import { HardDrive, Loader2 } from 'lucide-react';
import { cn } from '../../utils';

/**
 * Tombol CTA untuk menghubungkan akun Google Drive baru.
 * onConnect() melakukan full-page redirect ke Google saat sukses, jadi loading
 * hanya direset bila gagal.
 */
export default function ConnectAccountButton({ theme, onConnect, label = 'Connect Google Drive', hideTextMobile = true }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const res = await onConnect?.();
    if (!res?.success) setLoading(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'flex items-center justify-center gap-2 font-bold uppercase tracking-widest transition-all shadow-sm whitespace-nowrap disabled:opacity-60 shrink-0',
        hideTextMobile
          ? 'rounded-full md:rounded-none w-10 h-10 md:w-auto md:h-auto md:px-5 md:py-3 text-sm min-h-[40px] md:min-h-[44px]'
          : 'px-5 py-3 text-sm min-h-[44px]',
        theme === 'light'
          ? 'bg-stone-900 text-stone-50 hover:bg-stone-800'
          : 'bg-stone-50 text-stone-900 hover:bg-stone-200',
      )}
      title={label}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
      {hideTextMobile ? (
        <span className="hidden md:inline">{label}</span>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}
