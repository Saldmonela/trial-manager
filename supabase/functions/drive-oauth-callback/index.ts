// drive-oauth-callback (verify_jwt = false — di-hit oleh redirect Google, tanpa JWT)
// Validasi+consume state -> tukar code -> ambil profil + quota -> enkripsi token ->
// upsert connected_accounts -> 302 balik ke frontend.

import { serviceClient } from "../_shared/supabase.ts";
import {
  DRIVE_SCOPES,
  exchangeCode,
  getDriveQuota,
  getUserInfo,
} from "../_shared/google.ts";
import { encrypt } from "../_shared/crypto.ts";

const FRONTEND_URL = (Deno.env.get("FRONTEND_URL") ?? "").replace(/\/$/, "");

// `target` bisa berupa URL absolut (http://localhost:5173/storage — dari origin yang
// disimpan saat connect) ATAU path relatif (/storage). Untuk path relatif, tempel
// FRONTEND_URL. Ini bikin redirect tahan banting walau FRONTEND_URL salah/kosong.
function redirect(target: string, params: Record<string, string>): Response {
  const isAbsolute = /^https?:\/\//i.test(target);
  const base = isAbsolute ? target : `${FRONTEND_URL}${target}`;
  const qs = new URLSearchParams(params).toString();
  const sep = base.includes("?") ? "&" : "?";
  return Response.redirect(`${base}${qs ? sep + qs : ""}`, 302);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  // Target redirect default sebelum state diketahui. Akan di-update ke
  // stateRow.redirect_to (mis. /admin) begitu state tervalidasi, supaya error
  // setelahnya juga mendarat di halaman yang benar.
  let target = "/storage";

  if (oauthError) return redirect(target, { drive_error: oauthError });
  if (!code || !state) {
    return redirect(target, { drive_error: "missing_code_or_state" });
  }

  try {
    const svc = serviceClient();

    // 1) Validasi + consume state (single-use, belum kadaluarsa)
    const { data: stateRow, error: stateErr } = await svc
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (stateErr) throw stateErr;
    if (!stateRow) return redirect(target, { drive_error: "invalid_state" });

    await svc.from("oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("state", state);

    const redirectTo: string = stateRow.redirect_to || "/storage";
    target = redirectTo;

    // 2) Tukar code -> tokens
    const tokens = await exchangeCode(code);
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const expiresIn = Number(tokens.expires_in ?? 3600);
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 3) Ambil profil + quota
    const [profile, quota] = await Promise.all([
      getUserInfo(accessToken),
      getDriveQuota(accessToken),
    ]);

    // 4) Enkripsi token (server-side)
    const accessEnc = await encrypt(accessToken);
    const refreshEnc = refreshToken ? await encrypt(refreshToken) : null;

    // 5) Upsert connected_accounts (pertahankan refresh token lama bila absen saat re-consent)
    const row: Record<string, unknown> = {
      user_id: stateRow.user_id,
      provider: "google_drive",
      provider_account_id: profile.sub,
      email: profile.email ?? null,
      display_name: profile.name ?? null,
      avatar_url: profile.picture ?? null,
      access_token_encrypted: accessEnc,
      token_expires_at: tokenExpiresAt,
      scopes: DRIVE_SCOPES,
      status: "connected",
      ...quota,
      last_synced_at: new Date().toISOString(),
    };
    if (refreshEnc) row.refresh_token_encrypted = refreshEnc;

    const { data: existing } = await svc
      .from("connected_accounts")
      .select("id")
      .eq("user_id", stateRow.user_id)
      .eq("provider", "google_drive")
      .eq("provider_account_id", profile.sub)
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await svc
        .from("connected_accounts")
        .update(row)
        .eq("id", existing.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await svc.from("connected_accounts").insert(row);
      if (insErr) throw insErr;
    }

    return redirect(redirectTo, { drive_connected: "1" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[drive-oauth-callback]", message);
    return redirect(target, { drive_error: "callback_failed" });
  }
});
