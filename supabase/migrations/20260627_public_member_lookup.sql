-- Migration: 20260627_public_member_lookup.sql
-- Description: Secure public surface for the landing page + status checker.
--
--   SEBELUMNYA migration ini membuat policy `USING (true)` untuk role `anon`
--   pada members/families/connected_accounts. Itu membocorkan SELURUH database
--   ke pengunjung anonim (email member, owner_email, owner_password terenkripsi,
--   user_id sebagai kunci enkripsi, email + kuota akun Google) — bukan hanya
--   "basic status info". RLS membatasi BARIS, bukan KOLOM, jadi siapa pun bisa
--   `select('owner_password,user_id')` lewat anon key dari browser.
--
--   Versi ini:
--     1. Membuang akses langsung anon ke data sensitif.
--     2. Mengunci kolom PII per-kolom (REVOKE/GRANT) sehingga landing page tetap
--        jalan dengan hanya kolom yang memang publik.
--     3. Memindahkan status checker ke RPC SECURITY DEFINER yang exact-match email
--        dan hanya mengembalikan data milik email tsb + agregat storage.
--
-- CATATAN: jalankan MANUAL via Supabase Dashboard -> SQL Editor (repo pakai migrasi manual).
-- Idempotent: aman dijalankan ulang.

-- ============================================================
-- 0. Buang policy lama yang berbahaya
-- ============================================================
DROP POLICY IF EXISTS "Allow public read of basic member info"        ON public.members;
DROP POLICY IF EXISTS "Allow public read of families"                 ON public.families;
DROP POLICY IF EXISTS "Allow public read of connected accounts quota" ON public.connected_accounts;

-- ============================================================
-- 1. members — anon hanya boleh membaca `family_id` (untuk hitung slot)
--    Tidak ada nama/email/expiry yang bocor ke publik lagi.
-- ============================================================
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

REVOKE SELECT ON public.members FROM anon;
GRANT  SELECT (family_id) ON public.members TO anon;

DROP POLICY IF EXISTS "anon can count members" ON public.members;
CREATE POLICY "anon can count members"
  ON public.members FOR SELECT TO anon
  USING (true);

-- ============================================================
-- 2. families — anon hanya boleh kolom marketplace (listing publik).
--    owner_email / owner_password / user_id TIDAK bisa dibaca anon lagi.
-- ============================================================
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

REVOKE SELECT ON public.families FROM anon;
GRANT  SELECT (
  id, name, expiry_date, storage_used,
  price_monthly, price_annual, price_sale, currency,
  product_type, created_at, sold_at, is_banned
) ON public.families TO anon;

DROP POLICY IF EXISTS "anon can read public family listing" ON public.families;
CREATE POLICY "anon can read public family listing"
  ON public.families FOR SELECT TO anon
  USING (true);

-- ============================================================
-- 3. join_requests — anon membuat order (INSERT, tak diubah) dan
--    membaca status reservasi. Hanya id/family_id/status yang publik;
--    nama/email/pesan pemesan TIDAK bocor.
-- ============================================================
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

REVOKE SELECT ON public.join_requests FROM anon;
GRANT  SELECT (id, family_id, status) ON public.join_requests TO anon;

DROP POLICY IF EXISTS "anon can read join request status" ON public.join_requests;
CREATE POLICY "anon can read join request status"
  ON public.join_requests FOR SELECT TO anon
  USING (true);

-- ============================================================
-- 4. connected_accounts — tidak ada akses anon langsung sama sekali.
--    Kuota untuk status checker hanya lewat RPC di bawah (SECURITY DEFINER).
--    (Policy owner authenticated dari migrasi 20260621 tetap berlaku.)
-- ============================================================
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. settings — anon hanya boleh key tampilan publik; admin (authenticated)
--    tetap bisa membaca semua key. Mencegah rahasia masa depan bocor by-default.
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for all users" ON public.settings;

DROP POLICY IF EXISTS "anon can read public settings" ON public.settings;
CREATE POLICY "anon can read public settings"
  ON public.settings FOR SELECT TO anon
  USING (key IN (
    'service_card_style',
    'upgrade_service_title',
    'upgrade_service_desc',
    'upgrade_service_price',
    'upgrade_service_features',
    'upgrade_payment_type',
    'upgrade_validity'
  ));

