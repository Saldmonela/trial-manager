/**
 * Client-side AES-256-GCM encryption/decryption for sensitive fields.
 * Uses the Web Crypto API (zero dependencies).
 *
 * The user's Supabase user ID is used as the passphrase for key derivation,
 * meaning only the authenticated user can decrypt their stored passwords.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const SALT_LENGTH = 16;
const ITERATIONS = 100_000;

/**
 * Derives a CryptoKey from a passphrase using PBKDF2.
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The text to encrypt
 * @param passphrase - The passphrase (e.g. user's ID)
 * @returns Base64-encoded string: salt(16) + iv(12) + ciphertext
 */
export async function encryptPassword(plaintext: string, passphrase: string): Promise<string> {
  if (!plaintext || !passphrase) return plaintext;

  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );

  // Combine: salt + iv + ciphertext → single Uint8Array → base64
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 *
 * @param encryptedB64 - Base64-encoded encrypted data (salt + iv + ciphertext)
 * @param passphrase - The passphrase used during encryption
 * @returns The decrypted plaintext
 */
export async function decryptPassword(encryptedB64: string, passphrase: string): Promise<string> {
  if (!encryptedB64 || !passphrase) return encryptedB64;

  try {
    const combined = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));

    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

    const key = await deriveKey(passphrase, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    // If decryption fails (e.g. data is not encrypted / legacy plaintext),
    // return the original value as-is. This provides backward compatibility
    // during the migration period.
    return encryptedB64;
  }
}

/**
 * Checks if a string looks like it might be encrypted (base64 with minimum length).
 * Used to detect legacy plaintext passwords that haven't been migrated yet.
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 40) return false; // salt(16) + iv(12) + at least a few bytes
  try {
    atob(value);
    return true;
  } catch {
    return false;
  }
}
