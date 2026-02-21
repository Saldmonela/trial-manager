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
} from '../familyUtils';

describe('familyUtils', () => {
  describe('constants', () => {
    it('has correct max slots and storage', () => {
      expect(MAX_FAMILY_SLOTS).toBe(5);
      expect(MAX_STORAGE_GB).toBe(2048);
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

  describe('getExpiryStatus', () => {
    it('returns gray/no-expiry for null', () => {
      const status = getExpiryStatus(null);
      expect(status.color).toBe('gray');
      expect(status.text).toContain('No expiry set');
    });

    it('returns gray for expired (negative days)', () => {
      const status = getExpiryStatus(-5);
      expect(status.color).toBe('gray');
      expect(status.text).toContain('EXPIRED');
    });

    it('returns red for critical (≤3 days)', () => {
      const status = getExpiryStatus(2);
      expect(status.color).toBe('red');
      expect(status.text).toContain('2 DAYS LEFT');
    });

    it('returns yellow for warning (3-7 days)', () => {
      const status = getExpiryStatus(5);
      expect(status.color).toBe('yellow');
      expect(status.text).toContain('5 DAYS LEFT');
    });

    it('returns green for healthy (>7 days)', () => {
      const status = getExpiryStatus(15);
      expect(status.color).toBe('green');
      expect(status.text).toContain('15 DAYS LEFT');
    });
  });
});
