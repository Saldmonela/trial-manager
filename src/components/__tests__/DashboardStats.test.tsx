import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import Dashboard from '../Dashboard';

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
  useToast: () => ({ toasts: [], addToast: vi.fn(), removeToast: vi.fn() }),
}));

const inDays = (days: number) => new Date(Date.now() + days * 86400_000).toISOString();

vi.mock('../../hooks/useConnectedAccounts', () => ({
  useConnectedAccounts: () => ({
    accounts: [
      { id: 'a1', email: 'valid5tb@test.com', status: 'connected', totalBytes: 5 * 1024 ** 4, usedBytes: 817 * 1024 ** 3, lastSyncedAt: new Date().toISOString() },
      { id: 'a2', email: 'expired5tb@test.com', status: 'connected', totalBytes: 5 * 1024 ** 4, usedBytes: 500 * 1024 ** 3, lastSyncedAt: new Date().toISOString() },
      { id: 'a3', email: 'low15gb@test.com', status: 'connected', totalBytes: 15 * 1024 ** 3, usedBytes: 1024 ** 3, lastSyncedAt: new Date().toISOString() },
      { id: 'a4', email: 'two2tb@test.com', status: 'connected', totalBytes: 2 * 1024 ** 4, usedBytes: 1024 ** 3, lastSyncedAt: new Date().toISOString() },
    ],
    loading: false,
    error: null,
    connectGoogleDrive: vi.fn(),
    syncQuota: vi.fn(),
    syncAll: vi.fn(),
    disconnect: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('../../hooks/useSupabaseData', () => ({
  useSupabaseData: () => ({
    families: [
      { id: '1', name: 'Valid 5TB Full', ownerEmail: 'valid5tb@test.com', expiryDate: inDays(60), createdAt: '2026-01-01', members: [{}, {}, {}, {}, {}] },
      { id: '2', name: 'Expired Date Still 5TB', ownerEmail: 'expired5tb@test.com', expiryDate: inDays(-5), createdAt: '2026-01-02', members: [{}, {}] },
      { id: '3', name: 'Broken 15GB', ownerEmail: 'low15gb@test.com', expiryDate: inDays(-2), createdAt: '2026-01-03', members: [{}, {}, {}] },
      { id: '4', name: 'Small 2TB', ownerEmail: 'two2tb@test.com', expiryDate: inDays(60), createdAt: '2026-01-04', members: [{}] },
      { id: '5', name: 'Unconnected', ownerEmail: 'none@test.com', expiryDate: inDays(60), createdAt: '2026-01-05', members: [{}, {}] },
      { id: '6', name: 'Banned 5TB', ownerEmail: 'valid5tb@test.com', expiryDate: inDays(60), createdAt: '2026-01-06', isBanned: true, members: [{}] },
    ],
    loading: false,
    refetch: vi.fn(),
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
vi.mock('../dashboard/FiltersBar', () => ({ default: () => null }));
vi.mock('../dashboard/FamiliesGrid', () => ({ default: () => null }));

vi.mock('../dashboard/MetricsRow', () => ({
  default: ({ stats, familiesCount }: any) => (
    <div data-testid="metrics-summary">
      <span data-testid="stat-total">{stats.total}</span>
      <span data-testid="stat-full">{`${stats.full}/${familiesCount}`}</span>
      <span data-testid="stat-slots">{`${stats.availableSlots}/${familiesCount * 5}`}</span>
      <span data-testid="stat-members">{stats.totalMembers}</span>
    </div>
  ),
}));

describe('Dashboard valid (>= 5TB) stats calculation', () => {
  it('counts only non-banned families with >= 5TB storage, including expired-date families still at 5TB', () => {
    render(<Dashboard onLogout={vi.fn()} />);

    expect(screen.getByTestId('stat-total')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-full')).toHaveTextContent('1/2');
    expect(screen.getByTestId('stat-slots')).toHaveTextContent('3/10');
    expect(screen.getByTestId('stat-members')).toHaveTextContent('7');
  });
});
