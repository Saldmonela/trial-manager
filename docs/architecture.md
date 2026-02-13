# Architecture Overview

## Technology Stack

The **Trial-Manager** application is built using a modern, performance-focused stack:

- **Frontend Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 7](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Backend / Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Language**: JavaScript / TypeScript (Hybrid)

## Application Structure

The application follows a component-based architecture with a clear separation of concerns:

- **`src/components/`**: Reusable UI components and feature-specific logic.
- **`src/context/`**: Global state management (Theme, Language).
- **`src/hooks/`**: Custom React hooks for data fetching and logic reuse (`useSupabaseData`, `useLocalStorage`).
- **`src/lib/`**: Core utilities and helper functions.
- **`src/pages/`** (implied): Top-level route components (e.g., `Dashboard`, `LoginPage`).

## Authentication Flow

Authentication is handled via **Supabase Auth**.

1. **Login**: Users authenticate using their email and password via `LoginPage.jsx`.
2. **Session persistence**: Supabase client (`src/supabaseClient.js`) manages the session automatically.
3. **Route Protection**: The `ProtectedRoute.jsx` component wraps private routes (like the Dashboard), checking for an active session before rendering content. If no session exists, it redirects to the login page.

## State Management

The application uses a hybrid state management approach:

1. **Global Context**:
   - `ThemeContext`: Manages light/dark mode preferences.
   - `LanguageContext`: Handles application language state (e.g., ID/EN).

2. **Server State**:
   - Managed via the `useSupabaseData` hook (encapsulates fetching, caching, and realtime updates).
   - Realtime updates are enabled (likely via Supabase Realtime subscriptions) to reflect changes in `families` and `members` instantly.

3. **Local UI State**:
   - Components manage their own transient state (e.g., form inputs, modal visibility) using `useState` and `useReducer`.

## Database Schema

The backend is powered by a Supabase (PostgreSQL) database with two primary tables.

### 1. `families`

Stores information about trial accounts/families.

| Column           | Type          | Description                             |
| :--------------- | :------------ | :-------------------------------------- |
| `id`             | `TEXT`        | Primary Key (Unique Identifier)         |
| `name`           | `TEXT`        | Name of the family/service              |
| `owner_email`    | `TEXT`        | Email of the account owner              |
| `owner_password` | `TEXT`        | Encrypted password for the account      |
| `expiry_date`    | `TIMESTAMPTZ` | When the trial expires                  |
| `storage_used`   | `NUMERIC`     | Data usage metric (default 0)           |
| `notes`          | `TEXT`        | Optional notes                          |
| `created_at`     | `TIMESTAMPTZ` | Timestamp of creation                   |
| `user_id`        | `UUID`        | Linked Supabase Auth User ID (Optional) |

### 2. `members`

Stores members associated with a family.

| Column      | Type          | Description                            |
| :---------- | :------------ | :------------------------------------- |
| `id`        | `TEXT`        | Primary Key                            |
| `family_id` | `TEXT`        | Foreign Key referencing `families(id)` |
| `name`      | `TEXT`        | Member's name                          |
| `email`     | `TEXT`        | Member's email                         |
| `added_at`  | `TIMESTAMPTZ` | Timestamp when added                   |

> [!WARNING]
> **Security Note**: Row Level Security (RLS) is enabled on these tables, but current policies (`"Enable all access for now"`) allow public read/write access. **Strict RLS policies linking records to `auth.uid()` are highly recommended for production.**
