-- =====================================================================
-- Migration: Tutup akses baca `authenticated` ke kredensial & data pelanggan
-- Tanggal   : 2026-07-26
-- Jalankan  : MANUAL via Supabase Dashboard -> SQL Editor
--
-- ⚠️  JANGAN LANGSUNG JALANKAN SEMUA. Baca STEP 0 dulu.
--     File ini punya langkah backfill yang WAJIB dijalankan sebelum
--     policy diganti, kalau tidak sebagian family akan hilang dari dashboard.
--
-- MASALAH YANG DIPERBAIKI
--   `supabase_schema.sql:40,46,52` membuat policy SELECT `USING (true)`
--   TANPA klausa `TO`. Di Postgres itu berarti `TO PUBLIC` -> berlaku untuk
--   `anon` DAN `authenticated`.
--
--   `20260627_public_member_lookup.sql` hanya menulis `REVOKE ... FROM anon`,
--   jadi `anon` sudah aman (terverifikasi lewat probe). Tapi `authenticated`
--   tidak pernah dicabut, dan policy `USING(true)` tidak pernah di-DROP
--   (statement DROP di sana menyasar nama policy yang tidak pernah ada).
--
--   Akibatnya: siapa pun yang bisa login (pendaftaran Google terbuka) bisa
--   membaca `owner_password`, `owner_email`, `notes`, `sold_to_email`, dan
--   seluruh daftar member.
--
-- KENAPA BUKAN REVOKE PER-KOLOM SEPERTI 20260627
--   Admin juga ber-role `authenticated` dan MEMANG butuh `owner_password`.
--   Jadi solusinya bukan menutup kolom, tapi membatasi BARIS: ganti
--   `USING(true)` dengan kepemilikan (`auth.uid() = user_id`).
-- =====================================================================


-- =====================================================================
-- STEP 0 — DIAGNOSTIK (jalankan sendiri, baca hasilnya, jangan lanjut dulu)
-- =====================================================================

-- 0a. Konfirmasi temuannya nyata. Cari baris dengan roles={public} & cmd=SELECT
--     pada families/members/join_requests. Kalau ada, temuan #1 terkonfirmasi.
SELECT tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('families','members','join_requests','settings')
ORDER BY tablename, cmd;

-- 0b. ⚠️ PALING PENTING. Hitung family tanpa pemilik.
--     `fetchFamilies` (useSupabaseData.ts:454) mengambil '*' TANPA filter
--     user_id — selama ini dia bergantung pada USING(true). Setiap baris
--     dengan user_id NULL akan HILANG dari dashboard setelah STEP 2.
SELECT
  count(*)                                        AS total_family,
  count(*) FILTER (WHERE user_id IS NULL)         AS tanpa_pemilik,
  count(DISTINCT user_id)                         AS jumlah_pemilik_berbeda
FROM public.families;

-- 0c. Kalau `tanpa_pemilik` > 0, lihat barisnya dan tentukan pemilik yang benar.
SELECT id, name, owner_email, created_at
FROM public.families
WHERE user_id IS NULL
ORDER BY created_at;

-- 0d. Cari UUID admin. Catat nilainya untuk STEP 1.
SELECT id, email, role FROM public.profiles WHERE role = 'admin';

-- 0e. Kalau `jumlah_pemilik_berbeda` > 1, BERHENTI dan periksa manual —
--     berarti ada lebih dari satu pemilik dan asumsi "admin tunggal" salah.


-- =====================================================================
-- STEP 1 — BACKFILL (hanya jalankan kalau STEP 0b menunjukkan tanpa_pemilik > 0)
-- =====================================================================

-- Ganti '00000000-0000-0000-0000-000000000000' dengan UUID dari STEP 0d.
-- BEGIN/COMMIT dipisah supaya bisa dibatalkan kalau jumlah barisnya janggal.
BEGIN;

UPDATE public.families
SET user_id = '00000000-0000-0000-0000-000000000000'::uuid
WHERE user_id IS NULL;

-- Harus mengembalikan 0. Kalau bukan 0, jalankan ROLLBACK; bukan COMMIT;
SELECT count(*) AS sisa_tanpa_pemilik
FROM public.families WHERE user_id IS NULL;

COMMIT;

-- Cegah orphan baru muncul lagi.
ALTER TABLE public.families ALTER COLUMN user_id SET NOT NULL;


-- =====================================================================
-- STEP 2 — GANTI POLICY (jalankan setelah STEP 1 bersih)
-- =====================================================================
BEGIN;

-- --- families -------------------------------------------------------
-- Ini policy yang sebenarnya ada di DB (bukan nama yang di-DROP 20260627).
DROP POLICY IF EXISTS "Public read families" ON public.families;

-- Jalur anon TIDAK disentuh: "anon can read public family listing" dari
-- 20260627 tetap berlaku dan sudah dibatasi kolom lewat GRANT. Storefront aman.
CREATE POLICY "owner reads own families"
  ON public.families FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- --- members --------------------------------------------------------
DROP POLICY IF EXISTS "Public read members" ON public.members;

CREATE POLICY "owner reads own members"
  ON public.members FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = members.family_id AND f.user_id = auth.uid()
  ));

-- --- join_requests --------------------------------------------------
DROP POLICY IF EXISTS "Public read join_requests" ON public.join_requests;

