import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../test/test-utils';
import FamilyCard from '../FamilyCard';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const TODAY = new Date('2026-07-26T10:00:00');

/** Tanggal yang jatuh tepat `days` hari dari TODAY (getDaysRemaining pakai Math.ceil). */
function inDays(days: number) {
  return new Date(TODAY.getTime() + days * 86400000).toISOString();
}

function renderCard(expiryDate: string) {
  // FamilyCard mendestructure semua handler tanpa default, jadi semuanya wajib diisi.
  const noop = vi.fn();
  return render(
    <FamilyCard
      family={{ id: 'f1', name: 'Family 19', expiryDate, members: [] }}
      onDelete={noop}
      onEdit={noop}
      onAddMember={noop}
      onRemoveMember={noop}
      onEditMember={noop}
      onCancelSale={noop}
      onRequest={noop}
      onConnectDrive={noop}
      onSyncDrive={noop}
      onDisconnectDrive={noop}
    />,
  );
}

describe('FamilyCard badge sisa masa aktif', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  // Angka ini persis yang muncul di kartu dashboard sebelum perubahan format.
  it('menampilkan tahun + bulan, bukan ratusan hari', () => {
    renderCard(inDays(519));
    expect(screen.getByText('1 TAHUN 5 BULAN')).toBeInTheDocument();
    expect(screen.queryByText(/519/)).not.toBeInTheDocument();
  });

  it('menampilkan bulan + hari di bawah setahun', () => {
    renderCard(inDays(309));
    expect(screen.getByText('10 BULAN 9 HARI')).toBeInTheDocument();
  });

  it('menampilkan hari saja saat tinggal sedikit', () => {
    renderCard(inDays(5));
    expect(screen.getByText('5 HARI')).toBeInTheDocument();
  });

  it('mengikuti toggle bahasa', () => {
    // LanguageProvider membaca bahasa dari localStorage saat mount.
    localStorage.setItem('fm_language', 'en');
    renderCard(inDays(519));
    expect(screen.getByText('1 YEAR 5 MONTHS')).toBeInTheDocument();
  });
});
