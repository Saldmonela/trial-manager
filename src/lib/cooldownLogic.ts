import { normalizeEmail } from './cockpitParser';
import { isFamilyDowngraded } from './familyUtils';
import type {
  AccountCooldownSummary,
  AccountFamilyHistoryEntry,
  AnnotatedHistoryEntry,
  CockpitAccount,
  CooldownStatus,
  CooldownWarningEvaluation,
  DowngradeAffectedAccount,
  Family,
  FamilyDowngradeImpact,
} from '../types';

/** Ambang batas pengingat hampir bebas cooldown (US-09): 14 hari. */
export const COOLDOWN_UNLOCKING_SOON_DAYS = 14;

/** Lama pembatasan pindah Google Family: 12 bulan kalender. */
export const GOOGLE_FAMILY_COOLDOWN_MONTHS = 12;

export interface LocalDateParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

/**
 * Mengambil komponen tanggal kalender lokal (YYYY, MM, DD) dari Date / ISO string.
 * Jika input adalah format YYYY-MM-DD murni, langsung diparse tanpa pergeseran zona waktu UTC.
 */
export function parseLocalDateParts(input: string | Date | null | undefined): LocalDateParts | null {
  if (!input) return null;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]);
      const day = Number(dateOnlyMatch[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { year, month, day };
      }
      return null;
    }
  }
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function formatPartsToIsoDate(parts: LocalDateParts): string {
  const y = String(parts.year).padStart(4, '0');
  const m = String(parts.month).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Menambah N bulan kalender dengan clamping akhir bulan / tahun kabisat (NF-06).
 * Contoh: 2028-02-29 + 12 bulan -> 2029-02-28.
 */
export function addCalendarMonths(
  input: string | Date,
  months = GOOGLE_FAMILY_COOLDOWN_MONTHS,
): string | null {
  const parts = parseLocalDateParts(input);
  if (!parts) return null;
  const zeroBasedMonth = parts.month - 1 + months;
  const targetYear = parts.year + Math.floor(zeroBasedMonth / 12);
  const targetMonth = ((zeroBasedMonth % 12) + 12) % 12 + 1;
  const maxDay = daysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(parts.day, maxDay);
  return formatPartsToIsoDate({ year: targetYear, month: targetMonth, day: targetDay });
}

/**
 * Menghitung selisih hari kalender (target - base). Positif berarti target di masa depan.
 */
export function diffCalendarDays(
  baseInput: string | Date,
  targetInput: string | Date,
): number | null {
  const base = parseLocalDateParts(baseInput);
  const target = parseLocalDateParts(targetInput);
  if (!base || !target) return null;
  const baseUtc = Date.UTC(base.year, base.month - 1, base.day);
  const targetUtc = Date.UTC(target.year, target.month - 1, target.day);
  return Math.round((targetUtc - baseUtc) / 86_400_000);
}

/**
 * Format tanggal ke tampilan Indonesia ringkas (contoh: "16 Mar 2027").
 */
export function formatDateId(input: string | Date | null | undefined): string {
  const parts = parseLocalDateParts(input);
  if (!parts) return '—';
  const d = new Date(parts.year, parts.month - 1, parts.day);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * OQ-02: Menentukan apakah dua referensi Family adalah Family yang sama persis.
 */
export function isSameFamilyIdentity(
  a: {
    familyId?: string | null;
    familyOwnerEmailSnapshot?: string | null;
    familyNameSnapshot?: string | null;
  },
  b: {
    familyId?: string | null;
    familyOwnerEmailSnapshot?: string | null;
    familyNameSnapshot?: string | null;
  },
): boolean {
  const idA = a.familyId?.trim() || '';
  const idB = b.familyId?.trim() || '';
  if (idA && idB) return idA === idB;

  const ownerA = normalizeEmail(a.familyOwnerEmailSnapshot);
  const ownerB = normalizeEmail(b.familyOwnerEmailSnapshot);
  if (ownerA && ownerB) return ownerA === ownerB;

  const nameA = (a.familyNameSnapshot || '').trim().toLowerCase();
  const nameB = (b.familyNameSnapshot || '').trim().toLowerCase();
  if (nameA && nameB) return nameA === nameB;

  return false;
}

function compareEntriesChronological(
  a: AccountFamilyHistoryEntry,
  b: AccountFamilyHistoryEntry,
): number {
  const tA = Date.parse(a.joinedAt);
  const tB = Date.parse(b.joinedAt);
  if (!Number.isNaN(tA) && !Number.isNaN(tB) && tA !== tB) return tA - tB;
  const cA = a.createdAt ? Date.parse(a.createdAt) : 0;
  const cB = b.createdAt ? Date.parse(b.createdAt) : 0;
  if (cA !== cB) return cA - cB;
  return a.id.localeCompare(b.id);
}

export interface LiveActiveFamilyHint {
  familyId: string;
  familyName: string;
  ownerEmail?: string | null;
  joinedAt?: string | null;
}

/**
 * Mesin utama perhitungan status cooldown 12 bulan Google Family untuk 1 akun pribadi (BR-02, OQ-01, OQ-02).
 */
export function computeAccountCooldown(
  rawEmail: string,
  allHistoryEntries: AccountFamilyHistoryEntry[],
  nowInput: Date | string = new Date(),
  liveActiveHint?: LiveActiveFamilyHint | null,
): AccountCooldownSummary {
  const email = normalizeEmail(rawEmail);
  const nowParts = parseLocalDateParts(nowInput) ?? parseLocalDateParts(new Date())!;
  const todayIso = formatPartsToIsoDate(nowParts);

  const accountEntries = (allHistoryEntries || [])
    .filter((e) => normalizeEmail(e.accountEmail) === email)
    .sort(compareEntriesChronological);

  let previousCountable: AccountFamilyHistoryEntry | null = null;
  let seq = 0;
  let activeSwitchCount = 0;
  let latestActiveSwitch: {
    switchDate: string;
    endsAt: string;
    daysRemaining: number;
    fromFamily: string;
    toFamily: string;
  } | null = null;

  let firstFamilyName: string | null = null;
  let firstJoinedAt: string | null = null;
  let activeEntry: AccountFamilyHistoryEntry | null = null;
  let hasLeftWithin12m = false;

  const annotated: AnnotatedHistoryEntry[] = accountEntries.map((entry) => {
    if (!entry.countsForCooldown) {
      return {
        ...entry,
        isSwitchEvent: false,
        sequenceNumber: null,
      };
    }

    seq += 1;
    if (seq === 1) {
      firstFamilyName = entry.familyNameSnapshot;
      firstJoinedAt = entry.joinedAt;
    }

    if (!entry.leftAt) {
      activeEntry = entry;
    } else {
      const leftPlus12m = addCalendarMonths(entry.leftAt, GOOGLE_FAMILY_COOLDOWN_MONTHS);
      if (leftPlus12m) {
        const diffLeft = diffCalendarDays(todayIso, leftPlus12m);
        if (diffLeft !== null && diffLeft > 0) {
          hasLeftWithin12m = true;
        }
      }
    }

    let isSwitchEvent = false;
    if (previousCountable && !isSameFamilyIdentity(previousCountable, entry)) {
      const prevAnchor = previousCountable.leftAt || previousCountable.joinedAt;
      const prevWindowEnd = addCalendarMonths(prevAnchor, GOOGLE_FAMILY_COOLDOWN_MONTHS);
      const entryJoinParts = parseLocalDateParts(entry.joinedAt);
      const entryJoinIso = entryJoinParts ? formatPartsToIsoDate(entryJoinParts) : null;

      if (prevWindowEnd && entryJoinIso) {
        const daysBeforeReset = diffCalendarDays(entryJoinIso, prevWindowEnd);
        // Jika bergabung ke Family berbeda sebelum 12 bulan sejak keluar/gabung Family sebelumnya
        if (daysBeforeReset !== null && daysBeforeReset > 0) {
          isSwitchEvent = true;
          const switchEndsAt = addCalendarMonths(entry.joinedAt, GOOGLE_FAMILY_COOLDOWN_MONTHS);
          if (switchEndsAt) {
            const remaining = diffCalendarDays(todayIso, switchEndsAt);
            if (remaining !== null && remaining > 0) {
              activeSwitchCount += 1;
              latestActiveSwitch = {
                switchDate: entry.joinedAt,
                endsAt: switchEndsAt,
                daysRemaining: remaining,
                fromFamily: previousCountable.familyNameSnapshot,
                toFamily: entry.familyNameSnapshot,
              };
            }
          }
        }
      }
    }

    previousCountable = entry;
    return {
      ...entry,
      isSwitchEvent,
      sequenceNumber: seq,
    };
  });

  // Fallback halus bila akun sudah ada di daftar member aktif tapi belum ter-seed di tabel riwayat
  const effectiveCurrentFamilyId = activeEntry?.familyId ?? liveActiveHint?.familyId ?? null;
  const effectiveCurrentFamilyName = activeEntry?.familyNameSnapshot ?? liveActiveHint?.familyName ?? null;
  const effectiveCurrentJoinedAt = activeEntry?.joinedAt ?? liveActiveHint?.joinedAt ?? null;
  if (!firstFamilyName && liveActiveHint) {
    firstFamilyName = liveActiveHint.familyName;
    firstJoinedAt = liveActiveHint.joinedAt ?? null;
  }

  let status: CooldownStatus;
  if (activeSwitchCount >= 1 && latestActiveSwitch) {
    status = 'cooldown_active';
  } else if (effectiveCurrentFamilyName) {
    status = 'safe_first_family';
  } else if (hasLeftWithin12m) {
    status = 'ready_last_switch';
  } else {
    status = 'never_joined';
  }

  const cooldownEndsAt = latestActiveSwitch ? latestActiveSwitch.endsAt : null;
  const cooldownDaysRemaining = latestActiveSwitch ? latestActiveSwitch.daysRemaining : null;
  const isUnlockingSoon = Boolean(
    status === 'cooldown_active' &&
      cooldownDaysRemaining !== null &&
      cooldownDaysRemaining >= 1 &&
      cooldownDaysRemaining <= COOLDOWN_UNLOCKING_SOON_DAYS,
  );

  return {
    email,
    status,
    switchesInLast12m: activeSwitchCount,
    cooldownEndsAt,
    cooldownDaysRemaining,
    isUnlockingSoon,
    firstFamilyName,
    firstJoinedAt,
    currentFamilyId: effectiveCurrentFamilyId,
    currentFamilyName: effectiveCurrentFamilyName,
    currentJoinedAt: effectiveCurrentJoinedAt,
    lastSwitchDate: latestActiveSwitch?.switchDate ?? null,
    lastSwitchFromFamily: latestActiveSwitch?.fromFamily ?? null,
    lastSwitchToFamily: latestActiveSwitch?.toFamily ?? null,
    entries: annotated,
  };
}

/**
 * Mengevaluasi tingkat peringatan & teks pesan Indonesia untuk aksi keluar / masuk / pindah akun pribadi (BR-03, US-03).
 */
export function evaluateCooldownActionWarning(params: {
  summary: AccountCooldownSummary | null;
  action: 'leave' | 'join' | 'move';
  targetFamily?: {
    id?: string | null;
    name?: string | null;
    ownerEmail?: string | null;
  } | null;
  currentFamilyName?: string | null;
  historyLoadError?: string | null;
}): CooldownWarningEvaluation {
  const { summary, action, targetFamily, currentFamilyName, historyLoadError } = params;

  // Fail-Safe (NF-04, AC-03-04): jika riwayat gagal dimuat, jangan pernah anggap aman
  if (historyLoadError || !summary) {
    return {
      level: 'fail_safe_unverified',
      title: 'Status Cooldown Belum Terverifikasi',
      summaryLine: null,
      message:
        'Status cooldown tidak dapat diverifikasi karena riwayat gagal dimuat. Muat ulang data terlebih dahulu agar tidak salah pindah.',
      isSameFamilyRejoin: false,
      requiresExplicitOverride: true,
      cooldownEndsLabel: null,
      cooldownDaysRemaining: null,
    };
  }

  const email = summary.email;
  const activeFamLabel = currentFamilyName || summary.currentFamilyName || summary.firstFamilyName || 'Family saat ini';
  const firstJoinLabel = summary.firstJoinedAt ? formatDateId(summary.firstJoinedAt) : null;
  const summaryLine =
    summary.firstFamilyName && firstJoinLabel
      ? `Bergabung pertama di ${summary.firstFamilyName} pada ${firstJoinLabel}.`
      : summary.currentFamilyName && summary.currentJoinedAt
        ? `Tergabung di ${summary.currentFamilyName} sejak ${formatDateId(summary.currentJoinedAt)}.`
        : null;

  // Cek OQ-02: apakah aksi join/move menuju Family yang sama persis dengan entri terakhir
  const lastCountable = [...summary.entries]
    .reverse()
    .find((e) => e.countsForCooldown);
  const isSameFamilyRejoin = Boolean(
    (action === 'join' || action === 'move') &&
      targetFamily &&
      lastCountable &&
      isSameFamilyIdentity(lastCountable, {
        familyId: targetFamily.id ?? null,
        familyOwnerEmailSnapshot: targetFamily.ownerEmail ?? null,
        familyNameSnapshot: targetFamily.name ?? null,
      }),
  );

  // Level 2 — Kritis (Cooldown Aktif)
  if (summary.status === 'cooldown_active' && !isSameFamilyRejoin) {
    const endsLabel = formatDateId(summary.cooldownEndsAt);
    const days = summary.cooldownDaysRemaining ?? 0;
    const switchDateLabel = summary.lastSwitchDate ? formatDateId(summary.lastSwitchDate) : 'sebelumnya';
    const switchRoute =
      summary.lastSwitchFromFamily && summary.lastSwitchToFamily
        ? ` (pindah dari ${summary.lastSwitchFromFamily} ke ${summary.lastSwitchToFamily})`
        : '';

    return {
      level: 'critical_cooldown_locked',
      title: 'STOP — Akun Sedang Cooldown 12 Bulan',
      summaryLine,
      message: `Akun ${email} sudah memakai jatah pindah Google Family pada ${switchDateLabel}${switchRoute}. Jika dikeluarkan/dipindah sekarang, Google akan menolak masuk ke Family ke-3 sampai ${endsLabel} (${days} hari lagi) dan akun akan terjebak di paket FREE.`,
      isSameFamilyRejoin: false,
      requiresExplicitOverride: true,
      cooldownEndsLabel: endsLabel,
      cooldownDaysRemaining: days,
    };
  }

  // OQ-02: Re-join ke Family yang sama tidak dihitung Switch
  if (isSameFamilyRejoin) {
    return {
      level: 'none',
      title: 'Masuk Kembali ke Family yang Sama',
      summaryLine,
      message: `Akun ini tercatat pernah bergabung di ${targetFamily?.name || 'Family yang sama'}. Masuk kembali ke Family yang sama tidak dihitung sebagai perpindahan (Switch).`,
      isSameFamilyRejoin: true,
      requiresExplicitOverride: false,
      cooldownEndsLabel: null,
      cooldownDaysRemaining: null,
    };
  }

  // Level 1 — Peringatan Jatah Pindah Terakhir
  if (
    summary.status === 'safe_first_family' ||
    summary.status === 'ready_last_switch'
  ) {
    const isEnteringSecond = action === 'join' || action === 'move';
    const message = isEnteringSecond
      ? `Peringatan Jatah Pindah: Akun Google hanya boleh pindah Family 1 kali dalam 12 bulan. Jika kamu memasukkan akun ini ke ${targetFamily?.name || 'Family baru'} sekarang, akun akan memakai jatah pindah 12 bulan dan tidak bisa pindah lagi ke Family ke-3 selama 12 bulan sejak hari ini.`
      : `Peringatan Jatah Pindah: Akun Google hanya boleh pindah Family 1 kali dalam 12 bulan. Jika kamu keluar dari ${activeFamLabel} dan masuk ke Family lain, akun ini tidak akan bisa pindah ke Family ke-3 selama 12 bulan sejak tanggal pindah.`;

    return {
      level: 'caution_last_switch',
      title: 'Peringatan Jatah Pindah Terakhir',
      summaryLine,
      message,
      isSameFamilyRejoin: false,
      requiresExplicitOverride: false,
      cooldownEndsLabel: null,
      cooldownDaysRemaining: null,
    };
  }

  // Belum pernah gabung -> Aman penuh
  return {
    level: 'none',
    title: 'Aman untuk Bergabung',
    summaryLine: null,
    message: 'Akun pribadi ini belum pernah bergabung ke Family mana pun. Masih memiliki jatah pindah 12 bulan penuh.',
    isSameFamilyRejoin: false,
    requiresExplicitOverride: false,
    cooldownEndsLabel: null,
    cooldownDaysRemaining: null,
  };
}

/**
 * Mengecek apakah email/member termasuk Akun Pribadi yang dilindungi cooldown (BR-01).
 */
export function isPersonalAccountEmail(
  rawEmail: string | null | undefined,
  memberType?: string | null,
  cockpitAccounts: CockpitAccount[] = [],
  families: Family[] = [],
): boolean {
  if (memberType === 'pribadi') return true;
  const email = normalizeEmail(rawEmail);
  if (!email) return false;

  if (cockpitAccounts.some((a) => normalizeEmail(a.email) === email)) {
    return true;
  }

  for (const fam of families) {
    for (const m of fam.members || []) {
      if (
        (m.memberType || m.member_type) === 'pribadi' &&
        normalizeEmail(m.email) === email
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Memetakan dampak migrasi akun pribadi pada sebuah Family yang berstatus PRO Hilang / Turun ke FREE (US-06, AC-06-01).
 */
export function computeFamilyDowngradeImpact(params: {
  family: Family;
  cockpitAccounts?: CockpitAccount[];
  historyEntries?: AccountFamilyHistoryEntry[];
  historyLoadError?: string | null;
  now?: Date | string;
}): FamilyDowngradeImpact {
  const {
    family,
    cockpitAccounts = [],
    historyEntries = [],
    historyLoadError = null,
    now = new Date(),
  } = params;

  const cockpitByEmail = new Map<string, CockpitAccount>();
  for (const acc of cockpitAccounts) {
    cockpitByEmail.set(normalizeEmail(acc.email), acc);
  }

  const seenEmails = new Set<string>();
  const personalMembers: Array<{
    email: string;
    memberId: string | null;
    memberName: string;
    addedAt: string | null;
    cockpitAccountId: string | null;
  }> = [];

  for (const m of family.members || []) {
    const email = normalizeEmail(m.email);
    if (!email || seenEmails.has(email)) continue;
    const cockpitAcc = cockpitByEmail.get(email) || null;
    const isPersonal = (m.memberType || m.member_type) === 'pribadi' || Boolean(cockpitAcc);
    if (!isPersonal) continue;

    seenEmails.add(email);
    personalMembers.push({
      email,
      memberId: m.id,
      memberName: m.name?.trim() || email,
      addedAt: m.addedAt || m.added_at || null,
      cockpitAccountId: cockpitAcc?.id ?? null,
    });
  }

  const safeToMove: DowngradeAffectedAccount[] = [];
  const cooldownLocked: DowngradeAffectedAccount[] = [];
  const unverified: DowngradeAffectedAccount[] = [];

  for (const item of personalMembers) {
    const cooldown = computeAccountCooldown(item.email, historyEntries, now, {
      familyId: family.id,
      familyName: family.name || family.ownerEmail || 'Family Plan',
      ownerEmail: family.ownerEmail ?? null,
      joinedAt: item.addedAt,
    });

    const record: DowngradeAffectedAccount = {
      email: item.email,
      memberId: item.memberId,
      memberName: item.memberName,
      cockpitAccountId: item.cockpitAccountId,
      cooldown,
    };

    if (historyLoadError) {
      unverified.push(record);
    } else if (cooldown.status === 'cooldown_active') {
      cooldownLocked.push(record);
    } else {
      safeToMove.push(record);
    }
  }

  return {
    familyId: family.id,
    familyName: family.name || family.ownerEmail || 'Family Plan',
    totalPersonalAccounts: personalMembers.length,
    safeToMove,
    cooldownLocked,
    unverified,
  };
}

/**
 * Mengembalikan map email -> AccountCooldownSummary untuk semua email akun pribadi yang ada di families & cockpitAccounts.
 */
export function buildCooldownSummaryMap(
  historyEntries: AccountFamilyHistoryEntry[],
  families: Family[] = [],
  cockpitAccounts: CockpitAccount[] = [],
  now: Date | string = new Date(),
): Map<string, AccountCooldownSummary> {
  const emailHints = new Map<string, LiveActiveFamilyHint | null>();

  for (const acc of cockpitAccounts) {
    const email = normalizeEmail(acc.email);
    if (email && !emailHints.has(email)) emailHints.set(email, null);
  }

  for (const fam of families) {
    const famName = fam.name || fam.ownerEmail || 'Family Plan';
    for (const m of fam.members || []) {
      const email = normalizeEmail(m.email);
      if (!email) continue;
      if ((m.memberType || m.member_type) === 'pribadi' || emailHints.has(email)) {
        emailHints.set(email, {
          familyId: fam.id,
          familyName: famName,
          ownerEmail: fam.ownerEmail ?? null,
          joinedAt: m.addedAt || m.added_at || null,
        });
      }
    }
  }

  for (const entry of historyEntries) {
    const email = normalizeEmail(entry.accountEmail);
    if (email && !emailHints.has(email)) emailHints.set(email, null);
  }

  const map = new Map<string, AccountCooldownSummary>();
  for (const [email, hint] of emailHints.entries()) {
    map.set(email, computeAccountCooldown(email, historyEntries, now, hint));
  }
  return map;
}

/**
 * Helper untuk memeriksa apakah suatu Family berada dalam status PRO Hilang / Turun ke FREE.
 */
export function isFamilyDowngradedToFree(family: Family | null | undefined): boolean {
  return isFamilyDowngraded(family);
}
