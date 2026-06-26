// drive-sync-quota (verify_jwt = true)
// Dipanggil frontend authed. Refresh access token bila perlu, panggil Drive about.get,
// update quota + last_synced_at. Body: { accountId } untuk satu akun, atau { all: true }.

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { serviceClient, userClient } from "../_shared/supabase.ts";
import { getDriveQuota, refreshAccessToken } from "../_shared/google.ts";
import { decrypt, encrypt } from "../_shared/crypto.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

interface AccountRow {
  id: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUser = userClient(req);
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) return jsonResponse({ error: "Unauthorized" }, 401, cors);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const svc = serviceClient();

    // Ownership ditegakkan via filter user_id (service role bypass RLS).
    let query = svc
      .from("connected_accounts")
      .select("id, access_token_encrypted, refresh_token_encrypted, token_expires_at")
      .eq("user_id", user.id)
      .eq("provider", "google_drive")
      .eq("status", "connected");

    if (!body.all) {
      if (!body.accountId) {
        return jsonResponse({ error: "accountId required" }, 400, cors);
      }
      query = query.eq("id", String(body.accountId));
    }

    const { data: accounts, error: accErr } = await query;
    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      return jsonResponse({ error: "No accounts to sync" }, 404, cors);
    }

    const results = [];
    for (const acc of accounts as AccountRow[]) {
      try {
        const quota = await syncOne(svc, acc);
        results.push({ id: acc.id, ok: true, ...quota });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        results.push({ id: acc.id, ok: false, error: message });
      }
    }

    return jsonResponse({ results }, 200, cors);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[drive-sync-quota]", message);
    return jsonResponse({ error: message }, 500, cors);
  }
});

async function syncOne(svc: SupabaseClient, acc: AccountRow) {
  const now = Date.now();
  const expiresAt = acc.token_expires_at
    ? new Date(acc.token_expires_at).getTime()
    : 0;

  let accessToken: string;
  // Pakai access token tersimpan bila masih valid >60s; selain itu refresh.
  if (acc.access_token_encrypted && expiresAt > now + 60_000) {
    accessToken = await decrypt(acc.access_token_encrypted);
  } else {
    if (!acc.refresh_token_encrypted) {
      throw new Error("No refresh token stored; reconnect required");
    }
    const refreshToken = await decrypt(acc.refresh_token_encrypted);
    let refreshed;
    try {
      refreshed = await refreshAccessToken(refreshToken);
    } catch (e) {
      // Refresh token dicabut/invalid -> tandai disconnected supaya UI minta reconnect.
      await svc.from("connected_accounts")
        .update({ status: "disconnected" })
        .eq("id", acc.id);
      throw e;
    }
    accessToken = refreshed.access_token;
    const newExpiry = new Date(
      now + Number(refreshed.expires_in ?? 3600) * 1000,
    ).toISOString();
    await svc.from("connected_accounts")
      .update({
        access_token_encrypted: await encrypt(accessToken),
        token_expires_at: newExpiry,
      })
      .eq("id", acc.id);
  }

  const quota = await getDriveQuota(accessToken);
  await svc.from("connected_accounts")
    .update({ ...quota, last_synced_at: new Date().toISOString() })
    .eq("id", acc.id);
  return quota;
}
