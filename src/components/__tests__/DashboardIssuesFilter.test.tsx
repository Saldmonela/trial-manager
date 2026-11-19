import { render, screen, fireEvent } from '@testing-library/react';
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
  useLanguage: () => ({
    t: (key: string) => ({
      'dashboard.filters.available': 'Sharing Tersedia',
      'dashboard.filters.full': 'Penuh',
      'dashboard.filters.expiring_soon': 'Segera Berakhir',
      'dashboard.filters.issues': 'Bermasalah / Expired',
      'dashboard.filters.show_issues': 'Tampilkan Bermasalah',
      'dashboard.filters.hide_issues': 'Sembunyikan Bermasalah',
      'dashboard.filters.all': 'Semua Keluarga',
      'dashboard.filters.show_banned': 'Tampilkan Banned',
      'dashboard.filters.hide_banned': 'Sembunyikan Banned',
      'dashboard.sort.label': 'Urutkan:',
    }[key] || key),
    language: 'id',
    toggleLanguage: vi.fn(),
  }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ toasts: [], addToast: vi.fn(), removeToast: vi.fn() }),
}));

const inDays = (days: number) => new Date(Date.now() + days * 86400_000).toISOString();

vi.mock('../../hooks/useConnectedAccounts', () => ({
  useConnectedAccounts: () => ({
    accounts: [
      { id: 'a1', email: 'healthy@test.com', status: 'connected', totalBytes: 2 * 1024 ** 4, usedBytes: 100 * 1024 ** 3, lastSyncedAt: new Date().toISOString() },
      { id: 'a2', email: 'low15@test.com', status: 'connected', totalBytes: 15 * 1024 ** 3, usedBytes: 1024 ** 3, lastSyncedAt: new Date().toISOString() },
      { id: 'a3', email: 'low10@test.com', status: 'connected', totalBytes: 10 * 1024 ** 3, usedBytes: 1024 ** 3, lastSyncedAt: new Date().toISOString() },
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
      { id: '1', name: 'Healthy Family', ownerEmail: 'healthy@test.com', expiryDate: inDays(45), createdAt: '2026-01-01', members: [] },
      { id: '2', name: 'Expired Family', ownerEmail: 'healthy@test.com', expiryDate: inDays(-3), createdAt: '2026-01-02', members: [] },
      { id: '3', name: 'Red Critical Family', ownerEmail: 'healthy@test.com', expiryDate: inDays(2), createdAt: '2026-01-03', members: [] },
      { id: '4', name: 'Low 15GB Family', ownerEmail: 'low15@test.com', expiryDate: inDays(30), createdAt: '2026-01-04', members: [] },
      { id: '5', name: 'Under 15GB Family', ownerEmail: 'low10@test.com', expiryDate: inDays(30), createdAt: '2026-01-05', members: [] },
      { id: '6', name: 'Member Gap Family', ownerEmail: 'healthy@test.com', expiryDate: inDays(10), createdAt: '2026-01-06', members: [{ memberType: 'pembeli', expiryDate: inDays(30) }] },
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
vi.mock('../dashboard/MetricsRow', () => ({ default: () => null }));

vi.mock('../dashboard/FamiliesGrid', () => ({
  default: ({ sortedFamilies }: any) => (
    <div data-testid="families-grid">
      {sortedFamilies?.map((f: any) => (
        <div key={f.id} data-testid="family-card">{f.name}</div>
      ))}
    </div>
  ),
}));

describe('Dashboard Bermasalah / Expired filter tab & hide toggle', () => {
  it('hides expired/red/<=15GB families by default, toggles inline with Tampilkan Bermasalah, and isolates them in the Bermasalah / Expired tab', () => {
    render(<Dashboard onLogout={vi.fn()} />);

    // Default: showIssues = false -> hanya Healthy Family yang tampil di Semua Keluarga
    expect(screen.getAllByTestId('family-card').map((el) => el.textContent)).toEqual(['Healthy Family']);

    // Klik Tampilkan Bermasalah -> semua 6 family tampil
    const toggleIssuesBtn = screen.getByRole('button', { name: /Tampilkan Bermasalah/i });
    expect(toggleIssuesBtn).toHaveTextContent('5');
    fireEvent.click(toggleIssuesBtn);
    expect(screen.getAllByTestId('family-card')).toHaveLength(6);

    // Klik Sembunyikan Bermasalah -> kembali sembunyi
    fireEvent.click(screen.getByRole('button', { name: /Sembunyikan Bermasalah/i }));
    expect(screen.getAllByTestId('family-card').map((el) => el.textContent)).toEqual(['Healthy Family']);

    // Klik tab kategori Bermasalah / Expired -> tampilkan 5 family bermasalah saja
    const issuesTab = screen.getByRole('button', { name: /Bermasalah \/ Expired/i });
    expect(issuesTab).toHaveTextContent('5');
    fireEvent.click(issuesTab);

    const visibleNames = screen.getAllByTestId('family-card').map((el) => el.textContent);
    expect(visibleNames).not.toContain('Healthy Family');
    expect(visibleNames).toEqual(expect.arrayContaining([
      'Expired Family',
      'Red Critical Family',
      'Low 15GB Family',
      'Under 15GB Family',
      'Member Gap Family',
    ]));
    expect(visibleNames).toHaveLength(5);
  });
});
