# Testing Strategy

The project uses **[Vitest](https://vitest.dev/)** as the test runner and **[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)** for component testing.

## Types of Tests

### 1. Unit Tests (`src/**/*.test.ts`)

Focus on testing individual functions and utilities in isolation.

- **Crypto Utils**: `src/lib/__tests__/crypto.test.ts` verifies encryption/decryption logic.
- **Hooks**: Tests for custom hooks like `useLocalStorage` to ensure state persistence logic works.

### 2. Component Tests (`src/**/*.test.tsx`)

Verify that UI components render correctly and handle user interactions.

- **UI Components**: `src/components/ui/__tests__/FormField.test.tsx` ensures inputs handle labels and errors correctly.
- **Auth Components**: `src/components/auth/__tests__/ProtectedRoute.test.tsx` verifies redirection logic based on session state.

### 3. Integration Tests

Test the interaction between multiple units, particularly data fetching hooks.

- **Supabase Integration**: Tests for `useSupabaseData` mock the Supabase client to verify data flow without hitting the real backend.

## Test Configuration

- **Config File**: `vitest.config.ts`
- **Setup File**: `src/test/setup.ts` (or similar) handles global test environment configuration, such as extending `expect` matchers.
- **Test Utils**: `src/test/test-utils.tsx` provides custom render functions (e.g., wrapping components in `ThemeContext` or `MemoryRouter`).

## Running Tests

Run all tests:

```bash
npm test
```

Or:

```bash
npm run test:run
```

Run tests with coverage report:

```bash
npm run test:coverage
```

Running a specific test file:

```bash
npx vitest src/path/to/test-file.test.tsx
```
