import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { cn } from '../../utils';
import {
  Sparkles,
  Languages,
  User,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { invokeApi } from '../../lib/api';

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-stone-800">
      <Icon className="w-4 h-4 text-gold-500" aria-hidden="true" />
      <h3 className="text-xs font-bold uppercase tracking-widest opacity-70">{children}</h3>
    </div>
  );
}

export default function SettingsModal({ isOpen, onClose, language, onToggleLanguage, onShowTutorial, onLogout, session }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === 'dark';
  const rowClass = cn(
    'w-full flex items-center justify-between px-4 py-3 border rounded-sm transition-colors',
    isDark ? 'bg-stone-900 border-stone-800 hover:border-stone-700' : 'bg-stone-50 border-stone-200 hover:border-stone-300',
  );

  // Direct Connect Drive PIN state
  const [pinStatus, setPinStatus] = useState({ loading: false, configured: false, source: 'none', updatedAt: null });
  const [newPin, setNewPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinFeedback, setPinFeedback] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen || !session) return undefined;
    let active = true;
    setPinFeedback(null);
    setPinStatus((prev) => ({ ...prev, loading: true }));
    void (async () => {
      const res = await invokeApi('drive-connect-pin', { action: 'status' });
      if (!active) return;
      if (res.success && res.data) {
        setPinStatus({
          loading: false,
          configured: Boolean(res.data.configured),
          source: res.data.source || 'none',
          updatedAt: res.data.updatedAt || null,
        });
      } else {
        setPinStatus((prev) => ({ ...prev, loading: false }));
      }
    })();
    return () => { active = false; };
  }, [isOpen, session]);

  const handleSavePin = async (e) => {
    e.preventDefault();
    const trimmed = newPin.trim();
    if (trimmed.length < 4) {
      setPinFeedback({ type: 'error', text: 'PIN minimal 4 karakter.' });
      return;
    }
    setPinBusy(true);
    setPinFeedback(null);
    const res = await invokeApi('drive-connect-pin', { action: 'set', pin: trimmed });
    setPinBusy(false);
    if (res.success && res.data) {
      setPinStatus({
        loading: false,
        configured: true,
        source: res.data.source || 'db',
        updatedAt: res.data.updatedAt || null,
      });
      setNewPin('');
      setPinFeedback({ type: 'success', text: 'PIN berhasil disimpan! Bisa langsung dipakai di /connect.' });
    } else {
      setPinFeedback({ type: 'error', text: res.error || 'Gagal menyimpan PIN.' });
    }
  };

  const handleClearPin = async () => {
    setPinBusy(true);
    setPinFeedback(null);
    const res = await invokeApi('drive-connect-pin', { action: 'clear' });
    setPinBusy(false);
    if (res.success && res.data) {
      setPinStatus({
        loading: false,
        configured: Boolean(res.data.configured),
        source: res.data.source || 'none',
        updatedAt: null,
      });
      setPinFeedback({ type: 'success', text: 'PIN dihapus.' });
    } else {
      setPinFeedback({ type: 'error', text: res.error || 'Gagal menghapus PIN.' });
    }
  };

  const handleCopyConnectLink = async () => {
    const url = `${window.location.origin}/connect`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setPinFeedback({ type: 'error', text: `Salin manual: ${url}` });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('admin.settings.title')} maxWidth="max-w-md">
      <div className="space-y-8 py-2">

        {/* Direct Connect Google Drive (PIN) */}
        {session && (
          <div className="space-y-4">
            <SectionTitle icon={KeyRound}>Direct Connect Drive (PIN)</SectionTitle>
            <div className="space-y-3">
              <div className={cn(
                'flex items-center justify-between gap-2 px-4 py-3 border rounded-sm',
                isDark ? 'bg-stone-900 border-stone-800' : 'bg-stone-50 border-stone-200',
              )}>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">Status PIN</p>
                  {pinStatus.loading ? (
                    <p className="text-xs opacity-60 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memeriksa...
                    </p>
                  ) : (
                    <p className={cn(
                      'text-xs font-bold uppercase tracking-wider',
                      pinStatus.configured
                        ? (isDark ? 'text-emerald-400' : 'text-emerald-700')
                        : (isDark ? 'text-amber-400' : 'text-amber-700'),
                    )}>
                      {pinStatus.configured ? 'Aktif' : 'Belum Diatur'}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCopyConnectLink}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border rounded-sm transition-colors shrink-0',
                    isDark
                      ? 'border-stone-700 text-stone-300 hover:bg-stone-800'
                      : 'border-stone-300 text-stone-700 hover:bg-stone-200/70',
                  )}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Tersalin!' : 'Salin /connect'}
                </button>
              </div>

              <form onSubmit={handleSavePin} className="space-y-2.5">
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder={pinStatus.configured ? 'Masukkan PIN baru (min. 4 karakter)' : 'Buat PIN rahasia (min. 4 karakter)'}
                    aria-label="PIN Direct Connect"
                    className={cn(
                      'w-full px-3.5 py-2.5 pr-10 border rounded-sm bg-transparent text-sm focus:outline-none transition-colors',
                      isDark
                        ? 'border-stone-700 text-stone-100 placeholder-stone-500 focus:border-stone-400'
                        : 'border-stone-300 text-stone-900 placeholder-stone-400 focus:border-stone-800',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                    className={cn(
                      'absolute right-2.5 top-1/2 -translate-y-1/2 p-1 transition-colors',
                      isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-800',
                    )}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={pinBusy || !newPin.trim()}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50',
                      isDark
                        ? 'bg-stone-100 text-stone-950 hover:bg-white'
                        : 'bg-stone-900 text-stone-50 hover:bg-stone-800',
                    )}
                  >
                    {pinBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {pinStatus.configured ? 'Ubah PIN' : 'Simpan PIN'}
                  </button>

                  {pinStatus.source === 'db' && (
                    <button
                      type="button"
                      disabled={pinBusy}
                      onClick={handleClearPin}
                      title="Hapus PIN"
                      aria-label="Hapus PIN"
                      className={cn(
                        'px-3 py-2.5 border rounded-sm transition-colors disabled:opacity-50',
                        isDark
                          ? 'border-red-900/60 text-red-400 hover:bg-red-950/40'
                          : 'border-red-200 text-red-600 hover:bg-red-50',
                      )}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </form>

              {pinFeedback && (
                <p
                  role={pinFeedback.type === 'error' ? 'alert' : 'status'}
                  className={cn(
                    'text-xs px-3 py-2 border rounded-sm',
                    pinFeedback.type === 'error'
                      ? (isDark ? 'bg-red-950/30 border-red-900 text-red-300' : 'bg-red-50 border-red-200 text-red-700')
                      : (isDark ? 'bg-emerald-950/30 border-emerald-900 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'),
                  )}
                >
                  {pinFeedback.text}
                </p>
              )}

              <p className="text-[11px] opacity-60 leading-relaxed">
                Pakai PIN ini di halaman <span className="font-mono">/connect</span> untuk menyambungkan Google Drive dari browser/profile lain tanpa login admin.
              </p>
            </div>
          </div>
        )}

        {/* Account Section — email + logout */}
        {session && (
          <div className="space-y-4">
            <SectionTitle icon={User}>{t('admin.settings.account')}</SectionTitle>
            <div className="space-y-3">
              <div className={cn(
                'flex items-center justify-between px-4 py-3 border rounded-sm',
                isDark ? 'bg-stone-900 border-stone-800' : 'bg-stone-50 border-stone-200',
              )}>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{t('admin.settings.email')}</p>
                  <p className="text-sm font-medium truncate">{session?.user?.email || '—'}</p>
                </div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={() => { onLogout(); onClose(); }}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-3 border rounded-sm transition-colors font-bold text-xs uppercase tracking-widest',
                    isDark
                      ? 'bg-red-950/30 border-red-900/50 text-red-400 hover:bg-red-950/50 hover:border-red-800'
                      : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300',
                  )}
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('admin.settings.logout')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Preferences — Language & Tour (mobile-only, since desktop shows them in header) */}
        <div className="space-y-4 md:hidden">
          <SectionTitle icon={Languages}>{t('admin.settings.preferences')}</SectionTitle>

          <div className="space-y-3">
            {onToggleLanguage && (
              <button type="button" onClick={() => { onToggleLanguage(); }} className={rowClass}>
                <span className="text-sm font-medium">{t('admin.settings.language')}</span>
                <span className={cn(
                  'px-3 py-1 text-[10px] font-bold uppercase tracking-widest border rounded-sm',
                  isDark ? 'border-stone-700 text-stone-300' : 'border-stone-300 text-stone-600',
                )}>
                  {language === 'en' ? 'English → Indonesia' : 'Indonesia → English'}
                </span>
              </button>
            )}

            {onShowTutorial && (
              <button type="button" onClick={() => { onShowTutorial(); onClose(); }} className={rowClass}>
                <span className="text-sm font-medium">{t('admin.settings.restart_tour')}</span>
                <Sparkles className="w-4 h-4 text-gold-500" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

      </div>
    </Modal>
  );
}
