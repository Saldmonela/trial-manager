# Public Dashboard UI Redesign

## TL;DR

> **Quick Summary**: Redesign the Public Dashboard and Family Card to match the professional "Admin" aesthetic while strictly enforcing data privacy.
> 
> **Deliverables**:
> - `FamilyCardPublic.jsx` (Refactored to match Admin style)
> - `PublicMetricsRow.jsx` (New component)
> - `PublicFiltersBar.jsx` (New component)
> - `DashboardPublic.jsx` (Updated layout)
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Shared Components → Dashboard Integration

---

## Context

### Original Request
Design a Public Dashboard UI that matches the Admin Dashboard style (header, metrics, filters, grid) but restricts sensitive data (emails, passwords, members).

### Key Decisions
- **Visual Parity**: Public UI will look almost identical to Admin UI (fonts, spacing, shadows) to maintain brand consistency.
- **Data Safety**: Frontend will rely on `usePublicFamilies` hook which already strips sensitive fields.
- **Calculated Fields**: "Slots Used" will be calculated on frontend (`MAX_SLOTS - available`) since public API doesn't return member lists.
- **Components**: Creating specific "Public" versions of shared components (`PublicMetricsRow`, `PublicFiltersBar`) to avoid leaking admin logic/props into public view.

### Scope
- **IN**: UI Components (`DashboardPublic`, `FamilyCardPublic`, helpers), responsive layout, styling.
- **OUT**: Backend changes (API already exists), Auth logic changes, Admin dashboard changes.

---

## Work Objectives

### Core Objective
Create a polished, professional Public Dashboard that inspires trust and clearly communicates availability.

### Concrete Deliverables
- [x] Refactored `src/components/family/FamilyCardPublic.jsx`
- [x] New `src/components/dashboard/PublicMetricsRow.jsx`
- [x] New `src/components/dashboard/PublicFiltersBar.jsx`
- [ ] Updated `src/components/DashboardPublic.jsx`

### Guardrails
- **NO Sensitive Data**: `owner_email`, `owner_password`, `members` array must NEVER be rendered or accessible in props.
- **NO Admin Actions**: Edit, Delete, Add Member buttons must be strictly absent.
- **Zero Human Verification**: All QA must be automated via agent.

---

## Verification Strategy

### Automated Tests
- **Infrastructure**: Existing Vitest setup.
- **Unit Tests**: Verify components render with public props and don't crash.

### Agent-Executed QA Scenarios (MANDATORY)

> **Universal Rule**: All checks performed by agent, anonymously.

#### Scenario 1: Public Dashboard Access (Anonymous)
- **Tool**: Playwright
- **Steps**:
    1. Navigate to `/dashboard` (incognito context, no auth cookie).
    2. Assert URL remains `/dashboard` (no redirect to login).
    3. Assert Header "Public Dashboard" is visible.
    4. Screenshot: `.sisyphus/evidence/public-dashboard-load.png`

#### Scenario 2: Data Privacy Check
- **Tool**: Playwright
- **Steps**:
    1. Navigate to `/dashboard`.
    2. Wait for Family Cards to load.
    3. assert `body` does NOT contain text "owner_password".
    4. assert `body` does NOT contain text "owner_email" (unless masked/public intent, but strictly hidden per requirements).
    5. assert `body` does NOT contain "Edit" or "Delete" buttons.

#### Scenario 3: Request Slot Flow
- **Tool**: Playwright
- **Steps**:
    1. Click "Request Slot" on first available family.
    2. Assert "Join Request" modal opens.
    3. Fill Name: "Test User", Email: "test@example.com".
    4. Click "Send Request".
    5. Assert Toast message "Request sent successfully".
    6. Screenshot: `.sisyphus/evidence/request-slot-flow.png`

---

## TODOs

- [x] 1. Create `PublicMetricsRow` Component

  **What to do**:
  - Create `src/components/dashboard/PublicMetricsRow.jsx`.
  - Replicate `MetricsRow.jsx` styling (grid, borders, typography).
  - Props: `totalFamilies`, `totalAvailableSlots`.
  - Display:
    - "Total Families" (Count)
    - "Available Slots" (Count + % bar)
    - "Capacity" (Inverse of available, optional, or just focus on availability)

  **References**:
  - Style Source: `src/components/dashboard/MetricsRow.jsx`
  - Usage: `src/components/DashboardPublic.jsx` (currently hardcoded)

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: `frontend-ui-ux` (Tailwind mastery)

  **Parallelization**: Wave 1 (Independent)

  **Acceptance Criteria**:
  - [x] Renders grid of metric cards.
  - [x] Matches Admin visual style (padding, borders, fonts).
  - [x] Agent QA: Verify rendering with mock props.