DROP POLICY IF EXISTS "authenticated can read all settings" ON public.settings;
CREATE POLICY "authenticated can read all settings"
  ON public.settings FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- 6. Rate limit counter (fixed-window per IP) untuk RPC publik.
--    RLS on + tanpa policy => hanya fungsi SECURITY DEFINER yang menyentuhnya.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rpc_rate_limits (
  bucket_key   text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer     NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket_key, window_start)
);
ALTER TABLE public.rpc_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rpc_rate_limits FROM anon, authenticated;

-- ============================================================
-- 7. RPC status checker — exact-match email, hanya data milik email tsb.
--    SECURITY DEFINER: berjalan sebagai owner sehingga bisa membaca kuota
--    connected_accounts tanpa membuka tabelnya ke anon. Tidak mengembalikan
--    email member lain maupun owner_email — hanya angka agregat storage.
--    Dilindungi rate limit 30 panggilan / menit / IP untuk cegah scraping.
-- ============================================================
CREATE OR REPLACE FUNCTION public.lookup_member_status(p_email text)
RETURNS TABLE (
  member_name              text,
  email                    text,
  family_name              text,
  member_type              text,
  member_expiry_date       timestamptz,
  family_expiry_date       timestamptz,
  added_at                 timestamptz,
  storage_used_gb          numeric,
  live_storage_used_bytes  numeric,
  live_storage_total_bytes numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers json;
  v_ip      text;
  v_window  timestamptz := date_trunc('minute', now());
  v_hits    integer;
  v_limit   constant integer := 30;  -- maks 30 cek / menit / IP
BEGIN
  -- Identifikasi IP pemanggil (best-effort; di belakang proxy Supabase/Cloudflare).
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN others THEN
    v_headers := NULL;
  END;

  v_ip := COALESCE(
    NULLIF(btrim(v_headers->>'cf-connecting-ip'), ''),
    NULLIF(btrim(v_headers->>'x-real-ip'), ''),
    NULLIF(btrim(split_part(COALESCE(v_headers->>'x-forwarded-for', ''), ',', 1)), ''),
    'unknown'
  );

  -- Fixed-window counter: naikkan hit untuk (ip, menit-ini).
  INSERT INTO public.rpc_rate_limits (bucket_key, window_start, hits)
  VALUES (v_ip, v_window, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET hits = public.rpc_rate_limits.hits + 1
  RETURNING public.rpc_rate_limits.hits INTO v_hits;

  -- Bersihkan window lama (tabel kecil, murah).
  DELETE FROM public.rpc_rate_limits WHERE window_start < now() - interval '10 minutes';

  IF v_hits > v_limit THEN
    RAISE EXCEPTION 'Terlalu banyak permintaan. Mohon tunggu sebentar lalu coba lagi.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(m.name, 'Member'),
    m.email,
    f.name,
    COALESCE(m.member_type, 'pembeli'),
    m.expiry_date,
    f.expiry_date,
    m.added_at,
    COALESCE(m.storage_used, 0)::numeric,
    q.live_used,
    q.live_total
  FROM public.members m
  JOIN public.families f ON f.id = m.family_id
  LEFT JOIN LATERAL (
    SELECT
      MAX(ca.used_bytes) AS live_used,
      CASE WHEN bool_or(ca.total_bytes IS NULL) THEN NULL
           ELSE MAX(ca.total_bytes) END AS live_total
    FROM public.connected_accounts ca
    WHERE ca.status = 'connected'
      AND lower(ca.email) IN (
        SELECT lower(fm.email)
        FROM public.members fm
        WHERE fm.family_id = f.id AND fm.email IS NOT NULL
        UNION
        SELECT lower(f.owner_email)
        WHERE f.owner_email IS NOT NULL
      )
  ) q ON true
  WHERE lower(m.email) = lower(p_email);
END;
$$;

-- Hanya boleh dipanggil sebagai RPC, bukan diwarisi PUBLIC secara implisit.
REVOKE ALL ON FUNCTION public.lookup_member_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_member_status(text) TO anon, authenticated;
