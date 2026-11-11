import { useRef, useState } from 'react';
import type { ActionResult } from '../types';
export function useAsyncForm() {
  const active = useRef(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const run = async (action: () => Promise<ActionResult>): Promise<boolean> => {
    if (active.current) return false;
    active.current = true; setBusy(true); setError('');
    try {
      const result = await action();
      if (result?.success !== true) { setError(result?.error || 'Penyimpanan gagal. Coba lagi.'); return false; }
      return true;
    } catch { setError('Koneksi gagal. Input Anda tetap tersimpan di form.'); return false; }
    finally { active.current = false; setBusy(false); }
  };
  return { busy, error, run };
}
