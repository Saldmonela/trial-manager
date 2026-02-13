# Access Model: Public Dashboard + Admin Console

## TL;DR

> **Quick Summary**: Split the product into a public-safe dashboard and an admin-only console by introducing explicit data projections, role-based RLS, and a new `join_requests` workflow.
>
> **Deliverables**:
> - Route map and guarded navigation for `/`, `/dashboard`, `/admin`, `/login`
> - Data model delta (`profiles`, `join_requests`, public projection)
> - Supabase RLS SQL for public read + admin write
> - Ordered rollout plan (MVP first, hardening second)
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 -> Task 2 -> Task 5 -> Task 8

---

## Context

### Original Request
Design a new access model where `/dashboard` is public, `/admin` is admin-only, public users can browse available slots and submit join requests, and sensitive fields must never leak publicly.

### Interview Summary
**Key Discussions**:
- Public dashboard member identity decision is finalized as **counts-only**.
- Admin keeps current full management functionality.
- Public must never see `owner_email`, passwords, internal notes, or full member emails.

**Research Findings**:
- Current routes live in `src/App.jsx` with `/dashboard` guarded by `src/components/auth/ProtectedRoute.jsx`.
- Current schema includes `families` and `members` only (`supabase_schema.sql`); no `join_requests` yet.
- Current hook fetches broad family/member data (`src/hooks/useSupabaseData.ts`) and is unsuitable for public reads.
- Existing RLS file (`supabase_rls_security.sql`) is ownership-based and must be replaced for this model.
- Test infra exists (`package.json`, `docs/testing.md`).

### Metis Review
**Identified Gaps (addressed in this plan)**:
- Explicit guardrail: public reads must use allowlist projection only (no `select('*')` in public path).
- Explicit abuse/dedupe baseline for join requests.
- Explicit negative acceptance tests (anon cannot read private tables, non-admin cannot access `/admin`).
- Explicit edge-case handling for approval-at-capacity race.

---

## Work Objectives

### Core Objective
Deliver a secure dual-surface app: a privacy-safe public dashboard for browsing availability and submitting join requests, plus an admin-only console preserving full CRUD and credential management.

### Concrete Deliverables
- Route behavior:
  - `/` public landing.
  - `/dashboard` public counts-only dashboard.
  - `/login` admin sign-in entry.
  - `/admin` admin-only full management dashboard.
- Data model additions:
  - `profiles` (role mapping for admin check).
  - `join_requests` (public submit, admin moderation).
  - `dashboard_public_families` (public-safe projection).
- SQL policy bundle enforcing:
  - public-safe read only from projection.
  - admin-only read/write on private tables.
  - public insert + admin moderation on `join_requests`.

### Definition of Done
- [ ] `npm run test:run` passes.
- [ ] `npm run build` passes.
- [ ] Public `/dashboard` loads without login and exposes no forbidden fields.
- [ ] Non-admin cannot access `/admin` and cannot read private tables through app queries.
- [ ] Admin can access `/admin`, manage families/members, and process join requests.

### Must Have
- Strict role-based admin gate (`profiles.role='admin'` + helper check).
- Public dashboard sourced from safe projection only.
- Join request lifecycle: `pending -> approved|rejected`.

### Must NOT Have (Guardrails)
- No public query directly reading `families` or `members` private columns.
- No `select('*')` in public data path.
- No client-side use of privileged/service-role keys.
- No exposure of `owner_email`, passwords, notes, or full member emails in any public payload/DOM.
- No scope expansion into notifications/CAPTCHA/export/audit-log unless explicitly requested later.

---

## Route Map (Target)

| Route | Access | Data Source | Behavior |
|---|---|---|---|
| `/` | Public | none | Landing page, CTA to `/dashboard`, admin login button to `/login` |
| `/dashboard` | Public | `dashboard_public_families` | Browse availability (counts only), submit join request |
| `/login` | Public (entry) | Supabase Auth | Google OAuth; post-login role check; non-admin denied/signed out |
| `/admin` | Admin only | `families`, `members`, `join_requests` | Full current admin dashboard + moderation queue |

