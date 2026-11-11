import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../test/test-utils';
import StoragePage from '../StoragePage';

vi.mock('../../../supabaseClient', () => ({ supabase: null }));
vi.mock('../../../hooks/useConnectedAccounts', () => ({
  useConnectedAccounts: () => ({
    accounts: [],
    loading: false,
    error: null,
    connectGoogleDrive: vi.fn(),
    syncQuota: vi.fn(),
    syncAll: vi.fn(),
    disconnect: vi.fn(),
    refetch: vi.fn(),
  }),
}));
vi.mock('../ConnectAccountButton', () => ({ default: () => null }));
vi.mock('../StorageAggregateCard', () => ({ default: () => null }));
vi.mock('../ConnectedAccountCard', () => ({ default: () => null }));
vi.mock('../StoragePreviewPanel', () => ({ default: () => null }));
vi.mock('../../ui/ToastContainer', () => ({ default: () => null }));
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('StoragePage', () => {
  it('memberi spasi antara label tebal "Not linked to a family" dan kalimat sesudahnya', () => {
    render(<StoragePage />);
    const paragraph = screen.getByText('Not linked to a family').closest('p');
    // Tanpa spasi eksplisit, JSX membuang baris baru di antara <b> dan teks, jadi terbaca "familybelum".
    expect(paragraph?.textContent).toContain('Not linked to a family belum cocok');
  });
});
