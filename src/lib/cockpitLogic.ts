import { formatBytes } from '../utils';
import {
  MAX_FAMILY_SLOTS,
  MAX_STORAGE_GB,
  getDaysRemaining,
  getFamilyPoolInfo,
  getSlotsAvailable,
  getSlotsUsed,
  isFamilyAttentionNeeded,
} from './familyUtils';
import {
  getArgonQuotaPct,
  isActiveCockpitEligibility,
  isPriorityCockpitAccount,
  normalizeEmail,
} from './cockpitParser';
import type {
  CockpitAccount,
  CockpitAccountView,
  CockpitConflictGroup,
  CockpitFamilyMatch,
  ConnectedAccount,
  Family,
  RecommendedFamily,
} from '../types';

/** Ambang batas "Storage Lega" terkunci di PRD v1.1: >= 500 GB. */
export const STORAGE_LEGA_MIN_BYTES = 500 * 1_000_000_000;
/** Ambang batas indikator data usang (BR-06): > 24 jam. */
export const COCKPIT_STALE_MS = 24 * 60 * 60 * 1000;

export type CockpitFilterKey =
  | 'all'
  | 'free_candidates'
  | 'in_pro_family'
  | 'conflicts'
  | 'no_argon'
  | 'need_verif'
  | 'banned'
  | 'untagged';

export type CockpitSortKey = 'priority' | 'expiry_asc' | 'quota_desc' | 'email_asc';

export interface CockpitSummaryMetrics {
  totalAccounts: number;
  activeEligibleCount: number;
  uniqueProCount: number;
  uniqueProPct: number;
  freeCandidatesCount: number;
  conflictGroupsCount: number;
  conflictAccountsCount: number;
  noArgonCount: number;
  needVerifCount: number;
  bannedCount: number;
  untaggedCount: number;
  isAnyStale: boolean;
  latestSyncedAt: string | null;
}

export interface CockpitOverviewData {
  views: CockpitAccountView[];
  conflicts: CockpitConflictGroup[];
  metrics: CockpitSummaryMetrics;
}

function isFamilyBanned(family: Family): boolean {
  return Boolean(family.isBanned || family.is_banned);
}

export function isFamilyActiveForPro(
  family: Family,
  connectedAccounts: ConnectedAccount[] = [],
  allFamilies: Family[] = [],
): boolean {
  if (!family) return false;
  if (isFamilyBanned(family)) return false;
  if (family.isActive === false) return false;
  if (isFamilyAttentionNeeded(family, connectedAccounts, allFamilies)) return false;
  return true;
}

export function getFamilyStorageSummary(
  family: Family,
  connectedAccounts: ConnectedAccount[] = [],
) {
  const pool = getFamilyPoolInfo(family, connectedAccounts);
  if (pool.hasLive) {
    if (pool.isUnlimited) {
      return {
        hasLiveDrive: true,
        isUnlimitedDrive: true,
        availableBytes: Number.POSITIVE_INFINITY,
        totalBytes: null as number | null,
        isStorageLega: true,
        storageLabel: 'Unlimited',
      };
    }
    const totalBytes = Number(pool.poolLimit) || 0;
    const availableBytes = Math.max(0, totalBytes - (Number(pool.poolUsed) || 0));
    return {
      hasLiveDrive: true,
      isUnlimitedDrive: false,
      availableBytes,
      totalBytes,
      isStorageLega: availableBytes >= STORAGE_LEGA_MIN_BYTES,
      storageLabel: `${formatBytes(availableBytes)} tersisa`,
    };
  }

  const usedGb = Number(family.storageUsed ?? family.storage_used) || 0;
  const availableGb = Math.max(0, MAX_STORAGE_GB - usedGb);
  const availableBytes = availableGb * 1_000_000_000;
  return {
    hasLiveDrive: false,
    isUnlimitedDrive: false,
    availableBytes,
    totalBytes: MAX_STORAGE_GB * 1_000_000_000,
    isStorageLega: availableBytes >= STORAGE_LEGA_MIN_BYTES,
    storageLabel: `${formatBytes(availableBytes)} (manual)`,
  };
}

