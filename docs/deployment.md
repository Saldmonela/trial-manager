# Deployment

Follow [Security rollout](security-rollout.md). Deploying only the frontend is insufficient:
the reviewed October migration, the November storefront-retirement migration and all
matching Edge Functions must be prepared together.
Do not replay historical manual SQL or bootstrap an existing production database.

Verify an approved secure backup/restore route before applying the production upgrade.
Preserve owner UUIDs, existing admin roles and the Drive token encryption key.
Configure the dedicated family credential key and exact allowed frontend origins server-side.
The create-order, member-status and admin-access-code Edge Functions no longer exist in
the repository; if they were ever deployed, delete them from the project as well.

Deployment was not performed by the local implementation. Production metadata was
inspected without reading customer rows or existing dotenv/secret values.

CI verifies lint, frontend/Edge types, unit tests, real SQL/RLS migration behavior,
native PostgreSQL concurrency and an environment-free build. Authenticated staging
interaction and authorized Google consent must still be checked before production activation.
