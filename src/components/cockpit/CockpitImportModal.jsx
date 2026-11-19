import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, FileJson, ShieldCheck, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../utils';
import {
  CockpitParseError,
  MAX_COCKPIT_IMPORT_BYTES,
  normalizeEmail,
  parseCockpitExportText,
} from '../../lib/cockpitParser';

export default function CockpitImportModal({
  isOpen,
  isDark,
  existingEmails,
  onClose,
  onConfirmImport,
}) {
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, submitting, onClose]);

  const parsedPreview = useMemo(() => {
    if (!rawText.trim()) return null;
    try {
      const result = parseCockpitExportText(rawText);
      const existingSet = new Set((existingEmails || []).map((e) => normalizeEmail(e)));
      let created = 0;
      let updated = 0;
      for (const acc of result.accounts) {
        if (existingSet.has(acc.email)) updated += 1;
        else created += 1;
      }
      return { ...result, created, updated };
    } catch (err) {
      return { error: err instanceof CockpitParseError ? err.message : 'Format JSON tidak valid.' };
    }
  }, [rawText, existingEmails]);

  if (!isOpen) return null;

  const activeError = parseError || (parsedPreview && 'error' in parsedPreview ? parsedPreview.error : '') || submitError;
  const validPreview = parsedPreview && !('error' in parsedPreview) ? parsedPreview : null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setSubmitError('');

    if (file.size > MAX_COCKPIT_IMPORT_BYTES) {
      setFileName(file.name);
      setRawText('');
      setParseError('Ukuran berkas melebihi batas maksimal 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileName(file.name);
      setRawText(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      setParseError('Berkas tidak dapat dibaca. Pastikan Anda memilih berkas ekspor yang valid dari Cockpit Tools.');
    };
    reader.readAsText(file);
  };

  const handleClose = () => {
    if (submitting) return;
    setRawText('');
    setFileName('');
    setParseError('');
    setSubmitError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (submitting || !validPreview) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await onConfirmImport(validPreview.accounts, validPreview.skipped.length);
      if (result?.success) {
        setRawText('');
        setFileName('');
        setParseError('');
        onClose();
      } else {
        setSubmitError(
          result?.error ||
            'Gagal menyimpan data karena koneksi terputus. Tidak ada perubahan yang disimpan, silakan coba lagi.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cockpit-import-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={cn(
          'w-full max-w-xl border shadow-xl transition-colors duration-200',
          isDark ? 'bg-stone-900 border-stone-800 text-stone-100' : 'bg-paper border-stone-200 text-stone-900',
        )}
      >
        <div
          className={cn(
            'flex items-start justify-between gap-4 px-6 py-5 border-b',
            isDark ? 'border-stone-800' : 'border-stone-200',
          )}
        >
          <div>
            <h2
              id="cockpit-import-title"
              className={cn('font-serif text-xl font-bold tracking-tight', isDark ? 'text-white' : 'text-stone-900')}
            >
              Impor Snapshot Cockpit Tools
            </h2>
            <p className={cn('text-sm mt-1', isDark ? 'text-stone-400' : 'text-stone-600')}>
              Unggah file JSON ekspor dari Cockpit Tools atau tempel langsung isinya di bawah.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Tutup modal impor"
            className={cn(
              'p-1.5 transition-colors disabled:opacity-40',
              isDark ? 'text-stone-400 hover:text-stone-100 hover:bg-stone-800' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200',
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Privacy assurance (BR-05) */}
          <div
            className={cn(
              'flex items-start gap-3 border px-3.5 py-2.5 text-xs leading-relaxed',
              isDark
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-emerald-700/25 bg-emerald-50 text-emerald-900',
            )}
          >
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              <strong>Privasi terjaga:</strong> Hanya email dan tag yang diambil. Field sensitif seperti{' '}
              <code className="font-mono">refresh_token</code> dibuang otomatis di browser dan tidak pernah dikirim atau disimpan.
            </span>
          </div>

          {/* File drop / picker */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json,text/plain"
              onChange={handleFileChange}
              className="sr-only"
              id="cockpit-file-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className={cn(
                'w-full flex items-center justify-between gap-3 border border-dashed px-4 py-3 text-left transition-colors duration-150 disabled:opacity-50',
                isDark
                  ? 'border-stone-700 bg-stone-950/60 hover:border-gold-500/60 text-stone-200'
                  : 'border-stone-300 bg-white hover:border-gold-600 text-stone-800',
              )}
            >
              <span className="flex items-center gap-3 min-w-0">
                <FileJson className={cn('w-5 h-5 shrink-0', isDark ? 'text-gold-400' : 'text-gold-700')} />
                <span className="truncate text-sm font-medium">
                  {fileName || 'Pilih berkas ekspor JSON (maks. 5 MB)'}
                </span>
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 px-2.5 py-1 border',
                  isDark ? 'border-stone-700 text-stone-300' : 'border-stone-300 text-stone-700',
                )}
              >
                <Upload className="w-3.5 h-3.5" />
                Pilih File
              </span>
            </button>
          </div>

          {/* Paste JSON textarea */}
          <div>
            <label
              htmlFor="cockpit-json-textarea"
              className={cn('block text-xs font-semibold mb-1.5', isDark ? 'text-stone-300' : 'text-stone-700')}
            >
              Atau tempel teks JSON ekspor langsung
            </label>
            <textarea
              id="cockpit-json-textarea"
              rows={6}
              value={rawText}
              disabled={submitting}
              onChange={(e) => {
                setParseError('');
                setSubmitError('');
                setRawText(e.target.value);
              }}
              placeholder={'[\n  { "email": "contoh@gmail.com", "tags": ["bisa"] }\n]'}
              className={cn(
                'w-full font-mono text-xs border px-3 py-2.5 resize-y transition-colors',
                isDark
                  ? 'bg-stone-950 border-stone-800 text-stone-100 placeholder:text-stone-600 focus:border-gold-500'
                  : 'bg-white border-stone-300 text-stone-900 placeholder:text-stone-400 focus:border-gold-700',
              )}
            />
          </div>

          {/* Validation / submit error */}
          {activeError && (
            <div
              role="alert"
              className={cn(
                'flex items-start gap-2.5 border px-3.5 py-2.5 text-xs',
                isDark
                  ? 'border-red-500/40 bg-red-500/10 text-red-200'
                  : 'border-red-600/35 bg-red-50 text-red-800',
              )}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{activeError}</span>
            </div>
          )}

          {/* Parsed preview summary */}
          {validPreview && (
            <div
              className={cn(
                'border px-4 py-3 space-y-2 text-xs',
                isDark ? 'border-stone-800 bg-stone-950/70 text-stone-200' : 'border-stone-200 bg-white text-stone-800',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className={cn('w-4 h-4', isDark ? 'text-emerald-400' : 'text-emerald-700')} />
                  Siap diimpor: <span className="tabular-nums">{validPreview.accounts.length} akun valid</span>
                </span>
                <span className={cn('tabular-nums', isDark ? 'text-stone-400' : 'text-stone-600')}>
                  {validPreview.created} baru · {validPreview.updated} diperbarui
                </span>
              </div>

              {validPreview.skipped.length > 0 && (
                <p className={cn(isDark ? 'text-amber-300' : 'text-amber-800')}>
                  {validPreview.skipped.length} baris akan dilewati karena format email tidak valid.
                </p>
              )}

              {validPreview.strippedSecretFieldsCount > 0 && (
                <p className={cn(isDark ? 'text-emerald-300' : 'text-emerald-800')}>
                  {validPreview.strippedSecretFieldsCount} field rahasia (<code className="font-mono">refresh_token</code>/token) telah dibuang otomatis dari pratinjau.
                </p>
              )}
            </div>
          )}
        </div>

        <div
          className={cn(
            'flex items-center justify-end gap-3 px-6 py-4 border-t',
            isDark ? 'border-stone-800 bg-stone-950/40' : 'border-stone-200 bg-stone-50',
          )}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className={cn(
              'px-4 py-2 text-xs font-semibold border transition-colors duration-150 disabled:opacity-50',
              isDark
                ? 'border-stone-700 text-stone-300 hover:bg-stone-800'
                : 'border-stone-300 text-stone-700 hover:bg-stone-200',
            )}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!validPreview || submitting}
            className={cn(
              'px-5 py-2 text-xs font-semibold transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
              isDark
                ? 'bg-stone-50 text-stone-900 hover:bg-stone-200'
                : 'bg-stone-900 text-stone-50 hover:bg-stone-800',
            )}
          >
            {submitting ? 'Menyimpan Snapshot…' : 'Simpan Snapshot'}
          </button>
        </div>
      </div>
    </div>
  );
}