CREATE POLICY "owner reads own join_requests"
  ON public.join_requests FOR SELECT
  TO authenticated
  USING (
    family_id IS NULL  -- order upgrade standalone tidak terikat family
    OR EXISTS (
      SELECT 1 FROM public.families f
      WHERE f.id = join_requests.family_id AND f.user_id = auth.uid()
    )
  );

-- Temuan #4: sebelumnya WITH CHECK (true) TO PUBLIC — siapa pun bisa
-- menyuntik order dengan status 'approved'. Sekarang status dipaksa 'pending'.
DROP POLICY IF EXISTS "Public insert join_requests" ON public.join_requests;

CREATE POLICY "anyone submits pending order"
  ON public.join_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');

-- --- settings (temuan #3) -------------------------------------------
-- Sebelumnya cukup `auth.role() = 'authenticated'` -> user login mana pun
-- bisa mengubah harga & judul produk di etalase.
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.settings;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.settings;

CREATE POLICY "admin writes settings"
  ON public.settings FOR ALL
  TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.profiles p
                      WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p
                      WHERE p.id = auth.uid() AND p.role = 'admin'));

COMMIT;


-- =====================================================================
-- STEP 3 — VERIFIKASI
-- =====================================================================

-- 3a. Tidak boleh ada lagi roles={public} untuk SELECT di tiga tabel ini.
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('families','members','join_requests','settings')
ORDER BY tablename, cmd;

-- 3b. ⚠️ JANGAN pakai `SELECT count(*) FROM families` polos di SQL Editor.
--     SQL Editor jalan sebagai superuser dan MELEWATI RLS, jadi angkanya
--     selalu total baris — tidak membuktikan policy bekerja.
--
--     Cara benar: nyamar jadi role + JWT tertentu di dalam transaksi yang
--     di-ROLLBACK (jadi tidak mengubah apa pun).

-- 3b-i. Sebagai ADMIN — harus SAMA dengan total_family dari STEP 0b.
BEGIN;
  SELECT set_config('request.jwt.claims',
    '{"sub":"GANTI-DENGAN-UUID-ADMIN","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) AS terlihat_admin FROM public.families;
ROLLBACK;

-- 3b-ii. Sebagai user login LAIN (UUID acak) — harus 0.
--        Kalau angkanya > 0, temuan #1 BELUM tertutup.
BEGIN;
  SELECT set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) AS terlihat_orang_lain              FROM public.families;
  SELECT count(*) AS member_terlihat_orang_lain       FROM public.members;
  SELECT count(*) AS order_terlihat_orang_lain        FROM public.join_requests;
ROLLBACK;

-- 3b-iii. Sebagai anon — storefront harus tetap jalan (kolom terbatas).
BEGIN;
  SET LOCAL ROLE anon;
  SELECT count(*) AS terlihat_anon
  FROM public.families;              -- kolom publik saja, harus > 0
ROLLBACK;

-- 3c. Di aplikasi: buka /admin (harus muncul 20 kartu family, password terbaca),
--     lalu buka / dan /dashboard dalam jendela samaran (LiveStats & cek status
--     email tetap jalan — jalur anon tidak disentuh migration ini).


-- =====================================================================
-- ROLLBACK (kalau ada yang rusak)
-- =====================================================================
-- BEGIN;
--   DROP POLICY IF EXISTS "owner reads own families"      ON public.families;
--   DROP POLICY IF EXISTS "owner reads own members"       ON public.members;
--   DROP POLICY IF EXISTS "owner reads own join_requests" ON public.join_requests;
--   DROP POLICY IF EXISTS "anyone submits pending order"  ON public.join_requests;
--   DROP POLICY IF EXISTS "admin writes settings"         ON public.settings;
--   CREATE POLICY "Public read families"      ON public.families      FOR SELECT USING (true);
--   CREATE POLICY "Public read members"       ON public.members       FOR SELECT USING (true);
--   CREATE POLICY "Public read join_requests" ON public.join_requests FOR SELECT USING (true);
--   CREATE POLICY "Public insert join_requests" ON public.join_requests FOR INSERT WITH CHECK (true);
-- COMMIT;
-- ALTER TABLE public.families ALTER COLUMN user_id DROP NOT NULL;


-- =====================================================================
-- BELUM DIPERBAIKI DI SINI (sengaja, butuh keputusan terpisah)
-- =====================================================================
-- * Temuan #2: kunci enkripsi password = `user_id` yang tersimpan di baris
--   yang sama (useSupabaseData.ts:25-29). Migration ini menutup SIAPA yang
--   bisa membaca barisnya, tapi enkripsinya sendiri tetap tidak bernilai
--   terhadap kebocoran dump/backup. Perbaikannya butuh pindah ke secret
--   sungguhan + dekripsi-ulang seluruh data dengan kunci lama SEBELUM
--   diganti — sekali kunci lama hilang, password tidak bisa dipulihkan.
-- * Temuan #5: `disable_signup: false`. Tutup lewat Dashboard ->
--   Authentication -> Sign In / Providers -> Email -> matikan
--   "Allow new users to sign up". Ini yang menentukan apakah orang luar
--   bisa mendaftar untuk mengeksploitasi celah di atas.
