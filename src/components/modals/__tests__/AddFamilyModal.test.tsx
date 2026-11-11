import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '../../../test/test-utils';
import AddFamilyModal from '../AddFamilyModal';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const TODAY = new Date('2026-11-08T10:00:00');

const sampleGoogleAccount = {
  id: 'acct-1',
  provider: 'google_drive' as const,
  providerAccountId: 'sub-123',
  email: 'warnaken@gmail.com',
  displayName: 'Warnaken',
  avatarUrl: null,
  status: 'connected' as const,
  totalBytes: 5 * 1024 ** 4, // 5.0 TB
  usedBytes: 1363148, // ~1.3 MB
  availableBytes: 5 * 1024 ** 4 - 1363148,
  trashBytes: 0,
  lastSyncedAt: '2026-11-08T10:00:00Z',
};

describe('AddFamilyModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('menyediakan preset +6 Bulan, +1 Tahun, +1.5 Tahun, dan +2 Tahun tanpa menumpuk', () => {
    const { container } = render(
      <AddFamilyModal isOpen onClose={vi.fn()} onAdd={vi.fn()} />,
    );
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput.value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: '+6 Bulan' }));
    expect(dateInput.value).toBe('2027-05-08');

    fireEvent.click(screen.getByRole('button', { name: '+1 Tahun' }));
    expect(dateInput.value).toBe('2027-11-08');

    fireEvent.click(screen.getByRole('button', { name: '+1.5 Tahun' }));
    expect(dateInput.value).toBe('2028-05-08');

    fireEvent.click(screen.getByRole('button', { name: '+2 Tahun' }));
    expect(dateInput.value).toBe('2028-11-08');

    // Klik ulang tidak menumpuk ke 2030
    fireEvent.click(screen.getByRole('button', { name: '+2 Tahun' }));
    expect(dateInput.value).toBe('2028-11-08');
  });

  it('mengisi otomatis email, kuota Drive, dan masa aktif +2 Tahun saat prefillAccount tersedia', () => {
    const { container } = render(
      <AddFamilyModal
        isOpen
        onClose={vi.fn()}
        onAdd={vi.fn()}
        prefillAccount={sampleGoogleAccount}
      />,
    );

    const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;

    expect(emailInput.value).toBe('warnaken@gmail.com');
    expect(dateInput.value).toBe('2028-11-08');
    expect(screen.getByText(/Drive Connected/i)).toBeInTheDocument();
    expect(screen.getByText(/5\.0 TB/)).toBeInTheDocument();
  });

  it('memicu onConnectGoogle saat tombol login Google diklik', () => {
    const onConnectGoogle = vi.fn().mockResolvedValue({ success: true });
    render(
      <AddFamilyModal
        isOpen
        onClose={vi.fn()}
        onAdd={vi.fn()}
        onConnectGoogle={onConnectGoogle}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Hubungkan via Login Google/i }));
    expect(onConnectGoogle).toHaveBeenCalledTimes(1);
  });

  it('mengizinkan memilih akun Google yang sudah terhubung namun belum masuk family', () => {
    const { container } = render(
      <AddFamilyModal
        isOpen
        onClose={vi.fn()}
        onAdd={vi.fn()}
        unlinkedAccounts={[sampleGoogleAccount]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /warnaken@gmail\.com/i }));

    const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(emailInput.value).toBe('warnaken@gmail.com');
    expect(dateInput.value).toBe('2028-11-08');
  });
});
