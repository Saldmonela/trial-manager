// Helper Google OAuth 2.0 + Drive API (quota only).
// Scope minimal untuk membaca storageQuota via about.get = drive.metadata.readonly (non-sensitive).

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const ABOUT_URL =
  "https://www.googleapis.com/drive/v3/about?fields=storageQuota,user";

export const DRIVE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

// Gagal-cepat dengan pesan jelas kalau secret belum di-set, supaya kita TIDAK
// pernah membangun URL consent berisi "undefined" (yang ditolak Google = error 400).
function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) {
    throw new Error(
      `Server misconfigured: secret "${name}" belum di-set. ` +
        `Jalankan: supabase secrets set ${name}=...`,
    );
  }
  return v;
}

const clientId = () => requireEnv("GOOGLE_CLIENT_ID");
const clientSecret = () => requireEnv("GOOGLE_CLIENT_SECRET");
const redirectUri = () => requireEnv("GOOGLE_OAUTH_REDIRECT_URI");

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export interface GoogleProfile {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface QuotaRow {
  total_bytes: number | null; // null = unlimited
  used_bytes: number;
  available_bytes: number | null;
  trash_bytes: number;
}

/**
 * URL consent. access_type=offline + prompt=consent menjamin refresh token selalu didapat.
 * loginHint (opsional): email yang disarankan Google di pemilih akun (dipakai saat connect
 * dari kartu family agar admin memilih akun Google yang cocok dengan owner email).
 */
export function buildConsentUrl(state: string, loginHint?: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: DRIVE_SCOPES.join(" "),
    access_type: "offline",
    // select_account: selalu tampilkan pemilih akun supaya bisa connect akun Google
    //   yang BERBEDA tiap kali (inti fitur multi-akun).
    // consent: jamin refresh token selalu diberikan.
    prompt: "select_account consent",
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

export async function getUserInfo(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`UserInfo failed: ${res.status}`);
  return await res.json();
}

export async function getDriveQuota(accessToken: string): Promise<QuotaRow> {
  const res = await fetch(ABOUT_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Drive about.get failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return computeQuota(json.storageQuota ?? {});
}

/**
 * storageQuota mengembalikan bytes sebagai string int64 -> bungkus Number().
 * `limit` HILANG bila akun unlimited -> total_bytes=null, available_bytes=null.
 */
export function computeQuota(
  sq: Record<string, string | undefined>,
): QuotaRow {
  const used = Number(sq.usage ?? 0);
  const trash = Number(sq.usageInDriveTrash ?? 0);
  const hasLimit = sq.limit !== undefined && sq.limit !== null;
  const total = hasLimit ? Number(sq.limit) : null;
  const available = total === null ? null : Math.max(0, total - used);
  return {
    total_bytes: total,
    used_bytes: used,
    available_bytes: available,
    trash_bytes: trash,
  };
}
