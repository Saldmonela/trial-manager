import React from 'react';
import { ShieldAlert, ShieldCheck, Clock, RefreshCw, History } from 'lucide-react';
import { cn } from '../../utils';
import { formatDateId } from '../../lib/cooldownLogic';

/**
 * Badge tunggal status cooldown 12 bulan Google Family untuk Cockpit & Dashboard Admin.
 * Memenuhi AC-02-01, AC-02-03 (Fail-Safe error state), dan AC-09-01 (H-14 hampir bebas).
 */
export default function CooldownStatusBadge({
  summary,
  isDark,
  loading = false,
  error = null,
  compact = false,
  onClick,
  onRetry,
}) {
  if (loading) {
    return (
      <span
        aria-busy="true"
        aria-label="Memuat status cooldown"
        className={cn(
          'inline-block animate-pulse align-middle',
          compact ? 'h-4 w-20' : 'h-5 w-28',
          isDark ? 'bg-stone-800' : 'bg-stone-200',
        )}
      />
    );
  }

  if (error || !summary) {
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        <span
          title={error || 'Riwayat cooldown gagal dimuat'}
          className={cn(
            'inline-flex items-center gap-1 border font-semibold',
            compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
            isDark
              ? 'border-red-500/40 bg-red-950/40 text-red-200'
              : 'border-red-700/35 bg-red-50 text-red-800',
          )}
        >
          <ShieldAlert className="w-3 h-3 shrink-0" />
          Gagal Muat
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            className={cn(
              'inline-flex items-center gap-1 text-[11px] font-semibold underline cursor-pointer',
              isDark ? 'text-stone-300 hover:text-white' : 'text-stone-700 hover:text-stone-950',
            )}
          >
            <RefreshCw className="w-3 h-3" />
            Muat Ulang
          </button>
        )}
      </span>
    );
  }

  const { status, cooldownDaysRemaining, cooldownEndsAt, isUnlockingSoon, firstFamilyName, firstJoinedAt } =
    summary;

  let label = 'Belum Gabung';
  let subline = null;
  let Icon = History;
  let toneClass = isDark
    ? 'border-stone-700 bg-stone-800/70 text-stone-300 hover:border-stone-500'
    : 'border-stone-300 bg-stone-100 text-stone-700 hover:border-stone-500';
  let titleText = 'Belum ada riwayat bergabung ke Family. Klik untuk lihat atau catat riwayat lama.';

  if (status === 'safe_first_family') {
    label = compact ? 'Aman · 1x' : 'Aman · Sisa 1x Pindah';
    Icon = ShieldCheck;
    toneClass = isDark
      ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-300 hover:border-emerald-400'
      : 'border-emerald-700/30 bg-emerald-50 text-emerald-800 hover:border-emerald-700';
    titleText = firstFamilyName && firstJoinedAt
      ? `Bergabung pertama di ${firstFamilyName} (${formatDateId(firstJoinedAt)}). Masih tersisa 1x jatah pindah dalam 12 bulan.`
      : 'Masih tersisa 1x jatah pindah Google Family dalam 12 bulan.';
  } else if (status === 'ready_last_switch') {
    label = compact ? 'Siap Family #2' : 'Siap Masuk Family ke-2';
    subline = compact ? null : 'Jatah pindah terakhir';
    Icon = Clock;
    toneClass = isDark
      ? 'border-amber-500/40 bg-amber-500/15 text-amber-200 hover:border-amber-400'
      : 'border-amber-700/35 bg-amber-50 text-amber-900 hover:border-amber-700';
    titleText = 'Sudah keluar dari Family ke-1. Masuk ke Family baru akan memakai jatah pindah 12 bulan terakhir.';
  } else if (status === 'cooldown_active') {
    const days = cooldownDaysRemaining ?? 0;
    const endsLabel = formatDateId(cooldownEndsAt);
    label = isUnlockingSoon
      ? compact
        ? `Bebas ${days}h`
        : `Bebas ${days}h lagi`
      : compact
        ? `Cooldown · ${days}h`
        : `Cooldown · ${days}h lagi`;
    subline = compact ? null : `Terkunci s.d. ${endsLabel}`;
    Icon = isUnlockingSoon ? Clock : ShieldAlert;
    toneClass = isUnlockingSoon
      ? isDark
        ? 'border-amber-500/45 bg-amber-500/15 text-amber-200 hover:border-amber-400'
        : 'border-amber-700/40 bg-amber-50 text-amber-900 hover:border-amber-700'
      : isDark
        ? 'border-red-500/45 bg-red-950/50 text-red-200 hover:border-red-400'
        : 'border-red-700/40 bg-red-50 text-red-900 hover:border-red-700';
    titleText = `Akun sedang cooldown 12 bulan Google Family. Terkunci pindah sampai ${endsLabel} (${days} hari lagi).`;
  }

  const content = (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span
        className={cn(
          'inline-flex items-center gap-1 border font-semibold tabular-nums transition-colors',
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
          toneClass,
        )}
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span>{label}</span>
      </span>
      {subline && (
        <span
          className={cn(
            'text-[11px] tabular-nums',
            status === 'cooldown_active' && !isUnlockingSoon
              ? isDark
                ? 'text-red-300/90'
                : 'text-red-800'
              : isDark
                ? 'text-stone-400'
                : 'text-stone-600',
          )}
        >
          {subline}
        </span>
      )}
    </span>
  );

  if (!onClick) {
    return <span title={titleText}>{content}</span>;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={titleText}
      aria-label={`Lihat riwayat Family: ${label}`}
      className="text-left cursor-pointer focus-visible:outline-2"
    >
      {content}
    </button>
  );
}