- [x] 2. Create `PublicFiltersBar` Component

  **What to do**:
  - Create `src/components/dashboard/PublicFiltersBar.jsx`.
  - Replicate `FiltersBar.jsx` styling (tabs, sort dropdown).
  - **Tabs**: "All", "Available", "Expiring Soon".
  - **Sort Options**: "Name", "Availability", "Expiry Date".
  - Props: `filter` (state), `setFilter`, `sortBy` (state), `setSortBy`, `sortDirection`.

  **References**:
  - Style Source: `src/components/dashboard/FiltersBar.jsx`

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: `frontend-ui-ux`

  **Parallelization**: Wave 1 (Independent)

  **Acceptance Criteria**:
  - [x] Renders tabs and sort button.
  - [x] Interactive state changes (onClick calls setters).
  - [x] Responsive design (mobile dropdown for sort).
  - [x] Agent QA: Click tabs and verify callback firing.

- [x] 3. Refactor `FamilyCardPublic` Component

  **What to do**:
  - Rewrite `src/components/family/FamilyCardPublic.jsx`.
  - **Structure**:
    - **Expiry Badge**: Top-right absolute (Green/Yellow/Red).
    - **Header**: Large initial avatar + Family Name + Service Name (gold/stone theme).
    - **Body**:
        - **Progress Bar**: Segmented bar showing (MAX - Available) / MAX.
        - **Info Row**: "Expires: [Date]"
        - **Storage Bar**: (if storage info exists).
        - **CTA**: Full-width "Request Slot" button (primary style).
  - **Logic**:
    - Calculate `slotsUsed = 5 - slotsAvailable`.
    - Use `getExpiryStatus` helper.
  - **Styles**: Copy classes from `FamilyCard.jsx` exactly (borders, shadows, hover effects).

  **References**:
  - Style Source: `src/components/family/FamilyCard.jsx`
  - Data Source: `PublicFamily` interface (from `usePublicFamilies`).

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: `frontend-ui-ux`

  **Parallelization**: Wave 1 (Independent)

  **Acceptance Criteria**:
  - [x] Matches Admin card visual fidelity.
  - [x] Progress bar accurately reflects `slotsAvailable`.
  - [x] No sensitive data rendered.
  - [x] Agent QA: Screenshot comparison with Admin card (visual check).

- [x] 4. Integrate into `DashboardPublic`

  **What to do**:
  - Update `src/components/DashboardPublic.jsx`.
  - Import `PublicMetricsRow`, `PublicFiltersBar`, `FamilyCardPublic`.
  - **State**: Add `filter` ('all' | 'available' | 'expiring') and `sortBy` ('name' | 'slots' | 'expiry').
  - **Logic**: Implement filtering and sorting of `families` array before rendering.
  - **Render**:
    - Header (keep existing or match `DashboardHeader` style).
    - `PublicMetricsRow`
    - `PublicFiltersBar`
    - Grid of `FamilyCardPublic`
  - Handle `onJoinClick` (keep existing logic).
  - Pass `theme` to all child components.

  **References**:
  - Logic: `src/components/Dashboard.jsx` (Admin sorting logic)

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: `frontend-ui-ux`

  **Parallelization**: Wave 2 (Depends on 1, 2, 3)

  **Acceptance Criteria**:
  - [x] Full page layout matches Admin dashboard.
  - [x] Filtering works (clicking "Available" hides full families).
  - [x] Sorting works (Name A-Z, Expiry Asc/Desc).
  - [x] Agent QA: Playwright Scenario 1, 2, 3.

---

## Success Criteria

- [x] Public Dashboard looks professional and consistent with Admin view.
- [x] Users can filter to find available slots quickly.
- [x] "Request Slot" flow is obvious and accessible.
- [x] Zero sensitive data leaks verified by agent.

