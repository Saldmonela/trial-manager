# Trial Manager

React 19, Vite, Tailwind and Supabase application for internal subscription
administration: tracking when each account expires, which accounts still have free
member slots, and how much Google Drive storage each account has left.

It is an admin-only tool. There is no public page: every route requires an admin
sign-in, and a signed-in non-admin account only sees a "no access" screen. The earlier
public storefront (catalogue, ordering, customer status lookup) was retired in November
2026; see [Security rollout](docs/security-rollout.md#storefront-retirement).

Passwords are stored using server encryption and revealed on explicit admin request.
Legacy credentials remain recoverable with their original owner identifier when their
ciphertext verifies. Failed decryption never becomes a password replacement.

## Development and verification

Install dependencies with npm ci, then use npm run dev with your local environment.
Test and verification commands do not read dotenv or contact production:
npm run lint, npm run typecheck, npm run test:run, npm run test:db,
npm run test:edge, npm run build:verify.
npm run check:edge requires Deno 2.

Native concurrent database tests use npm run test:concurrency and a TEST_DATABASE_URL
pointing only at the loopback database trial_manager_test. CI provisions an isolated
PostgreSQL 17 service and runs Node 20 plus Deno 2.9.6.

## Database and deployment

Read [Security rollout](docs/security-rollout.md) before deployment.
Use npm run db:bootstrap only to prepare an empty local/staging database.
Existing production requires a reviewed upgrade, an approved secure backup/restore
route, matching server configuration and a coordinated frontend/Edge cutover.

The four root SQL files are historical references, not deployment alternatives.
The July manual migration mixes ownership backfill/example probes with DDL and is
excluded from automatic bootstrap. October hardening replaces its access policies.