---

## Data Model Changes

### Existing Tables (kept private)
- `families` (`owner_email`, `owner_password`, `notes` remain admin-only)
- `members` (`email` remains admin-only)

### New Tables / Objects
- `profiles`
  - `id uuid primary key references auth.users(id)`
  - `email text unique not null`
  - `role text not null check (role in ('admin','user')) default 'user'`
- `join_requests`
  - `id uuid primary key default gen_random_uuid()`
  - `family_id text not null references families(id) on delete cascade`
  - `requester_name text not null`
  - `requester_email text not null`
  - `message text`
  - `status text not null default 'pending' check (status in ('pending','approved','rejected'))`
  - `reviewed_by uuid references auth.users(id)`
  - `reviewed_at timestamptz`
  - `admin_note text`
  - `created_at timestamptz default now()`
- `dashboard_public_families` (view)
  - `id, name, expiry_date, storage_used, slots_total, slots_used, slots_available`
  - excludes all forbidden/sensitive fields.

### Constraints
- Unique pending dedupe index: `unique (family_id, lower(requester_email)) where status='pending'`.

---

## RLS Policies in Supabase (SQL Deliverable)

```sql
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

alter table public.families enable row level security;
alter table public.members enable row level security;

drop policy if exists admin_read_families on public.families;
drop policy if exists admin_write_families on public.families;
drop policy if exists admin_read_members on public.members;
drop policy if exists admin_write_members on public.members;

create policy admin_read_families on public.families
for select to authenticated
using ((select public.is_admin()));

create policy admin_write_families on public.families
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admin_read_members on public.members
for select to authenticated
using ((select public.is_admin()));

create policy admin_write_members on public.members
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create or replace view public.dashboard_public_families as
select
  f.id,
  f.name,
  f.expiry_date,
  f.storage_used,
  5::int as slots_total,
  count(m.id)::int as slots_used,
  greatest(5 - count(m.id), 0)::int as slots_available
from public.families f
left join public.members m on m.family_id = f.id
group by f.id, f.name, f.expiry_date, f.storage_used;

grant select on public.dashboard_public_families to anon, authenticated;

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  family_id text not null references public.families(id) on delete cascade,
  requester_name text not null,
  requester_email text not null,
  message text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now()
);
alter table public.join_requests enable row level security;

create unique index if not exists uniq_pending_join_request
on public.join_requests (family_id, lower(requester_email))
where status = 'pending';

drop policy if exists public_insert_join_requests on public.join_requests;
drop policy if exists admin_read_join_requests on public.join_requests;
drop policy if exists admin_update_join_requests on public.join_requests;

create policy public_insert_join_requests on public.join_requests
for insert to anon, authenticated
with check (
  status = 'pending' and reviewed_by is null and reviewed_at is null
);

create policy admin_read_join_requests on public.join_requests
for select to authenticated
using ((select public.is_admin()));

create policy admin_update_join_requests on public.join_requests
for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
```

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> All acceptance checks are agent-executed through commands and browser automation.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: Vitest (`npm run test:run`)

### Agent-Executed QA Scenarios

Scenario: Public dashboard loads without authentication
  Tool: Playwright
  Preconditions: App dev server running on `http://localhost:5173`
  Steps:
    1. Navigate to `http://localhost:5173/dashboard`
    2. Wait for dashboard header visible
    3. Assert URL remains `/dashboard` (no redirect to `/login`)
    4. Screenshot `.sisyphus/evidence/task-route-public-dashboard.png`
  Expected Result: Public dashboard renders without login
  Failure Indicators: Redirect to `/login`, auth error, blank state crash
  Evidence: `.sisyphus/evidence/task-route-public-dashboard.png`

Scenario: Non-admin cannot access admin
  Tool: Playwright
  Preconditions: Logged in as non-admin test account
  Steps:
    1. Navigate to `http://localhost:5173/admin`
    2. Wait for route resolution
    3. Assert redirected to `/login` or `/dashboard`
    4. Screenshot `.sisyphus/evidence/task-route-admin-denied.png`
  Expected Result: Access denied for non-admin
  Failure Indicators: Admin UI visible for non-admin
  Evidence: `.sisyphus/evidence/task-route-admin-denied.png`

