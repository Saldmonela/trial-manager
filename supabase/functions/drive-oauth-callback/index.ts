import { serviceClient } from '../_shared/supabase.ts';
import { allowedOrigins, redirectTarget } from '../_shared/origins.ts';
Deno.serve(async req => {
  const url = new URL(req.url); const state = url.searchParams.get('state'); const code = url.searchParams.get('code');
  // Public callback never exchanges codes or writes connected accounts.
  // Only the authenticated initiating browser can finish the exchange.
  try {
    if (!state) throw new Error();
    const { data, error } = await serviceClient().from('oauth_states').select('redirect_to,browser_nonce_hash').eq('state', state).is('consumed_at', null).gt('expires_at', new Date().toISOString()).single();
    if (error || !data?.browser_nonce_hash) throw new Error();
    const target = new URL(data.redirect_to); const destination = redirectTarget(target.origin, target.pathname);
    const fragment = new URLSearchParams(url.searchParams.has('error') || !code ? { drive_error: 'consent_failed' } : { drive_state: state, drive_code: code });
    return new Response(null, { status: 302, headers: { Location: destination + '#' + fragment, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch {
    const origin = allowedOrigins()[0];
    return origin ? Response.redirect(origin + '/storage#drive_error=invalid_state', 302) : new Response('Invalid connection session', { status: 400 });
  }
});
