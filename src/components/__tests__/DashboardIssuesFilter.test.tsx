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
      { id: 'a1', email: 'five5tb@test.com', status: 'connected', totalBytes: 5 * 1024 ** 4, usedBytes: 817 * 1024 ** 3, lastSyncedAt: new Date().toISOString() },
      { id: 'a2', email: 'five5tb-gap@test.com', status: 'connected', totalBytes: 5 * 1024 ** 4, usedBytes: 171 * 1024 ** 3, lastSyncedAt: new Date().toISOString() },
      { id: 'a3', email: 'five5tb-old@test.com', status: 'connected', totalBytes: 5 * 1024 ** 4, usedBytes: 100 * 1024 ** 3, lastSyncedAt: new Date().toISOString() },
      { id: 'a4', email: 'low15@test.com', status: 'connected', totalBytes: 15 * 1024 ** 3, usedBytes: 1024 ** 3, lastSyncedAt: new Date().toISOString() },
      { id: 'a5', email: 'low5@test.com', status: 'connected', totalBytes: 5 * 1024 ** 3, usedBytes: 1024 ** 3, lastSyncedAt: new Date().toISOString() },
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
      { id: '1', name: 'Healthy 5TB Family', ownerEmail: 'five5tb@test.com', expiryDate: inDays(45), createdAt: '2026-01-01', members: [] },
      { id: '2', name: '5TB Member Gap Family', ownerEmail: 'five5tb-gap@test.com', expiryDate: inDays(10), createdAt: '2026-01-02', members: [{ memberType: 'pembeli', expiryDate: inDays(60) }] },
      { id: '3', name: '5TB Stale Date Family', ownerEmail: 'five5tb-old@test.com', expiryDate: inDays(-5), createdAt: '2026-01-03', members: [] },
      { id: '4', name: 'Dropped 15GB Family', ownerEmail: 'low15@test.com', expiryDate: inDays(-2), createdAt: '2026-01-04', members: [] },
      { id: '5', name: 'Dropped 5GB Family', ownerEmail: 'low5@test.com', expiryDate: inDays(-2), createdAt: '2026-01-05', members: [] },
      { id: '6', name: 'Unconnected Expired Family', ownerEmail: 'none@test.com', expiryDate: inDays(-3), createdAt: '2026-01-06', members: [] },
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
  it('keeps 5TB families (even with member gap or stale date) visible in main list, hides reduced-storage/unconnected-expired by default, and toggles/isolates them', () => {
    render(<Dashboard onLogout={vi.fn()} />);

    // Default: showIssues = false -> semua family 5TB tetap tampil (termasuk yang ada member gap / tanggal belum di-update)
    expect(screen.getAllByTestId('family-card').map((el) => el.textContent)).toEqual([
      '5TB Stale Date Family',
      '5TB Member Gap Family',
      'Healthy 5TB Family',
    ]);

    // Klik Tampilkan Bermasalah -> semua 6 family tampil
    const toggleIssuesBtn = screen.getByRole('button', { name: /Tampilkan Bermasalah/i });
    expect(toggleIssuesBtn).toHaveTextContent('3');
    fireEvent.click(toggleIssuesBtn);
    expect(screen.getAllByTestId('family-card')).toHaveLength(6);

    // Klik Sembunyikan Bermasalah -> kembali sembunyikan 3 akun yang bermasalah/expired
    fireEvent.click(screen.getByRole('button', { name: /Sembunyikan Bermasalah/i }));
    expect(screen.getAllByTestId('family-card')).toHaveLength(3);

    // Klik tab kategori Bermasalah / Expired -> hanya 3 family yang storage-nya turun / expired tanpa 5TB
    const issuesTab = screen.getByRole('button', { name: /Bermasalah \/ Expired/i });
    expect(issuesTab).toHaveTextContent('3');
    fireEvent.click(issuesTab);

    const visibleNames = screen.getAllByTestId('family-card').map((el) => el.textContent);
    expect(visibleNames).toEqual([
      'Unconnected Expired Family',
      'Dropped 5GB Family',
      'Dropped 15GB Family',
    ]);
  });
});