Scenario: Public payload contains no forbidden fields
  Tool: Bash
  Preconditions: Local script/endpoint available to fetch `dashboard_public_families`
  Steps:
    1. Execute `node scripts/check-public-payload.mjs`
    2. Script fetches projection via anon client
    3. Script asserts keys do not include `owner_email`, `owner_password`, `notes`, `email`
    4. Save output `.sisyphus/evidence/task-security-public-payload.txt`
  Expected Result: Forbidden key assertion passes
  Failure Indicators: Any forbidden key present
  Evidence: `.sisyphus/evidence/task-security-public-payload.txt`

Scenario: Public join request insert succeeds but public moderation fails
  Tool: Bash
  Preconditions: Supabase env configured for anon client
  Steps:
    1. Execute `node scripts/check-join-request-rls.mjs`
    2. Script performs anon insert into `join_requests`
    3. Script attempts anon update to status
    4. Assert insert success and update rejection
    5. Save output `.sisyphus/evidence/task-join-request-rls.txt`
  Expected Result: Public can submit, cannot moderate
  Failure Indicators: Anon can update status
  Evidence: `.sisyphus/evidence/task-join-request-rls.txt`

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
- Task 1: Role foundation (`profiles`, `is_admin()`)
- Task 4: Route scaffolding (`/admin`, `/dashboard` public wiring)

Wave 2 (After Wave 1):
- Task 2: Public projection + private-table policy lock-down
- Task 3: `join_requests` table + policies

Wave 3 (After Wave 2):
- Task 5: Public dashboard data path + counts-only UI
- Task 6: Admin dashboard route and privileged data path

Wave 4 (After Wave 3):
- Task 7: Join-request UI submit + admin moderation UI

Wave 5 (After Wave 4):
- Task 8: Tests, negative security checks, build verification

Critical Path: Task 1 -> Task 2 -> Task 5 -> Task 8

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|---|---|---|---|
| 1 | None | 2,3,6 | 4 |
| 2 | 1 | 5,8 | 3 |
| 3 | 1 | 7,8 | 2 |
| 4 | None | 6 | 1 |
| 5 | 2 | 7,8 | 6 |
| 6 | 1,4 | 7,8 | 5 |
| 7 | 3,5,6 | 8 | None |
| 8 | 2,3,5,6,7 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|---|---|---|
| 1 | 1,4 | `task(category="quick", load_skills=["git-master"])` and `task(category="unspecified-high", load_skills=["frontend-ui-ux"])` |
| 2 | 2,3 | `task(category="unspecified-high", load_skills=["git-master"])` |
| 3 | 5,6 | `task(category="visual-engineering", load_skills=["frontend-ui-ux"])` |
| 4 | 7 | `task(category="unspecified-high", load_skills=["frontend-ui-ux"])` |
| 5 | 8 | `task(category="quick", load_skills=["playwright","git-master"])` |

---

## TODOs

