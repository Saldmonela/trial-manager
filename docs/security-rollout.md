# Security and commerce rollout

## Storefront retirement

As of 2026-11-11 the application is an internal admin tool. The public catalogue,
public ordering, customer status lookup, admin order management, access-code issuing
and the configurable upgrade product were removed from the frontend, and the
create-order, member-status and admin-access-code Edge Functions were deleted.
`supabase/migrations/202611110001_retire_public_storefront.sql` revokes EXECUTE on
app_public_catalog, app_create_order, app_lookup_status and app_issue_status_code from
anon and authenticated. It drops nothing: order history, status codes and settings rows
stay, service_role keeps EXECUTE, and re-granting reverses it.

Sections below that describe public ordering, status codes or commerce activation are
kept as a record of the October design and do not describe the running application.
Apply the November migrations after the October one.

## Production state on 2026-11-11

Inspection showed the October migration was already present in production, so the
grants described above were live. Both November migrations were then applied as plain
SQL (the project's migration history table is empty; earlier migrations were also run
by hand). The three storefront Edge Functions were never deployed there.

save-family and reveal-family-password are deployed. FRONTEND_URL is set to the Vercel
origin; localhost is not an allowed origin unless ALLOWED_FRONTEND_ORIGINS adds it.
FAMILY_CREDENTIAL_KEY_V1 must be set by the operator before a new password can be
saved; revealing legacy passwords does not need it. Every active family still holds a
legacy credential, and one row carries a copy of that legacy value in
owner_password_v1, which reveal-family-password reads as legacy because it lacks the
v1: prefix. app_migrate_credential refuses that row until the copy is cleared.

The deployed Drive functions (drive-connect-url, drive-sync-quota,
drive-oauth-callback) are still the June versions, where the callback links the
account itself. drive-complete-connect, drive-disconnect and migrate-family-password
are not deployed. The Drive functions in this repository must be deployed together
with the frontend that uses the completion step.

## Server-only credential path

`supabase/migrations/202611110002_service_only_credential_rpcs.sql` makes
app_save_family and app_reveal_family_password executable by service_role only.
October had granted both to every signed-in account. app_save_family takes the acting
admin as an argument, so a non-admin could pass an admin's uuid and create or rewrite
families; scripts/database.test.mjs now covers that case.

The browser no longer has a fallback for these operations. Previously, when an Edge
Function call failed, the client called the RPCs directly, encrypted new passwords in
the browser with the user's uuid, and displayed raw ciphertext if decryption failed.
That code and src/lib/crypto.ts are removed. Consequence for cutover: saving a family
and revealing a password only work once save-family and reveal-family-password are
deployed with FAMILY_CREDENTIAL_KEY_V1 configured; there is no degraded mode.

## Implemented behavior

All approved admins share operational data. Drive connections remain owner-scoped.
Public customers order with manual payment, without reserving stock until approval.
Admin payment verification is persisted separately and audited, so a failed approval
does not make an already received payment disappear. Approval is one database transaction.
Member capacity (five actual records, including expired members) and case-insensitive
email uniqueness also apply to direct admin writes and moves.

Family deletion archives records. Order history and price snapshots remain available.
One-time products use a null billing cycle; slot products use monthly/annual.
Buyer and upgrade target emails are separate. Legacy orders retain their old aliases and
identifiers; prices that were never captured are not invented using current prices.

Family passwords are fetched only on explicit reveal/copy. New writes use server AES-GCM
with a dedicated 32-byte key and family-specific AAD. Legacy reads use the stored owner
identifier and strict authenticated decryption. Failed decryption is never plaintext.
The explicit per-family migration supports dry-run, verifies the new ciphertext, checks
that the legacy value did not change, and preserves the original bytes for recovery.
Retained legacy ciphertext is still decryptable using its original UUID by a database
reader; retiring legacy copies is a separate, explicitly reviewed data operation.

Public status requires an email and a random access code. Only hashes are stored.
Admins issue or rotate codes for existing members or approved orders. No code is sent
automatically through an external notification service.

## Production metadata checked

Only schema/catalog metadata was inspected using the existing linked CLI authentication.
No customer rows, dotenv contents, credential values, or Google account were read.
The linked production schema has UUID order ids and both legacy requester fields and
nullable canonical fields. Its policies include permissive authenticated full-access
policies alongside newer restrictive policies. Effective authenticated column privileges
still include family passwords and encrypted Drive tokens. Realtime publication is empty.
The upgrade replaces every policy on the affected tables, revokes table AND column grants,
and preserves UUID identifiers as text for a consistent historical interface.
No application migration or deployment has been performed by this implementation.
The physical-backup metadata listing returned no available snapshots and PITR disabled.
A usable production recovery point has therefore not been established by this work.
The backup mechanism/destination remains a required operator decision before cutover.

