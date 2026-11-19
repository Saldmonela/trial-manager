import { describe, expect, it } from 'vitest';
import {
  CockpitParseError,
  deriveArgonStatus,
  deriveEligibilityStatus,
  parseCockpitExportText,
} from '../cockpitParser';
import {
  COCKPIT_STALE_MS,
  STORAGE_LEGA_MIN_BYTES,
  buildCockpitOverview,
  filterAndSortCockpitViews,
  getRecommendedFamiliesForAccount,
} from '../cockpitLogic';
import type { CockpitAccount, ConnectedAccount, Family } from '../../types';

const NOW = new Date('2026-11-19T12:00:00.000Z').getTime();
const FUTURE_EXPIRY = '2027-01-01T00:00:00.000Z';
const PAST_EXPIRY = '2026-01-01T00:00:00.000Z';
const TB = 1_000_000_000_000;
const GB = 1_000_000_000;

function makeCockpitAccount(overrides: Partial<CockpitAccount> & { id: string; email: string }): CockpitAccount {
  return {
    planTier: 'AUTO_FAMILY',
    eligibilityStatus: 'bisa',
    argonStatus: 'unknown',
    rawTags: ['bisa'],
    isCurrent: false,
    switchTime: null,
    quotas: [],
    availableAiCredits: null,
    notes: null,
    lastSyncedAt: new Date(NOW - 60_000).toISOString(),
    ...overrides,
  };
}

function makeFamily(overrides: Partial<Family> & { id: string; name: string; ownerEmail: string }): Family {
  return {
    expiryDate: FUTURE_EXPIRY,
    storageUsed: 0,
    isBanned: false,
    isActive: true,
    members: [],
    ...overrides,
  };
}

