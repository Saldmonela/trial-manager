import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import Dashboard from '../Dashboard';

// Mock dependencies
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'en', toggleLanguage: vi.fn() }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ toasts: [], addToast: vi.fn(), removeToast: vi.fn() }),
}));

vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'test', created_at: new Date().toISOString() } } }) },
  },
}));

// Mock child components to isolate Dashboard logic
vi.mock('../family/FamilyCard', () => ({
  default: ({ family }: { family: any }) => <div data-testid="family-card" data-expiry={family.expiryDate} data-created={family.createdAt} data-storage={family.storageUsed}>{family.name}</div>,
}));

vi.mock('../modals/AddFamilyModal', () => ({ default: () => null }));
vi.mock('../modals/EditFamilyModal', () => ({ default: () => null }));
vi.mock('../modals/AddMemberModal', () => ({ default: () => null }));
vi.mock('../modals/DeleteConfirmModal', () => ({ default: () => null }));
vi.mock('../MigrationTool', () => ({ default: () => null }));
vi.mock('../TutorialModal', () => ({ default: () => null }));
vi.mock('../ui/ToastContainer', () => ({ default: () => null }));
vi.mock('../ui/MigrationBanner', () => ({ default: () => null }));

// Mock hooks
const mockFamilies = [
  { id: 1, name: 'OldestCreated', expiryDate: '2026-01-01', createdAt: '2020-01-01', storageUsed: 10 },
  { id: 2, name: 'NewestCreated', expiryDate: '2025-01-01', createdAt: '2024-01-01', storageUsed: 50 },
  { id: 3, name: 'MiddleCreated', expiryDate: '2025-06-01', createdAt: '2022-01-01', storageUsed: 30 },
];

const useSupabaseDataMock = vi.fn();
const useJoinRequestsMock = vi.fn();

vi.mock('../../hooks/useSupabaseData', () => ({
  useSupabaseData: () => useSupabaseDataMock(),
  useJoinRequests: () => useJoinRequestsMock(),
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
    });

    useJoinRequestsMock.mockReturnValue({
      joinRequests: [],
      loading: false,
      updateStatus: vi.fn(),
      refetch: vi.fn(),
    });
  });

  it('sorts by creation date (Oldest first) by default/on button click', async () => {
    render(<Dashboard onLogout={vi.fn()} />);
    
    // Initial State: Default sortBy might be 'expiry' based on implementation (line 72: useState('expiry'))
    // Let's check initial order explicitly if needed, but we focus on button clicks.
    
    // Find "OLDEST" button (mapped to 'created' key, label dashboard.sort.oldest or dashboard.sort.newest)
    // Mock t returns key. So label is 'dashboard.sort.oldest' (if desc? No, asc/desc logic)
    // Line 548: label: sortDirection === 'desc' ? t('dashboard.sort.newest') : t('dashboard.sort.oldest')
    
    // Click button with text 'dashboard.sort.oldest' OR 'dashboard.sort.newest' depending on default state.
    // If default is 'expiry', created button should probably show 'Oldest' (default text for that button)?
    // Wait, the label depends on sortDirection state. Initial sortDirection is 'asc'.
    // So label is 'dashboard.sort.oldest'.
    
    const oldestBtn = screen.getByText('dashboard.sort.oldest');
    fireEvent.click(oldestBtn);
    
    // Expect Sort by Created (Ascending: Oldest first)
    // Order: OldestCreated (2020), MiddleCreated (2022), NewestCreated (2024)
    const items = screen.getAllByTestId('family-card');
    expect(items[0]).toHaveTextContent('OldestCreated');
    expect(items[1]).toHaveTextContent('MiddleCreated');
    expect(items[2]).toHaveTextContent('NewestCreated');
  });

  it('toggles to Newest first when clicking OLDEST again', () => {
    render(<Dashboard onLogout={vi.fn()} />);
    const oldestBtn = screen.getByText('dashboard.sort.oldest');
    
    // Click once to activate (Ascending)
    fireEvent.click(oldestBtn);
    
    // Click again to toggle (Descending)
    // Note: Use getByText again because re-render might change text if label changes based on direction?
    // Line 548 updates label based on direction!
    // So after first click (asc), label is 'oldest'.
    // After second click (desc), label should become 'newest'.
    
    fireEvent.click(oldestBtn);
    
    // Now sorting by Newest Created First
    // Order: NewestCreated, MiddleCreated, OldestCreated
    const items = screen.getAllByTestId('family-card');
    expect(items[0]).toHaveTextContent('NewestCreated');
    expect(items[1]).toHaveTextContent('MiddleCreated');
    expect(items[2]).toHaveTextContent('OldestCreated');
    
    // Button label check?
    expect(screen.getByText('dashboard.sort.newest')).toBeInTheDocument();
  });

  it('sorts by expiry date (Closest first) when clicking CLOSEST', () => {
    render(<Dashboard onLogout={vi.fn()} />);
    // "Closest" corresponds to 'expiry' key. Label 'dashboard.sort.closest'.
    // Default striction is asc.
    // Initial state is ALREADY expiry/asc. Clicking it would toggle to desc (Farthest).
    // so we click another button first to switch away from expiry.
    fireEvent.click(screen.getByText('dashboard.sort.oldest'));
    
    const closestBtn = screen.getByText('dashboard.sort.closest');
    fireEvent.click(closestBtn);
    
    // Expiry Dates:
    // NewestCreated: 2025-01-01 (Earlier/Closest)
    // MiddleCreated: 2025-06-01
    // OldestCreated: 2026-01-01 (Later/Farthest)
    
    // Order: NewestCreated, MiddleCreated, OldestCreated
    const items = screen.getAllByTestId('family-card');
    expect(items[0]).toHaveTextContent('NewestCreated');
    expect(items[1]).toHaveTextContent('MiddleCreated');
    expect(items[2]).toHaveTextContent('OldestCreated');
  });

  it('sorts by storage (Least Used first) when clicking LEAST USED', () => {
    render(<Dashboard onLogout={vi.fn()} />);
    // "Least Used" corresponds to 'storage' key. Label 'dashboard.sort.least_used'.
    const leastUsedBtn = screen.getByText('dashboard.sort.least_used');
    fireEvent.click(leastUsedBtn);
    
    // Storage:
    // OldestCreated: 10
    // MiddleCreated: 30
    // NewestCreated: 50
    
    // Order: OldestCreated, MiddleCreated, NewestCreated
    const items = screen.getAllByTestId('family-card');
    expect(items[0]).toHaveTextContent('OldestCreated');
    expect(items[1]).toHaveTextContent('MiddleCreated');
    expect(items[2]).toHaveTextContent('NewestCreated');
  });
});
