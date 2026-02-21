import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock supabase client
const mockOnAuthStateChange = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockSignOut = vi.fn();
const mockFrom = vi.fn();
const mockGetSession = vi.fn();
const mockRefreshSession = vi.fn();

vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args: any[]) => mockOnAuthStateChange(...args),
      signInWithOAuth: (...args: any[]) => mockSignInWithOAuth(...args),
      signOut: () => mockSignOut(),
      getSession: (...args: any[]) => mockGetSession(...args),
      refreshSession: (...args: any[]) => mockRefreshSession(...args),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
  // supabasePublic uses the same mockFrom so profile fetch works in tests
  supabasePublic: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

// Helper: capture the onAuthStateChange callback and simulate events
function setupAuthMock(initialSession: any = null) {
  let authCallback: (event: string, session: any) => void;

  // Default: refreshSession resolves with no session (tests can override)
  mockRefreshSession.mockResolvedValue({
    data: { session: null },
    error: { message: 'No session to refresh' },
  });

  mockOnAuthStateChange.mockImplementation((cb: any) => {
    authCallback = cb;
    // Fire INITIAL_SESSION immediately — this is what the real Supabase SDK does.
    setTimeout(() => cb('INITIAL_SESSION', initialSession), 0);
    return {
      data: { subscription: { unsubscribe: vi.fn() } },
    };
  });

  return {
    fireEvent: (event: string, session: any) => authCallback(event, session),
  };
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides default values when no session exists', async () => {
    setupAuthMock();

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.role).toBe('public');
    expect(result.current.isAdmin).toBe(false);
  });

  it('fetches profile and sets admin role on SIGNED_IN', async () => {
    const fakeUser = { id: 'user-123', email: 'admin@test.com' };
    const fakeSession = { user: fakeUser };

    // Mock profile fetch → admin
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-123', email: 'admin@test.com', role: 'admin' },
            error: null,
          }),
        }),
      }),
    });

    const { fireEvent } = setupAuthMock();

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for initial load (INITIAL_SESSION with null) to finish
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Simulate admin logging in
    fireEvent('SIGNED_IN', fakeSession);

    // Wait for profile to be populated
    await waitFor(() => {
      expect(result.current.profile).not.toBeNull();
    });

    expect(result.current.session).toEqual(fakeSession);
    expect(result.current.user).toEqual(fakeUser);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.role).toBe('admin');
    expect(result.current.profile?.email).toBe('admin@test.com');
  });

  it('sets public role for non-admin users on SIGNED_IN', async () => {
    const fakeUser = { id: 'user-456', email: 'user@test.com' };
    const fakeSession = { user: fakeUser };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-456', email: 'user@test.com', role: 'public' },
            error: null,
          }),
        }),
      }),
    });

    const { fireEvent } = setupAuthMock();

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    fireEvent('SIGNED_IN', fakeSession);

    await waitFor(() => {
      expect(result.current.profile).not.toBeNull();
    });

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.role).toBe('public');
  });

  it('throws error when useAuth is used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    spy.mockRestore();
  });
});