- [ ] 1. Add admin role foundation in database

  **What to do**:
  - Add `profiles` table and `is_admin()` helper function.
  - Default admin bootstrap: promote owner account by email on first rollout (`profiles.role='admin'` for owner email), then keep role changes admin-only.

  **Must NOT do**:
  - Must not hardcode service-role in client.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Security-sensitive SQL and policy design.
  - **Skills**: `git-master`
    - `git-master`: keeps schema/policy changes atomic and auditable.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: not needed for SQL-only task.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 4)
  - **Blocks**: 2, 3, 6
  - **Blocked By**: None

  **References**:
  - `supabase_schema.sql` - current baseline schema for `families` and `members`.
  - `supabase_rls_security.sql` - existing ownership model to replace/extend.
  - `src/App.jsx` - current auth/session entry behavior informing admin bootstrap flow.

  **Acceptance Criteria**:
  - [ ] SQL migration contains `profiles` and `is_admin()` definitions.
  - [ ] Non-admin profile evaluates false; admin profile evaluates true in DB checks.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Admin helper function evaluates correctly
    Tool: Bash
    Preconditions: Migration applied; test admin/non-admin rows exist in profiles
    Steps:
      1. Run SQL check script for non-admin user context
      2. Assert function result is false
      3. Run SQL check script for admin user context
      4. Assert function result is true
      5. Save output to .sisyphus/evidence/task-1-is-admin.txt
    Expected Result: admin=true, non-admin=false
    Evidence: .sisyphus/evidence/task-1-is-admin.txt
  ```

- [ ] 2. Build public-safe projection and lock private table reads to admin

  **What to do**:
  - Create `dashboard_public_families` projection with allowlisted fields only.
  - Update policies so `families`/`members` are admin-only.

  **Must NOT do**:
  - No sensitive columns in projection.
  - No wildcard public selection path.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: not required.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: 5, 8
  - **Blocked By**: 1

  **References**:
  - `src/hooks/useSupabaseData.ts` - current broad fetch pattern that must stay admin-only.
  - `src/components/family/FamilyCard.jsx` - currently displays sensitive fields; public path must avoid this payload.
  - `docs/architecture.md` - confirms schema + current auth narrative.

  **Acceptance Criteria**:
  - [ ] Projection returns only allowlisted fields.
  - [ ] Anon query to private tables fails or returns no access.
  - [ ] Anon query to projection succeeds.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Public projection is readable, private tables are blocked
    Tool: Bash
    Preconditions: RLS policies applied; anon client credentials available
    Steps:
      1. Execute anon select against dashboard_public_families
      2. Assert non-error response with expected allowlisted keys
      3. Execute anon select against families
      4. Assert permission denied or empty access
      5. Save output to .sisyphus/evidence/task-2-rls-projection.txt
    Expected Result: projection read allowed; private read denied
    Evidence: .sisyphus/evidence/task-2-rls-projection.txt

  Scenario: Forbidden keys never appear in public payload
    Tool: Bash
    Preconditions: Projection query script exists
    Steps:
      1. Fetch projection JSON via anon client
      2. Assert keys do not include owner_email, owner_password, notes, email
      3. Save assertion log to .sisyphus/evidence/task-2-no-forbidden-keys.txt
    Expected Result: key blacklist assertion passes
    Evidence: .sisyphus/evidence/task-2-no-forbidden-keys.txt
  ```

- [ ] 3. Add `join_requests` table with public insert and admin moderation policies

  **What to do**:
  - Add schema, status lifecycle, moderation columns, and dedupe index.
  - Add RLS: public insert only; admin select/update.

  **Must NOT do**:
  - Public update/delete policy must not exist.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: deferred to UI tasks.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: 7, 8
  - **Blocked By**: 1

  **References**:
  - `.sisyphus/drafts/access-model-redesign.md` - agreed workflow and status model.
  - `supabase_schema.sql` - table naming conventions.

  **Acceptance Criteria**:
  - [ ] Public insert succeeds with valid payload.
  - [ ] Duplicate pending request for same family/email is rejected.
  - [ ] Public moderation update fails.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Public can submit join request
    Tool: Bash
    Preconditions: join_requests table and insert policy applied
    Steps:
      1. Run anon insert for family_id="fam-1", requester_email="test@example.com"
      2. Assert insert status is success
      3. Save output to .sisyphus/evidence/task-3-public-insert.txt
    Expected Result: pending join request row created
    Evidence: .sisyphus/evidence/task-3-public-insert.txt

  Scenario: Duplicate pending request is blocked
    Tool: Bash
    Preconditions: existing pending request for same family_id + requester_email
    Steps:
      1. Repeat anon insert with same family_id and requester_email
      2. Assert unique/constraint error
      3. Save output to .sisyphus/evidence/task-3-dedupe.txt
    Expected Result: duplicate pending prevented
    Evidence: .sisyphus/evidence/task-3-dedupe.txt
  ```

- [ ] 4. Refactor routing for public dashboard and admin console split

  **What to do**:
  - Keep `/` public landing.
  - Make `/dashboard` public.
  - Add `/admin` protected route.
  - Keep `/login` admin entry and post-login role gate.

  **Must NOT do**:
  - Must not leave `/admin` as session-only without role check.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `frontend-ui-ux`
  - **Skills Evaluated but Omitted**:
    - `playwright`: used later in verification stage.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: 6
  - **Blocked By**: None

  **References**:
  - `src/App.jsx` - existing route map and redirects.
  - `src/components/auth/ProtectedRoute.jsx` - existing guard behavior.
  - `src/components/LandingPage.jsx` - login CTA placement.
  - `src/components/auth/LoginPage.jsx` - login UX entry point.

  **Acceptance Criteria**:
  - [ ] `/dashboard` is reachable unauthenticated.
  - [ ] `/admin` is blocked for unauthenticated and non-admin users.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Public route access behavior
    Tool: Playwright
    Preconditions: App running at localhost:5173
    Steps:
      1. Open /dashboard without login
      2. Assert page renders and URL remains /dashboard
      3. Open /admin without login
      4. Assert redirect to /login or /dashboard
      5. Screenshot .sisyphus/evidence/task-4-route-access.png
    Expected Result: public dashboard works, admin blocked
    Evidence: .sisyphus/evidence/task-4-route-access.png
  ```

