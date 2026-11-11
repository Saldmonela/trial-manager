import { ApiError } from './api.ts';

const encoder = new TextEncoder();
function encode(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }
function decode(value: string): Uint8Array<ArrayBuffer> { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
async function key(): Promise<CryptoKey> {
  const raw = Deno.env.get('FAMILY_CREDENTIAL_KEY_V1');
  if (!raw) throw new ApiError('KEY_UNAVAILABLE', 'Penyimpanan kredensial belum dikonfigurasi.', 503);
  let bytes: Uint8Array<ArrayBuffer>;
  try { bytes = decode(raw); } catch { throw new ApiError('KEY_UNAVAILABLE', 'Kunci kredensial tidak valid.', 503); }
  if (bytes.length !== 32) throw new ApiError('KEY_UNAVAILABLE', 'Kunci kredensial tidak valid.', 503);
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptCredential(value: string, familyId: string): Promise<string> {
  if (!value) throw new ApiError('PASSWORD_REQUIRED', 'Password wajib diisi.');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(`family:${familyId}:v1`) }, await key(), encoder.encode(value)));
  const bytes = new Uint8Array(iv.length + ciphertext.length); bytes.set(iv); bytes.set(ciphertext, iv.length);
  return `v1:${encode(bytes)}`;
}
export async function decryptCredential(value: string, familyId: string): Promise<string> {
  if (!value.startsWith('v1:')) throw new ApiError('UNREADABLE_CREDENTIAL', 'Format password tidak didukung.', 409);
  try {
    const bytes = decode(value.slice(3));
    const result = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: encoder.encode(`family:${familyId}:v1`) }, await key(), bytes.slice(12));
    return new TextDecoder().decode(result);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('UNREADABLE_CREDENTIAL', 'Password tidak dapat dibuka. Masukkan pengganti secara eksplisit.', 409);
  }
}
export async function decryptLegacy(value: string, ownerId: string): Promise<string> {
  // Only a successful authenticated GCM decryption identifies legacy ciphertext.
  // Plaintext-looking values require explicit replacement, never automatic guessing.
  try {
    const bytes = decode(value); if (!ownerId || bytes.length < 44) throw new Error();
    const material = await crypto.subtle.importKey('raw', encoder.encode(ownerId), 'PBKDF2', false, ['deriveKey']);
    const legacyKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: bytes.slice(0, 16), iterations: 100000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(16, 28) }, legacyKey, bytes.slice(28)));
  } catch { throw new ApiError('UNREADABLE_CREDENTIAL', 'Password lama tidak dapat diverifikasi. Masukkan pengganti secara eksplisit.', 409); }
}
