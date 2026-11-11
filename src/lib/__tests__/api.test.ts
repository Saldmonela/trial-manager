import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc, invoke, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), getUser: vi.fn() }));
vi.mock('../../supabaseClient', () => ({ supabase: { rpc, functions: { invoke }, auth: { getUser } } }));
import { invokeApi, revealFamilyPassword } from '../api';

// The server is the only place credentials are encrypted, decrypted or saved. When an
// Edge Function is unreachable the client must report failure, never reach around it.
describe('invokeApi has no direct-database fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: '10000000-0000-4000-8000-000000000001' } } });
    rpc.mockResolvedValue({ data: { owner_password: 'ciphertext-must-not-be-shown', user_id: 'owner' }, error: null });
  });

  it('a network failure on reveal reports an error and never queries the database', async () => {
    invoke.mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await revealFamilyPassword('family');
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain('ciphertext-must-not-be-shown');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('an undeployed function (404) on save reports an error and never writes directly', async () => {
    invoke.mockResolvedValue({ data: null, error: { context: new Response('Not Found', { status: 404 }) } });
    const result = await invokeApi('save-family', { id: 'family', operation: 'create', ownerPassword: 'synthetic-password' });
    expect(result.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a structured server rejection is passed through unchanged', async () => {
    const body = JSON.stringify({ success: false, code: 'ADMIN_REQUIRED', error: 'Khusus admin.' });
    invoke.mockResolvedValue({ data: null, error: { context: new Response(body, { status: 403 }) } });
    expect(await invokeApi('save-family', {})).toEqual({ success: false, code: 'ADMIN_REQUIRED', error: 'Khusus admin.' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