- [ ] 5. Implement public dashboard data hook and counts-only UI contract

  **What to do**:
  - Add a dedicated public data hook/query for projection.
  - Render slot counts only; do not render member identities.

  **Must NOT do**:
  - No sensitive-field fallback in public mode.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `frontend-ui-ux`
  - **Skills Evaluated but Omitted**:
    - `git-master`: optional, not required for implementation logic.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 6)
  - **Blocks**: 7, 8
  - **Blocked By**: 2

  **References**:
  - `src/components/Dashboard.jsx` - stats and slot display areas.
  - `src/lib/familyUtils.js` - slot semantics to preserve.
  - `src/types/index.ts` - add public DTO typings.

  **Acceptance Criteria**:
  - [ ] Public dashboard renders slot totals/availability.
  - [ ] Public DOM/payload inspection confirms forbidden fields absent.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Counts-only dashboard presentation
    Tool: Playwright
    Preconditions: Public projection contains sample data
    Steps:
      1. Open /dashboard
      2. Assert slot totals and availability cards are visible
      3. Assert member identity strings/emails are not rendered
      4. Screenshot .sisyphus/evidence/task-5-counts-only.png
    Expected Result: counts visible, identities absent
    Evidence: .sisyphus/evidence/task-5-counts-only.png
  ```

- [ ] 6. Move full current functionality to `/admin` surface

  **What to do**:
  - Keep existing CRUD/modals/search/password-reveal behavior for admin only.
  - Ensure admin uses private-table hook path.

  **Must NOT do**:
  - Must not share admin credential reveal components on public route.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `frontend-ui-ux`
  - **Skills Evaluated but Omitted**:
    - `playwright`: defer to QA task.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 5)
  - **Blocks**: 7, 8
  - **Blocked By**: 1, 4

  **References**:
  - `src/components/family/FamilyCard.jsx` - full credential/member management interactions.
  - `src/components/modals/AddFamilyModal.jsx` - admin create flow.
  - `src/components/modals/EditFamilyModal.jsx` - admin update flow.
  - `src/components/modals/AddMemberModal.jsx` - admin member flow.

  **Acceptance Criteria**:
  - [ ] Admin can still create/edit/delete families and members.
  - [ ] Admin can view/copy credentials in admin surface only.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Admin functional parity retained on /admin
    Tool: Playwright
    Preconditions: Logged in as admin user
    Steps:
      1. Open /admin
      2. Create test family and member
      3. Edit family details and save
      4. Assert credential reveal controls still function on /admin
      5. Screenshot .sisyphus/evidence/task-6-admin-parity.png
    Expected Result: full legacy admin behavior preserved
    Evidence: .sisyphus/evidence/task-6-admin-parity.png
  ```

