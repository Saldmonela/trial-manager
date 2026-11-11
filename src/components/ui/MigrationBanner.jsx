import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function MigrationBanner({ families }) {
  const { t } = useLanguage();
  const unresolved = (families || []).filter(f => f.credentialStatus === 'missing' || f.credentialStatus === 'unreadable').length;
  if (!unresolved) return null;
  return (
    <p role="status" className="mb-6 flex items-start gap-3 border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{t('admin.migration.banner').replace('{count}', String(unresolved))}</span>
    </p>
  );
}