/**
 * Membangun peta lengkap akun Cockpit ↔ Family, deteksi Konflik Family Ganda (BR-02),
 * dan metrik NSM dari data aktual.
 */
export function buildCockpitOverview(
  cockpitAccounts: CockpitAccount[],
  families: Family[],
  connectedAccounts: ConnectedAccount[] = [],
  nowMs = Date.now(),
): CockpitOverviewData {
  // Index semua family berdasarkan email owner dan member (BR-01: case-insensitive + trim)
  const emailToMatches = new Map<string, CockpitFamilyMatch[]>();

  const pushMatch = (rawEmail: string | null | undefined, match: CockpitFamilyMatch) => {
    const normalized = normalizeEmail(rawEmail);
    if (!normalized) return;
    const list = emailToMatches.get(normalized) || [];
    // Hindari duplikasi untuk family yang sama
    if (!list.some((m) => m.familyId === match.familyId)) {
      list.push(match);
      emailToMatches.set(normalized, list);
    }
  };

  for (const family of families) {
    const active = isFamilyActiveForPro(family, connectedAccounts, families);
    const banned = isFamilyBanned(family);
    const expiryDate = family.expiryDate ?? null;
    const daysRemaining = getDaysRemaining(expiryDate);
    const base = {
      familyId: family.id,
      familyName: family.name || family.ownerEmail || 'Tanpa Nama',
      ownerEmail: normalizeEmail(family.ownerEmail),
      isActiveFamily: active,
      isBanned: banned,
      expiryDate,
      daysRemaining,
    };

    pushMatch(family.ownerEmail, { ...base, role: 'owner' });
    for (const member of family.members || []) {
      pushMatch(member.email, { ...base, role: 'member' });
    }
  }

  // Hitung jumlah akun Cockpit prioritas (bisa / untagged DAN bukan No Argon) per Family Owner (BR-02).
  // Akun tanpa kuota Gemini 4 Argon (argonStatus === 'missing') tidak diprioritaskan dan boleh
  // berbagi Family PRO yang sama (2-4 akun di 1 family tidak dihitung konflik).
  const activeEmailsByFamilyId = new Map<
    string,
    { familyName: string; ownerEmail: string; emails: string[] }
  >();

  for (const account of cockpitAccounts) {
    if (!isPriorityCockpitAccount(account.eligibilityStatus, account.argonStatus ?? 'unknown')) {
      continue;
    }
    const email = normalizeEmail(account.email);
    const matches = emailToMatches.get(email) || [];
    for (const m of matches) {
      if (!m.isActiveFamily) continue;
      const entry = activeEmailsByFamilyId.get(m.familyId) || {
        familyName: m.familyName,
        ownerEmail: m.ownerEmail,
        emails: [],
      };
      if (!entry.emails.includes(email)) {
        entry.emails.push(email);
      }
      activeEmailsByFamilyId.set(m.familyId, entry);
    }
  }

  const conflicts: CockpitConflictGroup[] = [];
  const conflictFamilyIdSet = new Set<string>();
  for (const [familyId, info] of activeEmailsByFamilyId.entries()) {
    if (info.emails.length > 1) {
      conflictFamilyIdSet.add(familyId);
      conflicts.push({
        familyId,
        familyName: info.familyName,
        ownerEmail: info.ownerEmail,
        emails: info.emails,
        count: info.emails.length,
      });
    }
  }

  let latestSyncTime = 0;
  let latestSyncedAt: string | null = null;
  let activeEligibleCount = 0;
  let uniqueProCount = 0;
  let freeCandidatesCount = 0;
  let conflictAccountsCount = 0;
  let noArgonCount = 0;
  let needVerifCount = 0;
  let bannedCount = 0;
  let untaggedCount = 0;
  let isAnyStale = false;

  const views: CockpitAccountView[] = cockpitAccounts.map((account) => {
    const email = normalizeEmail(account.email);
    const argonStatus = account.argonStatus ?? 'unknown';
    const isActiveEligibility = isActiveCockpitEligibility(account.eligibilityStatus);
    const isArgonPriority = isPriorityCockpitAccount(account.eligibilityStatus, argonStatus);
    const matches = emailToMatches.get(email) || [];
    const activeMatches = matches.filter((m) => m.isActiveFamily);
    const primaryMatch = activeMatches[0] || matches[0] || null;

    const syncedTime = account.lastSyncedAt ? new Date(account.lastSyncedAt).getTime() : 0;
    if (syncedTime > latestSyncTime) {
      latestSyncTime = syncedTime;
      latestSyncedAt = account.lastSyncedAt;
    }
    const isStale = syncedTime > 0 ? nowMs - syncedTime > COCKPIT_STALE_MS : false;
    if (isStale) isAnyStale = true;

    let resolvedTier: 'PRO' | 'FREE';
    let tierSource: 'family' | 'manual' | 'unassigned';
    if (account.planTier === 'PRO' || account.planTier === 'FREE') {
      resolvedTier = account.planTier;
      tierSource = 'manual';
    } else if (activeMatches.length > 0) {
      resolvedTier = 'PRO';
      tierSource = 'family';
    } else {
      resolvedTier = 'FREE';
      tierSource = 'unassigned';
    }

    const conflictFamilyNames = isArgonPriority
      ? activeMatches
          .filter((m) => conflictFamilyIdSet.has(m.familyId))
          .map((m) => m.familyName)
      : [];
    const hasConflict = conflictFamilyNames.length > 0;

    const isFreeCandidate = isArgonPriority && resolvedTier === 'FREE' && activeMatches.length === 0;

    const quotaPcts = (account.quotas || [])
      .map((q) => q.remaining_pct)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const highestQuotaPct = quotaPcts.length > 0 ? Math.max(...quotaPcts) : null;
    const argonQuotaPct = getArgonQuotaPct(account.quotas || []);

    const isNearExpiryWithQuota = Boolean(
      isArgonPriority &&
        resolvedTier === 'PRO' &&
        primaryMatch &&
        primaryMatch.daysRemaining !== null &&
        primaryMatch.daysRemaining >= 0 &&
        primaryMatch.daysRemaining <= 3 &&
        highestQuotaPct !== null &&
        highestQuotaPct >= 50,
    );

    if (account.eligibilityStatus === 'ban') bannedCount += 1;
    else if (account.eligibilityStatus === 'need_verif') needVerifCount += 1;
    else if (account.eligibilityStatus === 'untagged') untaggedCount += 1;

    if (isActiveEligibility && argonStatus === 'missing') {
      noArgonCount += 1;
    }

    if (isArgonPriority) {
      activeEligibleCount += 1;
      if (hasConflict) {
        conflictAccountsCount += 1;
      } else if (activeMatches.length > 0 && resolvedTier === 'PRO') {
        uniqueProCount += 1;
      }
      if (isFreeCandidate) {
        freeCandidatesCount += 1;
      }
    }

    return {
      account: { ...account, argonStatus },
      isActiveEligibility,
      isArgonPriority,
      argonQuotaPct,
      matches,
      primaryMatch,
      resolvedTier,
      tierSource,
      hasConflict,
      conflictFamilyNames,
      isStale,
      isFreeCandidate,
      isNearExpiryWithQuota,
      highestQuotaPct,
    };
  });

  const uniqueProPct =
    activeEligibleCount > 0 ? Math.round((uniqueProCount / activeEligibleCount) * 100) : 0;

  return {
    views,
    conflicts,
    metrics: {
      totalAccounts: cockpitAccounts.length,
      activeEligibleCount,
      uniqueProCount,
      uniqueProPct,
      freeCandidatesCount,
      conflictGroupsCount: conflicts.length,
      conflictAccountsCount,
      noArgonCount,
      needVerifCount,
      bannedCount,
      untaggedCount,
      isAnyStale,
      latestSyncedAt,
    },
  };
}

