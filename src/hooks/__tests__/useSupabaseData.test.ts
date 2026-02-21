import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Mock Supabase client ─────────────────────────────────────────
const mockFrom = vi.fn();
const mockChannel = vi.fn();
const mockRemoveChannel = vi.fn();
const mockGetUser = vi.fn();

vi.mock('../../supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

// ── Mock crypto to passthrough ────────────────────────────────────
vi.mock('../../lib/crypto', () => ({
  encryptPassword: vi.fn((plaintext: string) => Promise.resolve(`encrypted_${plaintext}`)),
  decryptPassword: vi.fn((encrypted: string) => Promise.resolve(encrypted.replace('encrypted_', ''))),
  isEncrypted: vi.fn((val: string) => val?.startsWith('encrypted_')),
}));

// Import AFTER mocks are set up
import { useSupabaseData } from '../useSupabaseData';

// ── Helpers ───────────────────────────────────────────────────────
const MOCK_USER_ID = 'user-uuid-123';

function createChainableMock(data: unknown = [], error: unknown = null) {
  const chain: any = {
    select: vi.fn().mockReturnValue(Promise.resolve({ data, error })),
    insert: vi.fn().mockReturnValue(Promise.resolve({ data, error })),
    eq: vi.fn().mockReturnValue(Promise.resolve({ data, error })),
    is: vi.fn().mockReturnValue(Promise.resolve({ data, error })),
  };
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  return chain;
}

const MOCK_FAMILIES_RAW = [
  {
    id: 'fam-1',
    name: 'Netflix Family',
    owner_email: 'owner@test.com',
    owner_password: 'encrypted_secret123',
    expiry_date: '2026-03-01',
    storage_used: 100,
    notes: 'Test notes',
    created_at: '2026-01-01',
    user_id: MOCK_USER_ID,
    members: [
      {
        id: 'mem-1',
        family_id: 'fam-1',
        name: 'John',
        email: 'john@test.com',
        added_at: '2026-01-15',
      },
    ],
  },
];

const MOCK_MEMBERS_RAW = [
  {
    id: 'mem-1',
    family_id: 'fam-1',
    name: 'John',
    email: 'john@test.com',
    added_at: '2026-01-15',
  },
];

describe('useSupabaseData', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUser.mockResolvedValue({
      data: { user: { id: MOCK_USER_ID } },
    });

    // Setup channel mock (realtime subscription)
    const channelChain = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    };
    mockChannel.mockReturnValue(channelChain);

    // Default: families query (with embedded members via JOIN) succeeds
    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return createChainableMock(MOCK_FAMILIES_RAW);
      }
      return createChainableMock();
    });
  });

  it('fetches and merges families with members on mount', async () => {
    const { result } = renderHook(() => useSupabaseData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.families).toHaveLength(1);
    expect(result.current.families[0].name).toBe('Netflix Family');
    expect(result.current.families[0].ownerEmail).toBe('owner@test.com');
    expect(result.current.families[0].members).toHaveLength(1);
    expect(result.current.families[0].members[0].name).toBe('John');
  });

  it('addFamily inserts with encrypted password and returns success', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return {
          select: vi.fn().mockResolvedValue({ data: MOCK_FAMILIES_RAW, error: null }),
          insert: insertMock,
        };
      }
      return createChainableMock();
    });

    const { result } = renderHook(() => useSupabaseData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    let actionResult: { success: boolean; error?: string };
    await act(async () => {
      actionResult = await result.current.addFamily({
        id: 'fam-new',
        name: 'Spotify Family',
        ownerEmail: 'new@test.com',
        ownerPassword: 'newpass',
        expiryDate: '2026-06-01',
        storageUsed: 0,
        notes: '',
      });
    });

    expect(actionResult!.success).toBe(true);
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'fam-new',
        name: 'Spotify Family',
        owner_password: 'encrypted_newpass',
      }),
    ]);
  });

  it('addFamily returns error on Supabase failure', async () => {
    const insertMock = vi.fn().mockResolvedValue({
      error: { message: 'Insert failed' },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        const emptyFamilies = [{ ...MOCK_FAMILIES_RAW[0], members: [] }];
        return {
          select: vi.fn().mockResolvedValue({ data: emptyFamilies, error: null }),
          insert: insertMock,
        };
      }
      return createChainableMock([]);
    });

    const { result } = renderHook(() => useSupabaseData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let actionResult: { success: boolean; error?: string };
    await act(async () => {
      actionResult = await result.current.addFamily({
        id: 'fam-err',
        name: 'Fail Plan',
        ownerEmail: 'fail@test.com',
        ownerPassword: 'pass',
        expiryDate: '2026-06-01',
        storageUsed: 0,
      });
    });

    expect(actionResult!.success).toBe(false);
    expect(actionResult!.error).toBe('Insert failed');
  });

  it('deleteFamily performs optimistic update and calls Supabase', async () => {
    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return {
          select: vi.fn().mockResolvedValue({ data: MOCK_FAMILIES_RAW, error: null }),
          delete: deleteMock,
        };
      }
      return createChainableMock();
    });

    const { result } = renderHook(() => useSupabaseData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.families).toHaveLength(1);

    let actionResult: { success: boolean; error?: string };
    await act(async () => {
      actionResult = await result.current.deleteFamily('fam-1');
    });

    expect(actionResult!.success).toBe(true);
    // Optimistic: family removed immediately from state
    expect(result.current.families).toHaveLength(0);
    expect(deleteMock).toHaveBeenCalled();
  });

  it('addMember adds member to the correct family', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return createChainableMock(MOCK_FAMILIES_RAW);
      }
      if (table === 'members') {
        return {
          select: vi.fn().mockResolvedValue({ data: MOCK_MEMBERS_RAW, error: null }),
          insert: insertMock,
        };
      }
      return createChainableMock();
    });

    const { result } = renderHook(() => useSupabaseData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let actionResult: { success: boolean; error?: string };
    await act(async () => {
      actionResult = await result.current.addMember('fam-1', {
        id: 'mem-new',
        name: 'Jane',
        email: 'jane@test.com',
        addedAt: '2026-02-13',
        added_at: '2026-02-13',
      });
    });

    expect(actionResult!.success).toBe(true);
    // Optimistic: member added to family
    expect(result.current.families[0].members).toHaveLength(2);
  });

  it('removeMember removes member from state and calls Supabase', async () => {
    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'families') {
        return createChainableMock(MOCK_FAMILIES_RAW);
      }
      if (table === 'members') {
        return {
          select: vi.fn().mockResolvedValue({ data: MOCK_MEMBERS_RAW, error: null }),
          delete: deleteMock,
        };
      }
      return createChainableMock();
    });

    const { result } = renderHook(() => useSupabaseData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.families[0].members).toHaveLength(1);

    let actionResult: { success: boolean; error?: string };
    await act(async () => {
      actionResult = await result.current.removeMember('fam-1', 'mem-1');
    });

    expect(actionResult!.success).toBe(true);
    expect(result.current.families[0].members).toHaveLength(0);
  });
});