## Fresh database versus production upgrade

Four root SQL files are historical and must not be used as deployment alternatives.

For a fresh local/staging Supabase database, generate the complete schema with
`npm run db:bootstrap` (SQL on stdout), then apply it ONLY to that empty environment.
The bootstrap omits July's manual migration, which contains example JWT probes and
ownership backfill. October hardening supersedes those access policies.

On an existing production database, do not run bootstrap, db reset, or blindly push
all migration files. Review only
`supabase/migrations/202610070001_security_and_orders.sql` against the metadata.
Preserve existing migration history. The upgrade is transactional and aborts on
duplicate member emails or incompatible dependent foreign keys. It does not silently
remove members, rewrite owner UUIDs, reset admin roles, or fabricate historical prices.

Before applying production changes:
1. Establish an approved secure backup location/access policy or a verified managed
   backup and tested restore route. Never export production rows to an arbitrary
   temporary/shared folder. Confirm counts and prerequisite constraints without
   exposing email addresses or passwords.
2. Inspect schema with `supabase/inspection.sql`, including effective grants, existing
   indexes, triggers, and any dependency on the order id type. Reconcile duplicates
   and invalid legacy values explicitly; use staging copies with synthetic data first.
3. Configure the dedicated credential key in server secrets. Keep the existing Drive
   TOKEN_ENCRYPTION_KEY unchanged, otherwise previously stored refresh tokens will
   become unreadable. Keys must be secured independently of database backups.
4. Coordinate a maintenance/cutover window for migration, Edge Functions, and frontend.
   The old frontend's direct reads/writes are deliberately closed by hardening.
5. Perform the prepared migration/deployment only after concrete rollout approval.

## Required server configuration

- FAMILY_CREDENTIAL_KEY_V1: base64 of 32 cryptographically random bytes, server only.
- TOKEN_ENCRYPTION_KEY: retain existing value for legacy Drive tokens; verify strength
  without printing the secret.
- FRONTEND_URL: exact production origin.
- ALLOWED_FRONTEND_ORIGINS: optional explicit comma-separated extra origins, including
  local development/preview only when intended. No wildcard or arbitrary origin fallback.
- Existing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI and
  Supabase injected server configuration remain required.

Deploy every function in supabase/functions after matching schema is prepared.
Drive callback stays public and only forwards code/state in a URL fragment to the
trusted frontend. Completion requires the initiating admin, browser nonce, and a
single-use unexpired state. Old in-flight states without a nonce require reconnecting.

Do not store or print real secrets in README, fixtures, command logs, client bundles,
or SQL inspection output. Environment setup is an operator action; the implementation
did not open or modify the existing dotenv file.

## Activation and verification

Keep public_orders_enabled false through cutover. In the admin product/settings dialog,
configure actual WhatsApp, transfer instructions, and purchase terms; enable public
orders only after acceptance checks. Placeholder values never enable checkout.
The internal limits are three requests per email/10 minutes and 60 globally/minute,
with idempotent successful retries bypassing the creation counter. These controls do
not establish that a customer is human.

Review order receipt, payment verification, approval, code delivery and customer lookup.
Verify no normal signed-in account can read operational rows or self-promote.
Verify direct anonymous writes and the old email-only RPC are denied.
Verify legitimate admin metadata access and on-demand legacy/new password reveal.
Verify Drive connect from allowed origins and rejection of a copied consent link from
another browser/session. Test real Google consent on an authorized staging account.
Quota is displayed per account until pool mapping is verified; no sum/max pool assumption
is presented as established fact.

Rollback disables the affected feature and deploys a corrected compatible version.
Never reinstate open policies, arbitrary redirects, automatic password rewriting, or
an old frontend that depends on those access paths. Legacy credential bytes and original
owner identifiers stay available to the controlled recovery procedure.

## Validation commands

- npm run lint
- npm run typecheck
- npm run test:run (all frontend tests, dotenv disabled)
- npm run test:db (Postgres WASM engine, real SQL/RLS and migration tests)
- npm run test:edge (offline Node VM tests, real Web Crypto, mocked provider/database)
- npm run check:edge (requires Deno 2; real Edge TypeScript checking)
- npm run build:verify (dotenv disabled; no bundle emitted)
- npm run test:concurrency with TEST_DATABASE_URL targeting ONLY a loopback database
  named trial_manager_test (native PostgreSQL, separate concurrent connections).

CI uses Node 20, native PostgreSQL 17 and Deno 2.9.6. No production connection belongs
in CI. Local native concurrency verification uses an isolated temporary cluster with
synthetic accounts; it never points at the linked production database.
