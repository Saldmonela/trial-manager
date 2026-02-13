import { describe, it, expect } from 'vitest';
import { encryptPassword, decryptPassword, isEncrypted } from '../crypto';

const PASSPHRASE = 'test-user-uuid-1234';

describe('crypto', () => {
  describe('encryptPassword', () => {
    it('returns a base64 string with minimum length (salt + iv + ciphertext)', async () => {
      const result = await encryptPassword('mySecret123', PASSPHRASE);
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThanOrEqual(40);
      // Verify it is valid base64
      expect(() => atob(result)).not.toThrow();
    });

    it('produces different ciphertexts for the same input (random salt/iv)', async () => {
      const a = await encryptPassword('samePassword', PASSPHRASE);
      const b = await encryptPassword('samePassword', PASSPHRASE);
      expect(a).not.toBe(b);
    });

    it('returns original value when plaintext is empty', async () => {
      const result = await encryptPassword('', PASSPHRASE);
      expect(result).toBe('');
    });

    it('returns original value when passphrase is empty', async () => {
      const result = await encryptPassword('hello', '');
      expect(result).toBe('hello');
    });
  });

  describe('decryptPassword', () => {
    it('roundtrip: encrypt then decrypt returns the original plaintext', async () => {
      const original = 'SuperSecret!@#$%^&*()_+日本語';
      const encrypted = await encryptPassword(original, PASSPHRASE);
      const decrypted = await decryptPassword(encrypted, PASSPHRASE);
      expect(decrypted).toBe(original);
    });

    it('fails gracefully with wrong passphrase (returns original ciphertext)', async () => {
      const encrypted = await encryptPassword('secret', PASSPHRASE);
      const result = await decryptPassword(encrypted, 'wrong-passphrase');
      // Should return the encrypted value as-is (backward compat behavior)
      expect(result).toBe(encrypted);
    });

    it('returns original value for non-encrypted input (backward compatibility)', async () => {
      const plaintext = 'plaintext-password';
      const result = await decryptPassword(plaintext, PASSPHRASE);
      expect(result).toBe(plaintext);
    });

    it('returns original value when inputs are empty', async () => {
      expect(await decryptPassword('', PASSPHRASE)).toBe('');
      expect(await decryptPassword('something', '')).toBe('something');
    });
  });

  describe('isEncrypted', () => {
    it('returns true for a valid encrypted string', async () => {
      const encrypted = await encryptPassword('test', PASSPHRASE);
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('returns false for short strings', () => {
      expect(isEncrypted('abc')).toBe(false);
      expect(isEncrypted('shortpass')).toBe(false);
    });

    it('returns false for empty or null-ish values', () => {
      expect(isEncrypted('')).toBe(false);
      // @ts-expect-error testing null input
      expect(isEncrypted(null)).toBe(false);
      // @ts-expect-error testing undefined input
      expect(isEncrypted(undefined)).toBe(false);
    });

    it('returns false for non-base64 strings even if long enough', () => {
      const nonBase64 = 'this is definitely not base64!!! $$$ %%% ^^^';
      expect(isEncrypted(nonBase64)).toBe(false);
    });
  });
});