/**
 * Menghasilkan daftar rekomendasi Family PRO untuk akun FREE (BR-02, BR-03, BR-04):
 * - Family aktif (tidak banned, tidak archived, tidak expired/bermasalah)
 * - Slot anggota < MAX_FAMILY_SLOTS (5)
 * - Belum ditempati oleh akun Cockpit aktif ('bisa' | 'untagged') mana pun (BR-02)
 * - Target email belum ada di family tersebut
 * - Diurutkan: Google Drive terhubung dulu -> sisa storage terbesar -> slot terbanyak
 */
export function getRecommendedFamiliesForAccount(
  targetAccount: CockpitAccount,
  cockpitAccounts: CockpitAccount[],
  families: Family[],
  connectedAccounts: ConnectedAccount[] = [],
): RecommendedFamily[] {
  const targetEmail = normalizeEmail(targetAccount.email);
  const targetIsPriority = isPriorityCockpitAccount(
    targetAccount.eligibilityStatus,
    targetAccount.argonStatus ?? 'unknown',
  );
  const priorityCockpitEmails = new Set(
    cockpitAccounts
      .filter((a) => isPriorityCockpitAccount(a.eligibilityStatus, a.argonStatus ?? 'unknown'))
      .map((a) => normalizeEmail(a.email)),
  );

  const results: RecommendedFamily[] = [];

  for (const family of families) {
    if (!isFamilyActiveForPro(family, connectedAccounts, families)) continue;

    const slotsUsed = getSlotsUsed(family);
    const slotsAvailable = getSlotsAvailable(family);
    if (slotsUsed >= MAX_FAMILY_SLOTS || slotsAvailable <= 0) continue;

    const familyEmails = new Set<string>();
    const ownerEmail = normalizeEmail(family.ownerEmail);
    if (ownerEmail) familyEmails.add(ownerEmail);
    for (const m of family.members || []) {
      const mEmail = normalizeEmail(m.email);
      if (mEmail) familyEmails.add(mEmail);
    }

    // Target tidak boleh sudah berada di family ini
    if (familyEmails.has(targetEmail)) continue;

    // BR-02: Family harus bebas dari akun Cockpit prioritas (bukan No Argon) lain.
    // Jika target sendiri adalah No Argon, boleh bergabung di Family mana pun selama slot tersedia.
    if (targetIsPriority) {
      let hasOtherPriorityAccount = false;
      for (const em of familyEmails) {
        if (em !== targetEmail && priorityCockpitEmails.has(em)) {
          hasOtherPriorityAccount = true;
          break;
        }
      }
      if (hasOtherPriorityAccount) continue;
    }

    const storage = getFamilyStorageSummary(family, connectedAccounts);
    const daysRemaining = getDaysRemaining(family.expiryDate ?? null);

    results.push({
      family,
      slotsUsed,
      slotsAvailable,
      hasLiveDrive: storage.hasLiveDrive,
      isUnlimitedDrive: storage.isUnlimitedDrive,
      availableBytes: storage.availableBytes,
      totalBytes: storage.totalBytes,
      isStorageLega: storage.isStorageLega,
      storageLabel: storage.storageLabel,
      daysRemaining,
    });
  }

  // BR-04: Drive terhubung dulu -> Unlimited / availableBytes desc -> slotsAvailable desc -> expiry furthest
  return results.sort((a, b) => {
    if (a.hasLiveDrive !== b.hasLiveDrive) return a.hasLiveDrive ? -1 : 1;
    if (a.isUnlimitedDrive !== b.isUnlimitedDrive) return a.isUnlimitedDrive ? -1 : 1;
    if (b.availableBytes !== a.availableBytes) return b.availableBytes - a.availableBytes;
    if (b.slotsAvailable !== a.slotsAvailable) return b.slotsAvailable - a.slotsAvailable;
    const daysA = a.daysRemaining ?? -1;
    const daysB = b.daysRemaining ?? -1;
    return daysB - daysA;
  });
}

