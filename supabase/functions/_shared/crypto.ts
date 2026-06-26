// AES-256-GCM untuk token OAuth — berjalan SERVER-SIDE (Deno) menggunakan Web Crypto.
// Kunci 256-bit diturunkan dari TOKEN_ENCRYPTION_KEY via SHA-256 (key derivation),
// jadi panjang input apa pun aman. Format keluaran: base64( iv(12) + ciphertext+tag ).
//
// Berbeda dengan src/lib/crypto.ts di browser (PBKDF2 dari user-id): di sini kita
// punya kunci rahasia penuh sebagai Edge Function secret, dan refresh token TIDAK PERNAH
// sampai ke browser.

const IV_LENGTH = 12; // 96-bit, rekomendasi AES-GCM

async function importKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(b64: string): Promise<string> {
  const key = await importKey();
  const combined = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}
