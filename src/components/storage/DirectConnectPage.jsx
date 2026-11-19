import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  Loader2,
  Moon,
  ShieldCheck,
  Sun,
  AlertTriangle,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { beginDriveConnection, completeDriveConnection } from '../../hooks/useConnectedAccounts';
import { cn, formatBytes } from '../../utils';

/**
 * Halaman publik /connect untuk menghubungkan Google Drive langsung tanpa harus
 * login akun Google pribadi (admin) di browser/profile tersebut.
 * Dilindungi PIN rahasia server-side (`DRIVE_CONNECT_PIN`), atau otomatis bypass PIN
 * bila browser ini memang sudah login sebagai admin.
 */
export default function DirectConnectPage() {
  const { theme, toggleTheme } = useTheme();
  const { isAdmin } = useAuth();
  const isLight = theme === 'light';

  const [passcode, setPasscode] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loginHint, setLoginHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState(() => {
    const hash = window.location.hash;
    return hash.includes('drive_state=') || hash.includes('drive_code=') || hash.includes('drive_error=');
  });
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(null);

  useEffect(() => {
    let active = true;
    const hash = window.location.hash;
    if (!hash.includes('drive_state=') && !hash.includes('drive_code=') && !hash.includes('drive_error=')) {
      setCompleting(false);
      return undefined;
    }

    setCompleting(true);
    void (async () => {
      const result = await completeDriveConnection();
      if (!active) return;
      setCompleting(false);
      if (!result) return;
      if (result.success) {
        setConnected(result.data ?? {});
        setError('');
      } else {
        setError(result.error || 'Koneksi Google Drive gagal diselesaikan.');
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isAdmin && !passcode.trim()) {
      setError('Masukkan PIN koneksi terlebih dahulu.');
      return;
    }

    setBusy(true);
    try {
      const result = await beginDriveConnection(
        '/connect',
        loginHint.trim(),
        '',
        isAdmin ? '' : passcode.trim(),
      );
      if (!result.success) {
        setError(result.error || 'Tidak bisa memulai koneksi Google Drive.');
        setBusy(false);
      }
    } catch {
      setError('Terjadi kesalahan saat memulai koneksi. Coba lagi.');
      setBusy(false);
    }
  };

  const handleConnectAnother = () => {
    setConnected(null);
    setError('');
    setLoginHint('');
  };

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col items-center justify-center transition-colors duration-500 font-sans selection:bg-gold-500/30 px-4 py-10',
        isLight ? 'bg-stone-50 text-stone-900' : 'bg-stone-950 text-stone-50',
      )}
    >
      <div className="flex absolute top-6 right-6">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className={cn(
            'p-2 rounded-full transition-colors',
            isLight ? 'hover:bg-stone-200 text-stone-600' : 'hover:bg-stone-800 text-stone-400',
          )}
        >
          {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
      </div>

      <div className="w-full max-w-md space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center gap-3"
        >
          <div
            className={cn(
              'w-14 h-14 flex items-center justify-center rounded-2xl shadow-xl',
              isLight ? 'bg-stone-900' : 'bg-stone-800',
            )}
          >
            <HardDrive className="w-7 h-7" color="#C6A87C" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">
            Connect Google Drive
          </h1>
          <p
            className={cn(
              'text-xs uppercase tracking-widest',
              isLight ? 'text-stone-500' : 'text-stone-400',
            )}
          >
            Koneksi Langsung Tanpa Login Admin
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className={cn(
            'p-6 sm:p-8 border shadow-xl rounded-none space-y-6',
            isLight ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-800',
          )}
        >
          {completing ? (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
              <p className="font-serif text-lg font-bold">Menyelesaikan koneksi...</p>
              <p className={cn('text-xs', isLight ? 'text-stone-500' : 'text-stone-400')}>
                Mengambil kuota Google Drive dan menyimpan ke dashboard.
              </p>
            </div>
          ) : connected ? (
            <div className="space-y-5 text-center">
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                <h2 className="font-serif text-xl font-bold">Google Drive Terhubung!</h2>
                <p className={cn('text-xs', isLight ? 'text-stone-500' : 'text-stone-400')}>
                  Akun berhasil disimpan ke dashboard kamu. Tab ini sudah bisa ditutup.
                </p>
              </div>

              <div
                className={cn(
                  'p-4 border text-left space-y-1.5 text-sm',
                  isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950/60 border-stone-800',
                )}
              >
                {connected.displayName && (
                  <p className="font-semibold truncate">{connected.displayName}</p>
                )}
                <p className={cn('text-xs break-all', isLight ? 'text-stone-600' : 'text-stone-300')}>
                  {connected.email || 'Akun Google terhubung'}
                </p>
                {typeof connected.usedBytes === 'number' && (
                  <p className={cn('text-xs pt-1 font-mono', isLight ? 'text-stone-500' : 'text-stone-400')}>
                    Terpakai: {formatBytes(connected.usedBytes)} / {formatBytes(connected.totalBytes)}
                  </p>
                )}
              </div>

              {connected.expiredFamilies?.length > 0 && (
                <div
                  role="status"
                  className={cn(
                    'p-3 border text-left text-xs flex items-start gap-2',
                    isLight
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-amber-950/40 border-amber-800 text-amber-200',
                  )}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Terdeteksi kuota {connected.lowStorageTier}:{' '}
                    {connected.expiredFamilies.map((f) => f.name).join(', ')} otomatis ditandai expired.
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleConnectAnother}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-5 py-3.5 text-xs font-bold uppercase tracking-widest transition-colors',
                    isLight
                      ? 'bg-stone-900 text-stone-50 hover:bg-stone-800'
                      : 'bg-white text-stone-950 hover:bg-stone-200',
                  )}
                >
                  <HardDrive className="w-4 h-4" />
                  Hubungkan Akun Lain
                </button>
                {isAdmin && (
                  <Link
                    to="/storage"
                    className={cn(
                      'w-full flex items-center justify-center px-5 py-3 text-xs font-bold uppercase tracking-widest border transition-colors',
                      isLight
                        ? 'border-stone-300 text-stone-700 hover:bg-stone-100'
                        : 'border-stone-700 text-stone-300 hover:bg-stone-800',
                    )}
                  >
                    Buka Storage Dashboard
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div
                  role="alert"
                  className={cn(
                    'p-3 border text-xs',
                    isLight
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-red-950/40 border-red-900 text-red-300',
                  )}
                >
                  {error}
                </div>
              )}

              {isAdmin ? (
                <div
                  className={cn(
                    'p-3 border text-xs flex items-center gap-2',
                    isLight
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-emerald-950/30 border-emerald-900 text-emerald-300',
                  )}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Kamu sudah login sebagai Admin — PIN tidak diperlukan.</span>
                </div>
              ) : (
                <div className="space-y-2 text-left">
                  <label
                    htmlFor="direct-connect-pin"
                    className={cn(
                      'flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest',
                      isLight ? 'text-stone-600' : 'text-stone-400',
                    )}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    PIN Koneksi
                  </label>
                  <div className="relative">
                    <input
                      id="direct-connect-pin"
                      type={showPin ? 'text' : 'password'}
                      required
                      autoComplete="off"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Masukkan PIN rahasia"
                      className={cn(
                        'w-full px-4 py-3 pr-11 border bg-transparent text-sm focus:outline-none transition-colors',
                        isLight
                          ? 'border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-900'
                          : 'border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50',
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin((v) => !v)}
                      aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                      className={cn(
                        'absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors',
                        isLight ? 'text-stone-400 hover:text-stone-700' : 'text-stone-500 hover:text-stone-200',
                      )}
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2 text-left">
                <label
                  htmlFor="direct-connect-email-hint"
                  className={cn(
                    'block text-[11px] font-bold uppercase tracking-widest',
                    isLight ? 'text-stone-600' : 'text-stone-400',
                  )}
                >
                  Email Google (Opsional)
                </label>
                <input
                  id="direct-connect-email-hint"
                  type="email"
                  autoComplete="email"
                  value={loginHint}
                  onChange={(e) => setLoginHint(e.target.value)}
                  placeholder="akun-trial@gmail.com (kosongkan untuk pilih manual)"
                  className={cn(
                    'w-full px-4 py-3 border bg-transparent text-sm focus:outline-none transition-colors',
                    isLight
                      ? 'border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-900'
                      : 'border-stone-700 text-stone-50 placeholder-stone-600 focus:border-stone-50',
                  )}
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className={cn(
                  'w-full flex items-center justify-center gap-2.5 px-6 py-4 font-bold rounded-none text-xs uppercase tracking-widest transition-all shadow-lg disabled:opacity-60',
                  isLight
                    ? 'bg-stone-900 text-stone-50 hover:bg-stone-800'
                    : 'bg-white text-stone-950 hover:bg-stone-200',
                )}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                {busy ? 'Mengarahkan ke Google...' : 'Connect Google Drive'}
              </button>
            </form>
          )}
        </motion.div>

        <div className="text-center">
          <Link
            to={isAdmin ? '/storage' : '/login'}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold transition-colors',
              isLight ? 'text-stone-500 hover:text-stone-900' : 'text-stone-400 hover:text-stone-100',
            )}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {isAdmin ? 'Kembali ke Storage Dashboard' : 'Kembali ke Login Admin'}
          </Link>
        </div>
      </div>
    </div>
  );
}
