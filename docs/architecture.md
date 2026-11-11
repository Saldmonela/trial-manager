# Architecture

React/Vite renders admin routes only (`/login`, `/admin`, `/storage`). Supabase Auth provides sessions;
profiles.role is the authoritative server-checked admin role. New profiles default to
public; clients cannot insert profiles or change roles.

SQL migrations enforce shared admin metadata access, owner-scoped Drive connections,
member capacity, email uniqueness, immutable order price snapshots and transactionally
consistent approvals. Direct anonymous member/order reads and writes are closed.

The public storefront is retired. Its catalogue, order-creation, status-lookup and
status-code RPCs remain in the schema with their data, but are executable by
service_role only; their Edge Functions and UI are deleted. Admin order RPCs
(payment, transition, settings) still exist and are admin-checked, but nothing in the
frontend calls them. Definer functions use an empty search_path and schema-qualified tables.
Privileged operator functions also check the current admin inside the transaction.

Family list payloads never contain password ciphertext or plaintext. Credential writes,
strict legacy reads and explicit migrations execute on the server, and their SQL
functions are service_role only; the browser has no direct-database fallback. New ciphertext uses
a dedicated 256-bit key, a version prefix and family-specific AES-GCM AAD. Legacy owner
UUIDs and original bytes remain preserved for controlled recovery.

Drive callback is public and forwards authorization code/state to a trusted frontend
fragment without linking an account. Completion requires the initiating admin and
browser nonce, then consumes state atomically. Sync and disconnect enforce connection
ownership and inspect every database write/provider result. Temporary provider failures
do not disconnect accounts; revocation failures do not hide an active grant.

Forms await structured action results, retain failed input, and stay mounted during
metadata refresh. Realtime
does not publish credential/token tables. Quotas are shown per account until shared pool
semantics are verified.

See [Security rollout](security-rollout.md) for schema compatibility, required secrets,
acceptance checks and safe production cutover. Older open-RLS/client-UUID encryption
instructions are obsolete.