function makeDrive(overrides: Partial<ConnectedAccount> & { id: string; email: string }): ConnectedAccount {
  return {
    provider: 'google_drive',
    providerAccountId: overrides.id,
    displayName: overrides.email,
    avatarUrl: null,
    status: 'connected',
    totalBytes: 5 * TB,
    usedBytes: 1 * TB,
    availableBytes: 4 * TB,
    trashBytes: 0,
    lastSyncedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

describe('cockpitParser (US-01 & BR-05)', () => {
  it('parses Cockpit Tools export format, strips refresh_token, normalizes emails, and maps all 4 statuses', () => {
    const raw = JSON.stringify([
      { email: '  Qulhu463@Gmail.com ', refresh_token: '1//secret-1' },
      { email: 'qulhu09@gmail.com', refresh_token: '1//secret-2', tags: ['bisa'] },
      { email: 'banned@gmail.com', refresh_token: '1//secret-3', tags: ['ban'] },
      { email: 'verif@gmail.com', refresh_token: '1//secret-4', tags: ['need verif'] },
      { email: 'not-an-email', refresh_token: '1//secret-5', tags: ['bisa'] },
    ]);

    const parsed = parseCockpitExportText(raw);
    expect(parsed.accounts).toHaveLength(4);
    expect(parsed.skipped).toHaveLength(1);
    expect(parsed.strippedSecretFieldsCount).toBe(5);

    const byEmail = new Map(parsed.accounts.map((a) => [a.email, a]));
    expect(byEmail.get('qulhu463@gmail.com')?.eligibility_status).toBe('untagged');
    expect(byEmail.get('qulhu09@gmail.com')?.eligibility_status).toBe('bisa');
    expect(byEmail.get('banned@gmail.com')?.eligibility_status).toBe('ban');
    expect(byEmail.get('verif@gmail.com')?.eligibility_status).toBe('need_verif');

    // BR-05: refresh_token must never appear on sanitized output
    for (const acc of parsed.accounts) {
      expect('refresh_token' in (acc as unknown as Record<string, unknown>)).toBe(false);
    }
  });

  it('prioritizes ban > need_verif > bisa > untagged when multiple tags exist', () => {
    expect(deriveEligibilityStatus(['bisa', 'ban'])).toBe('ban');
    expect(deriveEligibilityStatus(['bisa', 'Need Verif'])).toBe('need_verif');
    expect(deriveEligibilityStatus(['BISA'])).toBe('bisa');
    expect(deriveEligibilityStatus([])).toBe('untagged');
  });

  it('throws exact PRD messages on invalid JSON and empty arrays', () => {
    expect(() => parseCockpitExportText('{broken')).toThrowError(CockpitParseError);
    expect(() => parseCockpitExportText('{broken')).toThrow(
      'Berkas tidak dapat dibaca. Pastikan Anda memilih berkas ekspor yang valid dari Cockpit Tools.',
    );
    expect(() => parseCockpitExportText('[]')).toThrow(
      'Tidak ada data akun yang ditemukan di dalam berkas ini.',
    );
  });
});

describe('cockpitLogic (US-02, US-03, BR-01..BR-06)', () => {
  it('matches case-insensitive emails, detects Konflik Family Ganda (BR-02), and ignores banned accounts in conflicts', () => {
    const accounts: CockpitAccount[] = [
      makeCockpitAccount({ id: 'a1', email: 'salman1@gmail.com', eligibilityStatus: 'bisa' }),
      makeCockpitAccount({ id: 'a2', email: 'salman2@gmail.com', eligibilityStatus: 'untagged', rawTags: [] }),
      makeCockpitAccount({ id: 'a3', email: 'banned@gmail.com', eligibilityStatus: 'ban', rawTags: ['ban'] }),
      makeCockpitAccount({ id: 'a4', email: 'free@gmail.com', eligibilityStatus: 'bisa' }),
      makeCockpitAccount({ id: 'a5', email: 'unique@gmail.com', eligibilityStatus: 'bisa' }),
    ];

    const families: Family[] = [
      makeFamily({
        id: 'fam-conflict',
        name: 'Family Konflik',
        ownerEmail: 'SALMAN1@gmail.com',
        members: [
          { id: 'm1', family_id: 'fam-conflict', name: 'S2', email: 'Salman2@gmail.com', added_at: '' },
        ],
      }),
      makeFamily({
        id: 'fam-clean',
        name: 'Family Clean',
        ownerEmail: 'owner-clean@gmail.com',
        members: [
          { id: 'm2', family_id: 'fam-clean', name: 'Unique', email: 'unique@gmail.com', added_at: '' },
          { id: 'm3', family_id: 'fam-clean', name: 'Banned', email: 'banned@gmail.com', added_at: '' },
        ],
      }),
    ];

    const overview = buildCockpitOverview(accounts, families, [], NOW);

    // fam-conflict has 2 active accounts (bisa + untagged) -> conflict!
    // fam-clean has 1 active + 1 banned -> NOT a conflict!
    expect(overview.conflicts).toHaveLength(1);
    expect(overview.conflicts[0].familyId).toBe('fam-conflict');
    expect(overview.conflicts[0].count).toBe(2);

    // NSM: 1 unique PRO (unique@gmail.com) out of 4 active eligible (a1, a2, a4, a5) = 25%
    expect(overview.metrics.activeEligibleCount).toBe(4);
    expect(overview.metrics.uniqueProCount).toBe(1);
    expect(overview.metrics.uniqueProPct).toBe(25);
    expect(overview.metrics.freeCandidatesCount).toBe(1);
    expect(overview.metrics.bannedCount).toBe(1);
  });

  it('recommends only conflict-free active Family PROs sorted by Drive availability with >= 500 GB Storage Lega (BR-02, BR-03, BR-04)', () => {
    const targetFree = makeCockpitAccount({ id: 'free-1', email: 'qulhu09@gmail.com', eligibilityStatus: 'bisa' });
    const activeOther = makeCockpitAccount({ id: 'pro-1', email: 'qulhu463@gmail.com', eligibilityStatus: 'untagged', rawTags: [] });

    const families: Family[] = [
      // Family A: Drive connected, 1.4 TB available (>= 500 GB -> Storage Lega), 2/5 slots, 0 cockpit accounts
      makeFamily({
        id: 'fam-a',
        name: 'Family A',
        ownerEmail: 'owner-a@gmail.com',
        members: [
          { id: 'ma1', family_id: 'fam-a', name: 'Buyer 1', email: 'b1@gmail.com', added_at: '' },
          { id: 'ma2', family_id: 'fam-a', name: 'Buyer 2', email: 'b2@gmail.com', added_at: '' },
        ],
      }),
      // Family B: Drive connected, 200 GB available (< 500 GB -> not Storage Lega), 1/5 slots, 0 cockpit accounts
      makeFamily({
        id: 'fam-b',
        name: 'Family B',
        ownerEmail: 'owner-b@gmail.com',
        members: [{ id: 'mb1', family_id: 'fam-b', name: 'Buyer', email: 'b3@gmail.com', added_at: '' }],
      }),
      // Family C: Drive connected, 4 TB available, BUT already contains activeOther -> EXCLUDED (BR-02)
      makeFamily({
        id: 'fam-c',
        name: 'Family C (Occupied)',
        ownerEmail: 'owner-c@gmail.com',
        members: [{ id: 'mc1', family_id: 'fam-c', name: 'Active', email: 'qulhu463@gmail.com', added_at: '' }],
      }),
      // Family D: Full (5/5 members) -> EXCLUDED (BR-03)
      makeFamily({
        id: 'fam-d',
        name: 'Family D (Full)',
        ownerEmail: 'owner-d@gmail.com',
        members: Array.from({ length: 5 }, (_, idx) => ({
          id: `md${idx}`,
          family_id: 'fam-d',
          name: `M${idx}`,
          email: `m${idx}@example.com`,
          added_at: '',
        })),
      }),
      // Family E: Expired -> EXCLUDED (BR-03)
      makeFamily({
        id: 'fam-e',
        name: 'Family E (Expired)',
        ownerEmail: 'owner-e@gmail.com',
        expiryDate: PAST_EXPIRY,
      }),
      // Family F: Manual storage (no Drive connected), 3 TB manual -> comes AFTER Drive-connected families (BR-04)
      makeFamily({
        id: 'fam-f',
        name: 'Family F (Manual)',
        ownerEmail: 'owner-f@gmail.com',
        storageUsed: 2000,
      }),
    ];

    const drives: ConnectedAccount[] = [
      makeDrive({ id: 'da', email: 'owner-a@gmail.com', totalBytes: 5 * TB, usedBytes: 3.6 * TB, availableBytes: 1.4 * TB }),
      makeDrive({ id: 'db', email: 'owner-b@gmail.com', totalBytes: 5 * TB, usedBytes: 4.8 * TB, availableBytes: 200 * GB }),
      makeDrive({ id: 'dc', email: 'owner-c@gmail.com', totalBytes: 5 * TB, usedBytes: 1 * TB, availableBytes: 4 * TB }),
    ];

    const recs = getRecommendedFamiliesForAccount(targetFree, [targetFree, activeOther], families, drives);

    expect(recs.map((r) => r.family.id)).toEqual(['fam-a', 'fam-b', 'fam-f']);
    expect(recs[0].isStorageLega).toBe(true);
    expect(recs[0].availableBytes).toBeGreaterThanOrEqual(STORAGE_LEGA_MIN_BYTES);
    expect(recs[1].isStorageLega).toBe(false);
    expect(recs[2].hasLiveDrive).toBe(false);
  });

  it('flags stale data when lastSyncedAt is older than 24 hours (BR-06) and filters correctly', () => {
    const staleAcc = makeCockpitAccount({
      id: 's1',
      email: 'stale@gmail.com',
      lastSyncedAt: new Date(NOW - COCKPIT_STALE_MS - 60_000).toISOString(),
    });
    const overview = buildCockpitOverview([staleAcc], [], [], NOW);
    expect(overview.metrics.isAnyStale).toBe(true);
    expect(overview.views[0].isStale).toBe(true);

    const freeOnly = filterAndSortCockpitViews(overview.views, 'free_candidates', 'priority', 'stale');
    expect(freeOnly).toHaveLength(1);
    const banOnly = filterAndSortCockpitViews(overview.views, 'banned', 'priority', '');
    expect(banOnly).toHaveLength(0);
  });

  it('auto-detects Argon availability from Cockpit Tools native quota.models and tags while stripping token secrets', () => {
    const raw = JSON.stringify([
      {
        email: 'hei.antek2asing@gmail.com',
        token: { access_token: 'secret-access', refresh_token: '1//secret-refresh' },
        tags: ['bisa'],
        quota: {
          subscription_tier: 'PRO',
          models: [
            { name: 'claude:weekly', display_name: 'Claude (Weekly)', percentage: 100, reset_time: '2026-11-26T12:32:00Z' },
            { name: 'argon:weekly', display_name: 'Gemini 4 Argon (Weekly)', percentage: 100, reset_time: '2026-11-26T12:32:00Z' },
          ],
        },
      },
      {
        email: 'salmanlukman0302@gmail.com',
        token: { refresh_token: '1//secret-refresh-2' },
        tags: ['bisa'],
        quota: {
          subscription_tier: 'PRO',
          models: [
            { name: 'claude:weekly', display_name: 'Claude (Weekly)', percentage: 100, reset_time: '2026-11-26T12:35:00Z' },
            { name: 'gemini:weekly', display_name: 'Gemini (Weekly)', percentage: 100, reset_time: '2026-11-26T12:35:00Z' },
          ],
        },
      },
      {
        email: 'tagged-no-argon@gmail.com',
        refresh_token: '1//secret-refresh-3',
        tags: ['bisa', 'no argon'],
      },
    ]);

    const parsed = parseCockpitExportText(raw);
    expect(parsed.accounts).toHaveLength(3);
    expect(parsed.strippedSecretFieldsCount).toBe(3);

    const byEmail = new Map(parsed.accounts.map((a) => [a.email, a]));
    expect(byEmail.get('hei.antek2asing@gmail.com')?.argon_status).toBe('available');
    expect(byEmail.get('hei.antek2asing@gmail.com')?.plan_tier).toBe('PRO');
    expect(byEmail.get('salmanlukman0302@gmail.com')?.argon_status).toBe('missing');
    expect(byEmail.get('tagged-no-argon@gmail.com')?.argon_status).toBe('missing');
    expect(deriveArgonStatus([{ model: 'Gemini 4 Argon (Weekly)', remaining_pct: null, reset_at: null }], [])).toBe('missing');
  });

  it('allows multiple No Argon accounts (2-4) or 1 Argon + No Argon in the same Family without conflict, and deprioritizes No Argon', () => {
    const accounts: CockpitAccount[] = [
      makeCockpitAccount({ id: 'argon-1', email: 'argon1@gmail.com', argonStatus: 'available' }),
      makeCockpitAccount({ id: 'no-argon-1', email: 'noargon1@gmail.com', argonStatus: 'missing' }),
      makeCockpitAccount({ id: 'no-argon-2', email: 'noargon2@gmail.com', argonStatus: 'missing' }),
      makeCockpitAccount({ id: 'no-argon-3', email: 'noargon3@gmail.com', argonStatus: 'missing' }),
      makeCockpitAccount({ id: 'free-argon', email: 'freeargon@gmail.com', argonStatus: 'available' }),
    ];

    const families: Family[] = [
      // 1 Argon + 3 No Argon in the same Family -> MUST NOT be a conflict!
      makeFamily({
        id: 'fam-mixed',
        name: 'Family Mixed',
        ownerEmail: 'argon1@gmail.com',
        members: [
          { id: 'm1', family_id: 'fam-mixed', name: 'NA1', email: 'noargon1@gmail.com', added_at: '' },
          { id: 'm2', family_id: 'fam-mixed', name: 'NA2', email: 'noargon2@gmail.com', added_at: '' },
          { id: 'm3', family_id: 'fam-mixed', name: 'NA3', email: 'noargon3@gmail.com', added_at: '' },
        ],
      }),
      // Only No Argon members -> still eligible as recommendation for a priority Argon FREE account!
      makeFamily({
        id: 'fam-no-argon-only',
        name: 'Family No Argon Only',
        ownerEmail: 'owner-na@gmail.com',
        members: [
          { id: 'm4', family_id: 'fam-no-argon-only', name: 'NA1', email: 'noargon1@gmail.com', added_at: '' },
        ],
      }),
    ];

    const overview = buildCockpitOverview(accounts, families, [], NOW);
    expect(overview.conflicts).toHaveLength(0);
    expect(overview.metrics.noArgonCount).toBe(3);

    // Recommendation for free-argon should INCLUDE fam-no-argon-only (since it has 0 priority Argon accounts)
    // and EXCLUDE fam-mixed (since argon1@gmail.com is already there).
    const recs = getRecommendedFamiliesForAccount(accounts[4], accounts, families, []);
    expect(recs.map((r) => r.family.id)).toEqual(['fam-no-argon-only']);

    // Priority sort: free-argon & argon1 MUST appear before all no-argon accounts
    const sorted = filterAndSortCockpitViews(overview.views, 'all', 'priority', '');
    expect(sorted.slice(0, 2).map((v) => v.account.email)).toEqual([
      'freeargon@gmail.com',
      'argon1@gmail.com',
    ]);
    expect(sorted.slice(2).every((v) => v.account.argonStatus === 'missing')).toBe(true);

    // Filter 'no_argon' returns only the 3 No Argon accounts
    const noArgonOnly = filterAndSortCockpitViews(overview.views, 'no_argon', 'priority', '');
    expect(noArgonOnly).toHaveLength(3);
  });
});
