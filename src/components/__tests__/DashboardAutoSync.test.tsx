import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import Dashboard from '../Dashboard';

const syncAllMock = vi.fn();
const refetchFamiliesMock = vi.fn();
const addToastMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    session: { user: { email: 'admin@test.com' } },
    user: { email: 'admin@test.com' },
    profile: null,
    role: 'admin',
    isAdmin: true,
    isLoading: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'id', toggleLanguage: vi.fn() }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ toasts: [], addToast: addToastMock, removeToast: vi.fn() }),
}));

vi.mock('../../hooks/useConnectedAccounts', () => ({
  useConnectedAccounts: () => ({
    accounts: [
      {
        id: 'acc-1',
        provider: 'google_drive',
        providerAccountId: 'sub-1',
        email: 'owner@example.test',
        displayName: 'Owner',
        avatarUrl: null,
        status: 'connected',
        totalBytes: 2 * 1024 ** 4,
        usedBytes: 1024 ** 3,
        availableBytes: 2 * 1024 ** 4 - 1024 ** 3,
        trashBytes: 0,
        lastSyncedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
    ],
    loading: false,
    error: null,
    connectGoogleDrive: vi.fn(),
    syncQuota: vi.fn(),
    syncAll: syncAllMock,
    disconnect: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('../../hooks/useSupabaseData', () => ({
  useSupabaseData: () => ({
    families: [{ id: 'f1', name: 'Family A', ownerEmail: 'owner@example.test', expiryDate: '2027-01-01', members: [] }],
    loading: false,
    refetch: refetchFamiliesMock,
    addFamily: vi.fn(),
    updateFamily: vi.fn(),
    deleteFamily: vi.fn(),
    addMember: vi.fn(),
    updateMember: vi.fn(),
    removeMember: vi.fn(),
    cancelSale: vi.fn(),
  }),
}));

vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'test', created_at: new Date().toISOString() } } }) },
  },
}));

vi.mock('../modals/AddFamilyModal', () => ({ default: () => null }));
vi.mock('../modals/EditFamilyModal', () => ({ default: () => null }));
vi.mock('../modals/AddMemberModal', () => ({ default: () => null }));
vi.mock('../modals/EditMemberModal', () => ({ default: () => null }));
vi.mock('../modals/DeleteConfirmModal', () => ({ default: () => null }));
vi.mock('../modals/DeleteMemberConfirmModal', () => ({ default: () => null }));
vi.mock('../modals/SettingsModal', () => ({ default: () => null }));
vi.mock('../MigrationTool', () => ({ default: () => null }));
vi.mock('../TutorialModal', () => ({ default: () => null }));
vi.mock('../ui/ToastContainer', () => ({ default: () => null }));
vi.mock('../ui/MigrationBanner', () => ({ default: () => null }));
vi.mock('../dashboard/DashboardHeader', () => ({ default: () => null }));
vi.mock('../dashboard/MetricsRow', () => ({ default: () => null }));
vi.mock('../dashboard/FiltersBar', () => ({ default: () => null }));
vi.mock('../dashboard/FamiliesGrid', () => ({ default: () => null }));

describe('Dashboard auto-sync Drive detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-syncs stale Drive accounts on mount and refreshes families + shows alert when 15GB is detected', async () => {
    syncAllMock.mockResolvedValue({
      success: true,
      data: {
        results: [
          {
            id: 'acc-1',
            ok: true,
            email: 'owner@example.test',
            lowStorageTier: '15GB',
            expiredFamilies: [{ id: 'f1', name: 'Family A' }],
          },
        ],
      },
    });

    render(<Dashboard onLogout={vi.fn()} />);

    await waitFor(() => {
      expect(syncAllMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(refetchFamiliesMock).toHaveBeenCalledTimes(1);
      expect(addToastMock).toHaveBeenCalledWith(
        expect.stringContaining('15GB'),
        'error',
        8000,
      );
    });
  });
});
