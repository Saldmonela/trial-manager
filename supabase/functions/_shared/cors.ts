// CORS helpers for Edge Functions yang dipanggil dari browser via supabase.functions.invoke.
// Origin direfleksikan dari request supaya jalan di dev (localhost) maupun produksi.
// Aman karena API ini berbasis Bearer token (bukan cookie/credentialed).

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

/** Bangun JSON Response dengan header CORS. */
export function jsonResponse(
  body: unknown,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
