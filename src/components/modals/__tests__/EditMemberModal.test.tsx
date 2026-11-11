import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '../../../test/test-utils';
import EditMemberModal from '../EditMemberModal';

// Mock framer-motion to avoid animation issues in tests (same as Modal.test.tsx)
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// "Hari ini" dipatok supaya kasus perpanjangan (basis = hari ini) deterministik.
const TODAY = new Date('2026-07-30T10:00:00');

/** Member aktif: ditambahkan 26 Jul 2026, paket 6 bulan (belum lewat). */
const activeMember = {
  id: 'm1',
  name: 'cs Syafiq 5',
  email: 'amruikhwan500@gmail.com',
  addedAt: '2026-07-26T08:00:00',
  storageUsed: 0,
  memberType: 'pembeli' as const,
  expiryDate: '2027-01-26T08:00:00',
};

const families = [
  // Family asal: 1 anggota (member yang lagi diedit), habis Jun 2027.
  { id: 'f1', name: 'Family 19', expiryDate: '2027-06-21', members: [activeMember] },
  // Lebih lama dari expiry member -> tujuan yang sehat.
  { id: 'f2', name: 'Family 22', expiryDate: '2027-12-01', members: [{ id: 'x' }, { id: 'y' }] },
  // Habis Ags 2026, LEBIH CEPAT dari expiry member (Jan 2027) -> harus ditandai ⚠.
  { id: 'f3', name: 'Family 12', expiryDate: '2026-08-01', members: [] },
  // 5/5 -> harus terkunci.
  { id: 'f4', name: 'Family 30', expiryDate: '2028-01-01', members: [1, 2, 3, 4, 5].map((n) => ({ id: `p${n}` })) },
];

function setup(overrides: Record<string, unknown> = {}) {
  const onUpdate = vi.fn();
  const { container } = render(
    <EditMemberModal
      isOpen
      onClose={vi.fn()}
      onUpdate={onUpdate}
      familyId="f1"
      member={activeMember}
      families={families}
      {...overrides}
    />,
  );
  return {
    onUpdate,
    dateInput: () => container.querySelector('input[type="date"]') as HTMLInputElement,
    // Urutan select di form: [0] Tipe Anggota, [1] Family
    familySelect: () => screen.getAllByRole('combobox')[1] as HTMLSelectElement,
    submit: () => fireEvent.submit(container.querySelector('form') as HTMLFormElement),
  };
}

describe('EditMemberModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('tombol preset paket', () => {
    it('menghitung dari tanggal member ditambahkan, bukan hari ini', () => {
      const { dateInput } = setup();
      expect(dateInput().value).toBe('2027-01-26'); // nilai awal

      fireEvent.click(screen.getByRole('button', { name: '1 Tahun' }));

      // added_at 26 Jul 2026 + 12 bulan. Kalau dari hari ini (30 Jul) hasilnya 2027-07-30.
      expect(dateInput().value).toBe('2027-07-26');
    });

    it('menimpa, bukan menumpuk, saat diklik berkali-kali', () => {
      const { dateInput } = setup();

      fireEvent.click(screen.getByRole('button', { name: '6 Bulan' }));
      expect(dateInput().value).toBe('2027-01-26');

      fireEvent.click(screen.getByRole('button', { name: '1 Tahun' }));
      expect(dateInput().value).toBe('2027-07-26');

      fireEvent.click(screen.getByRole('button', { name: '1 Tahun' }));
      expect(dateInput().value).toBe('2027-07-26'); // tetap, bukan 2028
    });

    it('menyediakan paket 1.5 tahun', () => {
      const { dateInput } = setup();
      fireEvent.click(screen.getByRole('button', { name: '1.5 Tahun' }));
      expect(dateInput().value).toBe('2028-01-26');
    });

    it('beralih ke hari ini untuk member yang sudah lewat masa aktif', () => {
      const expired = { ...activeMember, expiryDate: '2026-07-20T08:00:00' };
      const { dateInput } = setup({ member: expired });

      fireEvent.click(screen.getByRole('button', { name: '1 Tahun' }));

      // Perpanjangan: periode baru mulai hari ini (30 Jul 2026), bukan dari added_at.
      expect(dateInput().value).toBe('2027-07-30');
    });

    it('menampilkan basis perhitungan yang dipakai', () => {
      setup();
      expect(screen.getByText(/Dihitung dari 26 Jul 2026/)).toBeInTheDocument();
    });
  });

  describe('dropdown pindah family', () => {
    it('menandai family yang masa aktifnya lebih pendek dari member', () => {
      setup();
      expect(screen.getByRole('option', { name: /Family 12/ }).textContent).toContain('⚠');
      expect(screen.getByRole('option', { name: /Family 22/ }).textContent).not.toContain('⚠');
    });

    it('mengunci family yang slotnya penuh', () => {
      setup();
      const full = screen.getByRole('option', { name: /Family 30/ }) as HTMLOptionElement;
      expect(full.textContent).toContain('PENUH');
      expect(full.disabled).toBe(true);

      // Family asal tidak ikut terkunci walau hitungan slotnya penuh.
      const current = screen.getByRole('option', { name: /Family 19/ }) as HTMLOptionElement;
      expect(current.disabled).toBe(false);
    });

    it('memindahkan member tanpa mengubah expiry date', () => {
      const { onUpdate, familySelect, submit } = setup();

      fireEvent.change(familySelect(), { target: { value: 'f2' } });
      submit();

      expect(onUpdate).toHaveBeenCalledTimes(1);
      const [fromFamilyId, memberId, fields] = onUpdate.mock.calls[0];
      expect(fromFamilyId).toBe('f1');
      expect(memberId).toBe('m1');
      expect(fields.family_id).toBe('f2');
      // Inti fitur: sisa masa aktif ikut apa adanya.
      expect(fields.expiryDate).toBe('2027-01-26');
    });

    it('tidak mengirim family_id saat family tidak diubah', () => {
      const { onUpdate, submit } = setup();

      submit();

      expect(onUpdate.mock.calls[0][2]).not.toHaveProperty('family_id');
    });

    it('tetap bisa memindahkan sekaligus mengubah paket', () => {
      const { onUpdate, familySelect, submit } = setup();

      fireEvent.click(screen.getByRole('button', { name: '1 Tahun' }));
      fireEvent.change(familySelect(), { target: { value: 'f2' } });
      submit();

      const fields = onUpdate.mock.calls[0][2];
      expect(fields.family_id).toBe('f2');
      expect(fields.expiryDate).toBe('2027-07-26');
    });
  });
});
