// drive-connect-url (verify_jwt = true)
// Dipanggil frontend authed. Membuat oauth_state single-use lalu mengembalikan URL consent Google.

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { serviceClient, userClient } from "../_shared/supabase.ts";
import { buildConsentUrl } from "../_shared/google.ts";

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // Identitas user dari JWT yang diteruskan supabase.functions.invoke
    const supabaseUser = userClient(req);
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) return jsonResponse({ error: "Unauthorized" }, 401, cors);

    let redirectTo = "/storage";
    let origin = "";
    let loginHint = "";
    try {
      const body = await req.json();
      if (body?.redirectTo) redirectTo = String(body.redirectTo);
      if (body?.origin) origin = String(body.origin);
      if (body?.loginHint) loginHint = String(body.loginHint);
    } catch {
      // tanpa body — pakai default
    }

    // Fallback origin dari header Referer (tempat user menekan Connect).
    if (!origin) {
      const referer = req.headers.get("Referer") ?? req.headers.get("Origin") ?? "";
      if (referer) {
        try {
          origin = new URL(referer).origin;
        } catch {
          // abaikan
        }
      }
    }

    // Simpan origin DI DALAM redirect_to (mis. "http://localhost:5173/storage")
    // supaya callback bisa mengembalikan user ke situs yang BENAR walau
    // FRONTEND_URL salah/placeholder.
    const fullRedirect = origin
      ? `${origin.replace(/\/$/, "")}${redirectTo.startsWith("/") ? "" : "/"}${redirectTo}`
      : redirectTo;

    const state = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;

    const svc = serviceClient();
    const { error: insErr } = await svc.from("oauth_states").insert({
      state,
      user_id: user.id,
      provider: "google_drive",
      redirect_to: fullRedirect,
    });
    if (insErr) throw insErr;

    return jsonResponse({ url: buildConsentUrl(state, loginHint) }, 200, cors);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[drive-connect-url]", message);
    return jsonResponse({ error: message }, 500, cors);
  }
});
