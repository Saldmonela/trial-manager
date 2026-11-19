import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/test-utils';
import DirectConnectPage from '../DirectConnectPage';

const { beginDriveConnection, completeDriveConnection, useAuth } = vi.hoisted(() => ({
  beginDriveConnection: vi.fn(),
  completeDriveConnection: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../../../hooks/useConnectedAccounts', () => ({
  beginDriveConnection,
  completeDriveConnection,
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth,
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }),
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

describe('DirectConnectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/connect');
    useAuth.mockReturnValue({ isAdmin: false });
    beginDriveConnection.mockResolvedValue({ success: true });
    completeDriveConnection.mockResolvedValue(null);
  });

  it('mengirim PIN dan email hint ke beginDriveConnection dengan redirect /connect', async () => {
    render(<DirectConnectPage />);

    fireEvent.change(screen.getByLabelText(/PIN Koneksi/i), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText(/Email Google/i), { target: { value: 'trial@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Connect Google Drive/i }));

    await waitFor(() => {
      expect(beginDriveConnection).toHaveBeenCalledWith('/connect', 'trial@gmail.com', '', '123456');
    });
  });

  it('menampilkan pesan error jika PIN salah', async () => {
    beginDriveConnection.mockResolvedValue({ success: false, code: 'INVALID_PIN', error: 'PIN salah. Coba lagi.' });
    render(<DirectConnectPage />);

    fireEvent.change(screen.getByLabelText(/PIN Koneksi/i), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: /Connect Google Drive/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('PIN salah. Coba lagi.');
  });

  it('langsung bypass PIN jika user sudah login sebagai admin', async () => {
    useAuth.mockReturnValue({ isAdmin: true });
    render(<DirectConnectPage />);

    expect(screen.queryByLabelText(/PIN Koneksi/i)).not.toBeInTheDocument();
    expect(screen.getByText(/PIN tidak diperlukan/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Connect Google Drive/i }));
    await waitFor(() => {
      expect(beginDriveConnection).toHaveBeenCalledWith('/connect', '', '', '');
    });
  });

  it('menyelesaikan OAuth callback dan menampilkan akun yang terhubung', async () => {
    window.history.replaceState(null, '', '/connect#drive_state=abc&drive_code=xyz');
    completeDriveConnection.mockResolvedValue({
      success: true,
      data: {
        id: 'acc-1',
        email: 'trial-user@gmail.com',
        displayName: 'Trial User',
        usedBytes: 1073741824,
        totalBytes: 2199023255552,
        expiredFamilies: [],
      },
    });

    render(<DirectConnectPage />);

    expect(await screen.findByText('Google Drive Terhubung!')).toBeInTheDocument();
    expect(screen.getByText('trial-user@gmail.com')).toBeInTheDocument();
    expect(screen.getByText(/1\.0 GB \/ 2\.0 TB/)).toBeInTheDocument();
  });
});
