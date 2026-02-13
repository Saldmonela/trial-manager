# Component Library

## UI Components

Reusable base components found in `src/components/ui`.

- **`Modal`**: A generic modal dialog component. Handles open/close state, overlay rendering, and accessibility.
- **`FormField`**: A standard input field wrapper with label, error message support, and styling consistency.
- **`ToastContainer`**: Manages and displays toast notifications (success/error messages) stacked on the screen.
- **`MigrationBanner`**: A specialized banner component likely used to prompt users about data migration or important updates.

## Feature Components

Components implementing specific business logic, found in `src/components/`.

- **`Dashboard`**: The main view of the application. Integrates `FamilyCard` lists, search functionality, sorting, and modal triggers.
- **`FamilyCard`**: Displays individual subscription/family details (name, expiry, owner info). Includes actions like Edit, Delete, and View Password.
- **`LandingPage`**: The public-facing entry page for unauthenticated users.
- **`MigrationTool`**: A utility component to assist with data migration tasks (e.g., local storage to Supabase).
- **`TutorialModal`**: An onboarding modal to guide new users.

### Modals (`src/components/modals`)

Specialized modals for CRUD operations:

- **`AddFamilyModal`**: Form to create a new subscription entry.
- **`EditFamilyModal`**: Form to update existing subscription details.
- **`AddMemberModal`**: Form to add members to a specific family.
- **`DeleteConfirmModal`**: A confirmation dialog for destructive actions.

### Authentication (`src/components/auth`)

- **`LoginPage`**: Handles user login via Supabase Auth.
- **`ProtectedRoute`**: A higher-order component (wrapper) that enforces authentication rules for child routes.

## Hooks & Utilities

### Custom Hooks (`src/hooks`)

- **`useSupabaseData`**: Central hook for data fetching. Manages state for `families`, `members`, and loading status. Handles realtime subscription setup.
- **`useLocalStorage`**: Utility hook to persist state to browser local storage (used for preferences or non-critical data).
- **`useToast`**: Provides a clean interface to trigger toast notifications from any component.

### Utilities (`src/lib`, `src/utils`)

- **`crypto`**: Functions for encryption/decryption of sensitive data (like passwords).
- **`familyUtils`**: Helper functions for family-related logic (e.g., sorting, filtering, expiry calculation).
