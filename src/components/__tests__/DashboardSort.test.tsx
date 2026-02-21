import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import Dashboard from '../Dashboard';

// Mock dependencies
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ session: { user: { email: 'test@test.com' } }, user: { email: 'test@test.com' }, profile: null, role: 'admin', isAdmin: true, isLoading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'en', toggleLanguage: vi.fn() }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ toasts: [], addToast: vi.fn(), removeToast: vi.fn() }),
}));

vi.mock('../../hooks/useLocalStorage', () => ({
  useLocalStorage: (key: string, defaultValue: any) => [defaultValue, vi.fn()],
}));

vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'test', created_at: new Date().toISOString() } } }) },
  },
}));

// Mock child components — stubs for irrelevant ones
vi.mock('../modals/AddFamilyModal', () => ({ default: () => null }));
vi.mock('../modals/EditFamilyModal', () => ({ default: () => null }));
vi.mock('../modals/AddMemberModal', () => ({ default: () => null }));
vi.mock('../modals/DeleteConfirmModal', () => ({ default: () => null }));
vi.mock('../MigrationTool', () => ({ default: () => null }));
vi.mock('../TutorialModal', () => ({ default: () => null }));
vi.mock('../ui/ToastContainer', () => ({ default: () => null }));
vi.mock('../ui/MigrationBanner', () => ({ default: () => null }));
vi.mock('../dashboard/DashboardHeader', () => ({ default: () => <div data-testid="dashboard-header" /> }));
vi.mock('../dashboard/MetricsRow', () => ({ default: () => <div data-testid="metrics-row" /> }));
vi.mock('../dashboard/ServicesSection', () => ({ default: () => null }));

// FiltersBar: render actual sort buttons from props so we can click them
vi.mock('../dashboard/FiltersBar', () => ({
  default: ({ sortOptions, sortBy, sortDirection, onSortClick }: any) => (
    <div data-testid="filters-bar">
      {sortOptions?.map((s: any) => (
        <button key={s.key} onClick={() => onSortClick(s.key)} data-testid={`sort-${s.key}`}>
          {sortBy === s.key && sortDirection === 'desc' ? s.labelAlt : s.label}
        </button>
      ))}
    </div>
  ),
}));

// FamiliesGrid: render family names so we can assert sort order
vi.mock('../dashboard/FamiliesGrid', () => ({
  default: ({ sortedFamilies }: any) => (
    <div data-testid="families-grid">
      {sortedFamilies?.map((f: any) => (
        <div key={f.id} data-testid="family-card">{f.name}</div>
      ))}
    </div>
  ),
}));

// Mock hooks
const mockFamilies = [
  { id: 1, name: 'OldestCreated', expiryDate: '2026-01-01', createdAt: '2020-01-01', storageUsed: 10, members: [] },
  { id: 2, name: 'NewestCreated', expiryDate: '2025-01-01', createdAt: '2024-01-01', storageUsed: 50, members: [] },
  { id: 3, name: 'MiddleCreated', expiryDate: '2025-06-01', createdAt: '2022-01-01', storageUsed: 30, members: [] },
];

const useSupabaseDataMock = vi.fn();
const useJoinRequestsMock = vi.fn();

vi.mock('../../hooks/useSupabaseData', () => ({
  useSupabaseData: () => useSupabaseDataMock(),
  useJoinRequests: () => useJoinRequestsMock(),
  useAppSetting: (_key: string, defaultValue: any) => ({ value: defaultValue, setValue: vi.fn(), loading: false, refetch: vi.fn() }),
  updateSetting: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Dashboard Sorting', () => {
  beforeEach(() => {
    useSupabaseDataMock.mockReturnValue({
      families: [...mockFamilies],
      loading: false,
      addFamily: vi.fn(),
      updateFamily: vi.fn(),
      deleteFamily: vi.fn(),
      addMember: vi.fn(),
      removeMember: vi.fn(),
      cancelSale: vi.fn(),
    });

    useJoinRequestsMock.mockReturnValue({
      joinRequests: [],
      loading: false,
      updateStatus: vi.fn(),
      refetch: vi.fn(),
    });
  });

  it('sorts by creation date (Oldest first) by default/on button click', () => {
    render(<Dashboard onLogout={vi.fn()} />);

    // Click the "created" sort button
    const createdBtn = screen.getByTestId('sort-created');
    fireEvent.click(createdBtn);

    // Expect Sort by Created (Ascending: Oldest first)
    // Order: OldestCreated (2020), MiddleCreated (2022), NewestCreated (2024)
    const items = screen.getAllByTestId('family-card');
    expect(items[0]).toHaveTextContent('OldestCreated');
    expect(items[1]).toHaveTextContent('MiddleCreated');
    expect(items[2]).toHaveTextContent('NewestCreated');
  });

  it('toggles to Newest first when clicking created sort again', () => {
    render(<Dashboard onLogout={vi.fn()} />);
    const createdBtn = screen.getByTestId('sort-created');

    // Click once to activate (Ascending)
    fireEvent.click(createdBtn);

    // Click again to toggle (Descending)
    fireEvent.click(screen.getByTestId('sort-created'));

    // Now sorting by Newest Created First
    // Order: NewestCreated, MiddleCreated, OldestCreated
    const items = screen.getAllByTestId('family-card');
    expect(items[0]).toHaveTextContent('NewestCreated');
    expect(items[1]).toHaveTextContent('MiddleCreated');
    expect(items[2]).toHaveTextContent('OldestCreated');
  });

  it('sorts by expiry date (Closest first) when clicking expiry sort', () => {
    render(<Dashboard onLogout={vi.fn()} />);
    // Switch away from default expiry first
    fireEvent.click(screen.getByTestId('sort-created'));

    // Now click expiry sort
    fireEvent.click(screen.getByTestId('sort-expiry'));

    // Expiry Dates:
    // NewestCreated: 2025-01-01 (Earliest/Closest)
    // MiddleCreated: 2025-06-01
    // OldestCreated: 2026-01-01 (Latest/Farthest)
    const items = screen.getAllByTestId('family-card');
    expect(items[0]).toHaveTextContent('NewestCreated');
    expect(items[1]).toHaveTextContent('MiddleCreated');
    expect(items[2]).toHaveTextContent('OldestCreated');
  });

  it('sorts by storage (Least Used first) when clicking storage sort', () => {
    render(<Dashboard onLogout={vi.fn()} />);
    fireEvent.click(screen.getByTestId('sort-storage'));

    // Storage:
    // OldestCreated: 10
    // MiddleCreated: 30
    // NewestCreated: 50
    const items = screen.getAllByTestId('family-card');
    expect(items[0]).toHaveTextContent('OldestCreated');
    expect(items[1]).toHaveTextContent('MiddleCreated');
    expect(items[2]).toHaveTextContent('NewestCreated');
  });
});
