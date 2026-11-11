import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MAX_FAMILY_SLOTS,
  MAX_STORAGE_GB,
  generateId,
  getSlotsUsed,
  getSlotsAvailable,
  isFamilyFull,
  getDaysRemaining,
  getExpiryStatus,
  EXPIRY_PRESETS,
  FAMILY_EXPIRY_PRESETS,
  getPresetBaseDate,
  addMonthsISODate,
  formatDuration,
} from '../familyUtils';

describe('familyUtils', () => {
  describe('constants', () => {
    it('has correct max slots and storage', () => {
      expect(MAX_FAMILY_SLOTS).toBe(5);
      expect(MAX_STORAGE_GB).toBe(5120);
    });
  });

  describe('generateId', () => {
    it('returns a non-empty string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('returns unique IDs on successive calls', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('getSlotsUsed', () => {
    it('returns 0 for a family with no members', () => {
      expect(getSlotsUsed({ members: [] })).toBe(0);
    });

    it('returns 0 when members is undefined', () => {
      expect(getSlotsUsed({})).toBe(0);
    });

    it('returns member count', () => {
      const family = { members: [{ id: '1' }, { id: '2' }, { id: '3' }] };
      expect(getSlotsUsed(family)).toBe(3);
    });
  });

  describe('getSlotsAvailable', () => {
    it('returns max slots for empty family', () => {
      expect(getSlotsAvailable({ members: [] })).toBe(MAX_FAMILY_SLOTS);
    });

    it('returns 0 when family is full', () => {
      const members = Array.from({ length: MAX_FAMILY_SLOTS }, (_, i) => ({ id: String(i) }));
      expect(getSlotsAvailable({ members })).toBe(0);
    });

    it('clamps to 0 (never negative)', () => {
      const members = Array.from({ length: MAX_FAMILY_SLOTS + 5 }, (_, i) => ({ id: String(i) }));
      expect(getSlotsAvailable({ members })).toBe(0);
    });
  });

  describe('isFamilyFull', () => {
    it('returns false when slots are available', () => {
      expect(isFamilyFull({ members: [] })).toBe(false);
    });

    it('returns true when at max slots', () => {
      const members = Array.from({ length: MAX_FAMILY_SLOTS }, (_, i) => ({ id: String(i) }));
      expect(isFamilyFull({ members })).toBe(true);
    });

    it('returns true when over max slots', () => {
      const members = Array.from({ length: MAX_FAMILY_SLOTS + 2 }, (_, i) => ({ id: String(i) }));
      expect(isFamilyFull({ members })).toBe(true);
    });
  });

  describe('getDaysRemaining', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-13T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns null for empty/undefined expiry', () => {
      expect(getDaysRemaining(null)).toBeNull();
      expect(getDaysRemaining(undefined)).toBeNull();
      expect(getDaysRemaining('')).toBeNull();
    });

    it('returns positive days for future date', () => {
      expect(getDaysRemaining('2026-02-20')).toBe(7);
    });

    it('returns negative days for past date', () => {
      expect(getDaysRemaining('2026-02-10')).toBe(-3);
    });

    it('returns 0 or 1 for today (depending on time)', () => {
      const result = getDaysRemaining('2026-02-13');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('formatDuration', () => {
    it('memakai tahun + bulan untuk sisa panjang', () => {
      // 519 = 1 tahun (365) sisa 154 hari -> 154/30 = 5 bulan
      expect(formatDuration(519)).toBe('1 TAHUN 5 BULAN');
      expect(formatDuration(519, 'en')).toBe('1 YEAR 5 MONTHS');
    });

    it('memakai bulan + hari di bawah setahun', () => {
      expect(formatDuration(309)).toBe('10 BULAN 9 HARI');
      expect(formatDuration(309, 'en')).toBe('10 MONTHS 9 DAYS');
    });

    it('membuang satuan terkecil kalau pas', () => {
      expect(formatDuration(330)).toBe('11 BULAN'); // 330 = 11 x 30, tanpa sisa hari
      expect(formatDuration(730)).toBe('2 TAHUN'); // 730 = 2 x 365, tanpa sisa bulan
      expect(formatDuration(730, 'en')).toBe('2 YEARS');
    });

    it('memakai hari saja di bawah sebulan', () => {
      expect(formatDuration(15)).toBe('15 HARI');
      expect(formatDuration(29, 'en')).toBe('29 DAYS');
      expect(formatDuration(0)).toBe('0 HARI');
    });

    it('memakai bentuk tunggal di bahasa Inggris', () => {
      expect(formatDuration(1, 'en')).toBe('1 DAY');
      expect(formatDuration(30, 'en')).toBe('1 MONTH');
      expect(formatDuration(365, 'en')).toBe('1 YEAR');
      expect(formatDuration(396, 'en')).toBe('1 YEAR 1 MONTH');
    });

    it('jatuh ke bahasa Indonesia untuk bahasa tak dikenal', () => {
      expect(formatDuration(15, 'fr')).toBe('15 HARI');
    });
  });

  describe('getExpiryStatus', () => {
    it('returns gray/no-expiry for null', () => {
      expect(getExpiryStatus(null).color).toBe('gray');
      expect(getExpiryStatus(null).text).toBe('Belum ada tanggal');
      expect(getExpiryStatus(null, 'en').text).toBe('No expiry set');
    });

    it('returns gray for expired (negative days)', () => {
      const status = getExpiryStatus(-5);
      expect(status.color).toBe('gray');
      expect(status.text).toBe('EXPIRED');
    });

    it('returns red for critical (≤3 days)', () => {
      const status = getExpiryStatus(2);
      expect(status.color).toBe('red');
      expect(status.text).toBe('2 HARI');
    });

    it('returns yellow for warning (3-7 days)', () => {
      const status = getExpiryStatus(5);
      expect(status.color).toBe('yellow');
      expect(status.text).toBe('5 HARI');
    });

    it('returns green for healthy (>7 days)', () => {
      const status = getExpiryStatus(15);
      expect(status.color).toBe('green');
      expect(status.text).toBe('15 HARI');
    });

    it('warna tetap dihitung dari jumlah hari, bukan teksnya', () => {
      // Regresi: pastikan ambang batas tidak ikut berubah waktu format diubah.
      expect(getExpiryStatus(519).color).toBe('green');
      expect(getExpiryStatus(3).color).toBe('red');
      expect(getExpiryStatus(7).color).toBe('yellow');
      expect(getExpiryStatus(8).color).toBe('green');
    });
  });

  describe('EXPIRY_PRESETS', () => {
    it('covers 1, 3, 6, 12, and 18 months', () => {
      expect(EXPIRY_PRESETS.map((p) => p.months)).toEqual([1, 3, 6, 12, 18]);
    });
  });

  describe('FAMILY_EXPIRY_PRESETS', () => {
    it('covers +6 months, +1 year, +1.5 years, and +2 years', () => {
      expect(FAMILY_EXPIRY_PRESETS.map((p) => p.months)).toEqual([6, 12, 18, 24]);
      expect(FAMILY_EXPIRY_PRESETS.map((p) => p.label)).toEqual([
        '+6 Bulan',
        '+1 Tahun',
        '+1.5 Tahun',
        '+2 Tahun',
      ]);
    });
  });

  describe('getPresetBaseDate', () => {
    const now = new Date('2026-07-30T10:00:00');
    const addedAt = '2026-07-26T08:00:00';

    it('uses added_at while the member is still active', () => {
      // Salah pilih paket 6 bulan -> koreksi ke 1 tahun tetap dari tanggal berlangganan.
      const base = getPresetBaseDate(addedAt, '2027-01-26T08:00:00', now);
      expect(base.toISOString()).toBe(new Date(addedAt).toISOString());
    });

    it('uses today once the member has expired (renewal)', () => {
      expect(getPresetBaseDate(addedAt, '2026-07-20T08:00:00', now)).toBe(now);
    });

    it('falls back to added_at when no expiry is set', () => {
      const base = getPresetBaseDate(addedAt, null, now);
      expect(base.toISOString()).toBe(new Date(addedAt).toISOString());
    });

    it('falls back to today when added_at is missing', () => {
      expect(getPresetBaseDate(null, null, now)).toBe(now);
      expect(getPresetBaseDate('not-a-date', null, now)).toBe(now);
    });
  });

  describe('addMonthsISODate', () => {
    it('adds whole packages from the base date', () => {
      const base = new Date('2026-07-26T08:00:00');
      expect(addMonthsISODate(base, 1)).toBe('2026-08-26');
      expect(addMonthsISODate(base, 6)).toBe('2027-01-26');
      expect(addMonthsISODate(base, 12)).toBe('2027-07-26');
      expect(addMonthsISODate(base, 18)).toBe('2028-01-26');
    });

    it('clamps to the last day instead of overflowing into the next month', () => {
      expect(addMonthsISODate(new Date('2026-01-31T08:00:00'), 1)).toBe('2026-02-28');
      expect(addMonthsISODate(new Date('2028-01-31T08:00:00'), 1)).toBe('2028-02-29'); // kabisat
      expect(addMonthsISODate(new Date('2026-03-31T08:00:00'), 1)).toBe('2026-04-30');
    });

    it('returns empty string for an invalid base', () => {
      expect(addMonthsISODate(new Date('nope'), 12)).toBe('');
    });
  });
});
