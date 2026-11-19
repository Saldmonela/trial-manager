import { describe, expect, it } from 'vitest';
import {
  addCalendarMonths,
  computeAccountCooldown,
  computeFamilyDowngradeImpact,
  evaluateCooldownActionWarning,
} from '../cooldownLogic';
import {
  buildCockpitOverview,
  getRecommendedFamiliesForAccount,
  isFamilyActiveForPro,
} from '../cockpitLogic';
import { validateManualHistoryInput } from '../../hooks/useAccountFamilyHistory';
import type { AccountFamilyHistoryEntry, CockpitAccount, Family } from '../../types';

function makeEntry(
  overrides: Partial<AccountFamilyHistoryEntry> & { id: string; accountEmail: string },
): AccountFamilyHistoryEntry {
  return {
    familyId: 'fam-1',
    familyNameSnapshot: 'Family PRO #1',
    familyOwnerEmailSnapshot: 'owner1@gmail.com',
    memberId: null,
    joinedAt: '2026-01-10T05:00:00.000Z',
    leftAt: null,
    source: 'manual',
    leaveReason: 'still_active',
    countsForCooldown: true,
    overrideReasonType: null,
    overrideNote: null,
    notes: null,
    ...overrides,
  };
}

describe('cooldownLogic — Calendar & 12-Month Google Family Cooldown', () => {
  it('handles leap year & month-end clamping on addCalendarMonths (NF-06)', () => {
    expect(addCalendarMonths('2026-03-16', 12)).toBe('2027-03-16');
    expect(addCalendarMonths('2028-02-29', 12)).toBe('2029-02-28');
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('computes all 4 cooldown statuses accurately (AC-02-01)', () => {
    const email = 'akun1@gmail.com';

    // 1. Belum pernah gabung
    const never = computeAccountCooldown(email, [], '2026-06-01');
    expect(never.status).toBe('never_joined');
    expect(never.switchesInLast12m).toBe(0);

    // 2. Aktif di Family ke-1 -> Aman sisa 1x pindah
    const first = computeAccountCooldown(
      email,
      [makeEntry({ id: 'h1', accountEmail: email, joinedAt: '2026-01-10' })],
      '2026-06-01',
    );
    expect(first.status).toBe('safe_first_family');
    expect(first.switchesInLast12m).toBe(0);
    expect(first.firstFamilyName).toBe('Family PRO #1');

    // 3. Sudah keluar dari Family ke-1 -> Siap masuk Family ke-2
    const leftFirst = computeAccountCooldown(
      email,
      [
        makeEntry({
          id: 'h1',
          accountEmail: email,
          joinedAt: '2026-01-10',
          leftAt: '2026-03-15',
          leaveReason: 'family_downgraded_free',
        }),
      ],
      '2026-06-01',
    );
    expect(leftFirst.status).toBe('ready_last_switch');
    expect(leftFirst.switchesInLast12m).toBe(0);

    // 4. Sudah pindah ke Family ke-2 -> Cooldown Aktif 12 bulan sejak joinedAt Family ke-2 (OQ-01)
    const switched = computeAccountCooldown(
      email,
      [
        makeEntry({
          id: 'h1',
          accountEmail: email,
          familyId: 'fam-1',
          familyNameSnapshot: 'Family A',
          familyOwnerEmailSnapshot: 'ownerA@gmail.com',
          joinedAt: '2026-01-10',
          leftAt: '2026-03-15',
        }),
        makeEntry({
          id: 'h2',
          accountEmail: email,
          familyId: 'fam-2',
          familyNameSnapshot: 'Family B',
          familyOwnerEmailSnapshot: 'ownerB@gmail.com',
          joinedAt: '2026-03-16',
          leftAt: null,
        }),
      ],
      '2026-06-01',
    );
    expect(switched.status).toBe('cooldown_active');
    expect(switched.switchesInLast12m).toBe(1);
    expect(switched.cooldownEndsAt).toBe('2027-03-16');
    expect(switched.lastSwitchFromFamily).toBe('Family A');
    expect(switched.lastSwitchToFamily).toBe('Family B');
  });

  it('recovers automatically on exact 12-month boundary date (AC-02-01 boundary)', () => {
    const email = 'boundary@gmail.com';
    const entries = [
      makeEntry({
        id: 'h1',
        accountEmail: email,
        familyId: 'fam-1',
        familyNameSnapshot: 'Family A',
        joinedAt: '2026-01-10',
        leftAt: '2026-03-15',
      }),
      makeEntry({
        id: 'h2',
        accountEmail: email,
        familyId: 'fam-2',
        familyNameSnapshot: 'Family B',
        familyOwnerEmailSnapshot: 'owner2@gmail.com',
        joinedAt: '2026-03-16',
        leftAt: null,
      }),
    ];

    // H-1 sebelum bebas: masih cooldown 1 hari lagi & isUnlockingSoon = true
    const dayBefore = computeAccountCooldown(email, entries, '2027-03-15');
    expect(dayBefore.status).toBe('cooldown_active');
    expect(dayBefore.cooldownDaysRemaining).toBe(1);
    expect(dayBefore.isUnlockingSoon).toBe(true);

    // Tepat pada tanggal bebas (12 bulan kalender): pulih jadi safe_first_family
    const exactDay = computeAccountCooldown(email, entries, '2027-03-16');
    expect(exactDay.status).toBe('safe_first_family');
    expect(exactDay.switchesInLast12m).toBe(0);
    expect(exactDay.cooldownEndsAt).toBeNull();
  });

  it('triggers US-09 unlocking soon only when 1..14 days remain', () => {
    const email = 'soon@gmail.com';
    const entries = [
      makeEntry({
        id: 'h1',
        accountEmail: email,
        familyId: 'fam-1',
        joinedAt: '2026-01-10',
        leftAt: '2026-03-15',
      }),
      makeEntry({
        id: 'h2',
        accountEmail: email,
        familyId: 'fam-2',
        familyOwnerEmailSnapshot: 'owner2@gmail.com',
        joinedAt: '2026-03-16',
        leftAt: null,
      }),
    ];

    expect(computeAccountCooldown(email, entries, '2027-03-02').isUnlockingSoon).toBe(true); // 14 hari
    expect(computeAccountCooldown(email, entries, '2027-03-01').isUnlockingSoon).toBe(false); // 15 hari
  });

  it('ignores local_correction entries (BR-04) and same-family re-joins (OQ-02)', () => {
    const email = 'clean@gmail.com';

    // Koreksi lokal pada Family B tidak memicu cooldown
    const withLocalCorrection = computeAccountCooldown(
      email,
      [
        makeEntry({
          id: 'h1',
          accountEmail: email,
          familyId: 'fam-1',
          joinedAt: '2026-01-10',
          leftAt: '2026-03-15',
        }),
        makeEntry({
          id: 'h2',
          accountEmail: email,
          familyId: 'fam-2',
          familyOwnerEmailSnapshot: 'owner2@gmail.com',
          joinedAt: '2026-03-16',
          leftAt: '2026-03-16',
          countsForCooldown: false,
          leaveReason: 'local_correction',
        }),
      ],
      '2026-06-01',
    );
    expect(withLocalCorrection.status).toBe('ready_last_switch');
    expect(withLocalCorrection.switchesInLast12m).toBe(0);

    // Masuk lagi ke Family A yang sama persis tidak dihitung Switch (OQ-02)
    const sameFamilyRejoin = computeAccountCooldown(
      email,
      [
        makeEntry({
          id: 'h1',
          accountEmail: email,
          familyId: 'fam-1',
          joinedAt: '2026-01-10',
          leftAt: '2026-03-15',
        }),
        makeEntry({
          id: 'h2',
          accountEmail: email,
          familyId: 'fam-1',
          joinedAt: '2026-04-01',
          leftAt: null,
        }),
      ],
      '2026-06-01',
    );
    expect(sameFamilyRejoin.status).toBe('safe_first_family');
    expect(sameFamilyRejoin.switchesInLast12m).toBe(0);
  });

  it('returns fail-safe warning when history failed to load (NF-04, AC-03-04)', () => {
    const res = evaluateCooldownActionWarning({
      summary: null,
      action: 'leave',
      currentFamilyName: 'Family A',
      historyLoadError: 'Network error',
    });
    expect(res.level).toBe('fail_safe_unverified');
    expect(res.requiresExplicitOverride).toBe(true);
  });

  it('separates safeToMove vs cooldownLocked in Family downgrade impact (US-06)', () => {
    const family: Family = {
      id: 'fam-down',
      name: 'Family PRO Turun',
      ownerEmail: 'owner-down@gmail.com',
      planStatus: 'downgraded_free',
      members: [
        { id: 'm1', family_id: 'fam-down', name: 'Aman', email: 'aman@gmail.com', added_at: '2026-01-10', member_type: 'pribadi' },
        { id: 'm2', family_id: 'fam-down', name: 'Locked', email: 'locked@gmail.com', added_at: '2026-03-16', member_type: 'pribadi' },
        { id: 'm3', family_id: 'fam-down', name: 'Buyer', email: 'buyer@gmail.com', added_at: '2026-03-16', member_type: 'pembeli' },
      ],
    };

    const history: AccountFamilyHistoryEntry[] = [
      makeEntry({ id: 'a1', accountEmail: 'aman@gmail.com', familyId: 'fam-down', joinedAt: '2026-01-10' }),
      makeEntry({ id: 'l1', accountEmail: 'locked@gmail.com', familyId: 'fam-old', familyOwnerEmailSnapshot: 'old@gmail.com', joinedAt: '2026-01-05', leftAt: '2026-03-15' }),
      makeEntry({ id: 'l2', accountEmail: 'locked@gmail.com', familyId: 'fam-down', familyOwnerEmailSnapshot: 'owner-down@gmail.com', joinedAt: '2026-03-16' }),
    ];

    const impact = computeFamilyDowngradeImpact({
      family,
      historyEntries: history,
      now: '2026-06-01',
    });

    expect(impact.totalPersonalAccounts).toBe(2); // Buyer tidak ikut dihitung
    expect(impact.safeToMove.map((a) => a.email)).toEqual(['aman@gmail.com']);
    expect(impact.cooldownLocked.map((a) => a.email)).toEqual(['locked@gmail.com']);
    expect(impact.unverified).toHaveLength(0);
  });

  it('excludes downgraded_free families & prioritizes stability for last-switch accounts (US-06, US-07)', () => {
    const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
    const target: CockpitAccount = {
      id: 'c1',
      email: 'target@gmail.com',
      planTier: 'AUTO_FAMILY',
      eligibilityStatus: 'bisa',
      argonStatus: 'available',
      rawTags: ['bisa'],
      isCurrent: false,
      switchTime: null,
      quotas: [],
      availableAiCredits: null,
      notes: null,
      lastSyncedAt: new Date().toISOString(),
    };

    const families: Family[] = [
      { id: 'f-down', name: 'Downgraded', ownerEmail: 'd@gmail.com', expiryDate: inDays(300), storageUsed: 100, planStatus: 'downgraded_free', members: [] },
      { id: 'f-short', name: 'Short Expiry', ownerEmail: 's@gmail.com', expiryDate: inDays(20), storageUsed: 100, planStatus: 'pro_active', members: [] },
      { id: 'f-long', name: 'Long Expiry', ownerEmail: 'l@gmail.com', expiryDate: inDays(300), storageUsed: 200, planStatus: 'pro_active', members: [] },
    ];

    expect(isFamilyActiveForPro(families[0])).toBe(false);

    const recs = getRecommendedFamiliesForAccount(target, [target], families, [], {
      prioritizeStability: true,
    });
    expect(recs.map((r) => r.family.id)).toEqual(['f-long', 'f-short']);

    // Cockpit overview juga mengenali akun yang berada di downgraded_free
    const famWithTarget: Family[] = [
      {
        ...families[0],
        members: [{ id: 'm1', family_id: 'f-down', name: 'Target', email: 'target@gmail.com', added_at: '2026-01-10', member_type: 'pribadi' }],
      },
    ];
    const overview = buildCockpitOverview([target], famWithTarget, [], Date.now(), []);
    expect(overview.views[0].isInDowngradedFamily).toBe(true);
    expect(overview.views[0].resolvedTier).toBe('FREE');
    expect(overview.metrics.downgradedAffectedCount).toBe(1);
  });

  it('validates manual history input dates & constraints (AC-04-03)', () => {
    expect(
      validateManualHistoryInput({ familyNameSnapshot: '', joinedAt: '2026-01-10' }),
    ).toBe('Nama Family wajib diisi (maksimal 120 karakter).');

    expect(
      validateManualHistoryInput({
        familyNameSnapshot: 'Fam A',
        joinedAt: '2026-03-10',
        leftAt: '2026-03-09',
      }),
    ).toBe('Tanggal keluar tidak boleh lebih awal dari tanggal masuk.');

    expect(
      validateManualHistoryInput({
        familyNameSnapshot: 'Fam A',
        familyOwnerEmailSnapshot: 'bukan-email',
        joinedAt: '2026-01-10',
      }),
    ).toBe('Format email owner Family tidak valid.');

    expect(
      validateManualHistoryInput({
        familyNameSnapshot: 'Fam A',
        joinedAt: '2026-01-10',
        leftAt: '2026-03-15',
        notes: 'Valid note',
      }),
    ).toBeNull();
  });
});