export function filterAndSortCockpitViews(
  views: CockpitAccountView[],
  filter: CockpitFilterKey,
  sortBy: CockpitSortKey,
  searchQuery: string,
): CockpitAccountView[] {
  const q = searchQuery.trim().toLowerCase();

  const filtered = views.filter((v) => {
    if (filter === 'free_candidates' && !v.isFreeCandidate) return false;
    if (filter === 'in_pro_family' && !(v.resolvedTier === 'PRO' && v.isArgonPriority)) {
      return false;
    }
    if (filter === 'conflicts' && !v.hasConflict) return false;
    if (filter === 'no_argon' && !(v.isActiveEligibility && v.account.argonStatus === 'missing')) {
      return false;
    }
    if (filter === 'need_verif' && v.account.eligibilityStatus !== 'need_verif') return false;
    if (filter === 'banned' && v.account.eligibilityStatus !== 'ban') return false;
    if (filter === 'untagged' && v.account.eligibilityStatus !== 'untagged') return false;

    if (q) {
      const inEmail = v.account.email.toLowerCase().includes(q);
      const inFamily = v.matches.some(
        (m) =>
          m.familyName.toLowerCase().includes(q) || m.ownerEmail.toLowerCase().includes(q),
      );
      const inTags = v.account.rawTags.some((t) => t.toLowerCase().includes(q));
      if (!inEmail && !inFamily && !inTags) return false;
    }

    return true;
  });

  const priorityRank = (v: CockpitAccountView): number => {
    if (v.hasConflict) return 0;
    if (v.isFreeCandidate) return 1;
    if (v.account.eligibilityStatus === 'need_verif') return 2;
    if (v.account.isCurrent && v.isArgonPriority) return 3;
    if (v.resolvedTier === 'PRO' && v.isArgonPriority) return 4;
    if (v.isActiveEligibility && !v.isArgonPriority) return 5; // No Argon (tidak diprioritaskan)
    return 6; // ban
  };

  return [...filtered].sort((a, b) => {
    if (sortBy === 'priority') {
      const diff = priorityRank(a) - priorityRank(b);
      if (diff !== 0) return diff;
      // Di antara akun PRO prioritas, utamakan yang sudah terkonfirmasi punya kuota Argon
      const argonBonusA = a.account.argonStatus === 'available' ? 0 : 1;
      const argonBonusB = b.account.argonStatus === 'available' ? 0 : 1;
      if (argonBonusA !== argonBonusB) return argonBonusA - argonBonusB;
      return a.account.email.localeCompare(b.account.email);
    }
    if (sortBy === 'expiry_asc') {
      const daysA = a.primaryMatch?.daysRemaining ?? Number.POSITIVE_INFINITY;
      const daysB = b.primaryMatch?.daysRemaining ?? Number.POSITIVE_INFINITY;
      if (daysA !== daysB) return daysA - daysB;
      return a.account.email.localeCompare(b.account.email);
    }
    if (sortBy === 'quota_desc') {
      const aArgon = a.argonQuotaPct ?? -1;
      const bArgon = b.argonQuotaPct ?? -1;
      if (bArgon !== aArgon) return bArgon - aArgon;
      const qA = a.highestQuotaPct ?? -1;
      const qB = b.highestQuotaPct ?? -1;
      if (qB !== qA) return qB - qA;
      return a.account.email.localeCompare(b.account.email);
    }
    return a.account.email.localeCompare(b.account.email);
  });
}