- [ ] 7. Implement join-request UX (public submit + admin moderation queue)

  **What to do**:
  - Add public submission form on dashboard.
  - Add admin moderation list/actions (approve/reject) in `/admin`.

  **Must NOT do**:
  - No direct member creation from public route.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `frontend-ui-ux`
  - **Skills Evaluated but Omitted**:
    - `git-master`: optional.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (sequential)
  - **Blocks**: 8
  - **Blocked By**: 3, 5, 6

  **References**:
  - `.sisyphus/drafts/access-model-redesign.md` - approved workflow and privacy constraints.
  - `src/components/modals/AddMemberModal.jsx` - form/validation interaction pattern.

  **Acceptance Criteria**:
  - [ ] Public submission creates `pending` request.
  - [ ] Admin can approve/reject.
  - [ ] Invalid/duplicate pending submission returns clear error.
  - [ ] Approve action at full capacity is rejected safely with explicit error.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Public submit then admin moderation
    Tool: Playwright
    Preconditions: App running; admin account available
    Steps:
      1. As public user on /dashboard, submit join form with test data
      2. Assert success notice displayed
      3. Login as admin and open moderation queue on /admin
      4. Approve request and assert status changes from pending to approved
      5. Screenshot .sisyphus/evidence/task-7-approve-flow.png
    Expected Result: end-to-end request lifecycle works
    Evidence: .sisyphus/evidence/task-7-approve-flow.png

  Scenario: Approval denied when capacity is full
    Tool: Playwright
    Preconditions: Target family has zero available slots
    Steps:
      1. Open admin moderation queue
      2. Attempt approve on pending request for full family
      3. Assert explicit capacity error and unchanged request status
      4. Screenshot .sisyphus/evidence/task-7-capacity-block.png
    Expected Result: race-safe capacity enforcement
    Evidence: .sisyphus/evidence/task-7-capacity-block.png
  ```

- [ ] 8. Verification and hardening pass

  **What to do**:
  - Add/adjust tests for route gating, projection privacy, and join-request permissions.
  - Run full test/build verification and capture evidence.

  **Must NOT do**:
  - No manual-only verification steps.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `playwright`, `git-master`
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: not primary for verification.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (final)
  - **Blocks**: None
  - **Blocked By**: 2, 3, 5, 6, 7

  **References**:
  - `docs/testing.md` - test execution conventions.
  - `src/components/auth/__tests__/ProtectedRoute.test.tsx` - auth route test style.
  - `src/hooks/__tests__/useSupabaseData.test.ts` - data-hook test style.

  **Acceptance Criteria**:
  - [ ] `npm run test:run` passes.
  - [ ] `npm run build` passes.
  - [ ] Evidence artifacts saved under `.sisyphus/evidence/`.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Automated verification suite
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. Run npm run test:run
      2. Assert exit code 0
      3. Run npm run build
      4. Assert exit code 0
      5. Save command output to .sisyphus/evidence/task-8-ci-checks.txt
    Expected Result: tests and build pass
    Evidence: .sisyphus/evidence/task-8-ci-checks.txt
  ```

---

## Commit Strategy

| After Task | Message | Files | Verification |
|---|---|---|---|
| 1-3 | `feat(auth): establish admin role and public-safe RLS model` | SQL/policy files | policy checks + tests |
| 4-6 | `refactor(routes): split public dashboard and admin console` | routing/components/hooks | route QA + tests |
| 7-8 | `feat(join-requests): add public submit and admin moderation` | UI + tests | `npm run test:run && npm run build` |

---

## Success Criteria

### Verification Commands

```bash
npm run test:run
# Expected: all tests pass

npm run build
# Expected: successful production build
```

### Final Checklist
- [ ] Public `/dashboard` works without login.
- [ ] Public dashboard displays counts-only availability (no member identities).
- [ ] Public payload/DOM has no forbidden fields.
- [ ] `/admin` is accessible only by admin role.
- [ ] Admin retains full existing management functionality.
- [ ] Public users can submit join requests.
- [ ] Admin can moderate join requests.
- [ ] All tests/build checks pass with captured evidence.
