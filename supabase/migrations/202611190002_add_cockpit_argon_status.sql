-- Migration: 202611190002_add_cockpit_argon_status.sql
-- Description: Tambah status kuota Gemini 4 Argon (argon_status) pada cockpit_accounts.
--   - argon_status: 'available' (punya kuota Argon / full model),
--                   'missing'   (tidak punya kuota Argon / model terbatas, tidak diprioritaskan),
--                   'unknown'   (belum dicek — dianggap prioritas secara default).
--   - Aturan Konflik Family Ganda (BR-02) diperbarui:
--     Akun dengan argon_status = 'missing' tidak memicu konflik jika berbagi Family PRO
--     dengan akun lain (boleh 2-4 akun di Family yang sama selama akun No Argon).
-- CATATAN: Jalankan MANUAL via Supabase Dashboard -> SQL Editor.

BEGIN;

ALTER TABLE public.cockpit_accounts
  ADD COLUMN IF NOT EXISTS argon_status text NOT NULL DEFAULT 'unknown';

ALTER TABLE public.cockpit_accounts
  DROP CONSTRAINT IF EXISTS chk_cockpit_argon_status;

ALTER TABLE public.cockpit_accounts
  ADD CONSTRAINT chk_cockpit_argon_status
  CHECK (argon_status IN ('available', 'missing', 'unknown'));

-- Perbarui RPC assign_cockpit_account_to_family agar akun argon_status = 'missing'
-- tidak memicu dan tidak menyebabkan FAMILY_CONFLICT.
CREATE OR REPLACE FUNCTION public.assign_cockpit_account_to_family(
  p_cockpit_account_id uuid,
  p_family_id          text,
  p_member_name        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor         uuid;
  v_account       public.cockpit_accounts;
  v_family        public.families;
  v_member_name   text;
  v_member_count  integer;
  v_conflict_cnt  integer;
  v_member_id     text;
  v_added_at      timestamptz;
BEGIN
  v_actor := public.app_require_admin();

  v_member_name := btrim(COALESCE(p_member_name, ''));
  IF length(v_member_name) < 1 OR length(v_member_name) > 80 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING DETAIL = 'Nama anggota wajib diisi (1-80 karakter).';
  END IF;

  SELECT *
  INTO v_account
  FROM public.cockpit_accounts
  WHERE id = p_cockpit_account_id
    AND user_id = v_actor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND';
  END IF;

  IF v_account.eligibility_status NOT IN ('bisa', 'untagged') THEN
    RAISE EXCEPTION 'ACCOUNT_INELIGIBLE';
  END IF;

  -- Lock baris family untuk mencegah race condition slot penuh atau konflik ganda
  SELECT *
  INTO v_family
  FROM public.families
  WHERE id = p_family_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_family.archived_at IS NOT NULL
     OR COALESCE(v_family.is_banned, false) = true
     OR (v_family.expiry_date IS NOT NULL AND v_family.expiry_date < now()) THEN
    RAISE EXCEPTION 'FAMILY_INVALID';
  END IF;

  -- Cek apakah email sudah ada di family ini (sebagai owner atau member)
  IF lower(btrim(COALESCE(v_family.owner_email, ''))) = v_account.email
     OR EXISTS (
       SELECT 1
       FROM public.members m
       WHERE m.family_id = v_family.id
         AND lower(btrim(COALESCE(m.email, ''))) = v_account.email
     ) THEN
    RAISE EXCEPTION 'ALREADY_IN_FAMILY';
  END IF;

  -- Cek kapasitas maksimal 5 member (BR-03)
  SELECT count(*)
  INTO v_member_count
  FROM public.members
  WHERE family_id = v_family.id;

  IF v_member_count >= 5 THEN
    RAISE EXCEPTION 'FAMILY_FULL';
  END IF;

  -- Cek BR-02: hanya berlaku jika akun target adalah akun prioritas (bukan 'missing' / No Argon)
  -- dan hanya menghitung akun Cockpit aktif lain yang juga prioritas (argon_status <> 'missing').
  IF COALESCE(v_account.argon_status, 'unknown') <> 'missing' THEN
    SELECT count(*)
    INTO v_conflict_cnt
    FROM public.cockpit_accounts ca
    WHERE ca.user_id = v_actor
      AND ca.id <> v_account.id
      AND ca.eligibility_status IN ('bisa', 'untagged')
      AND COALESCE(ca.argon_status, 'unknown') <> 'missing'
      AND (
        ca.email = lower(btrim(COALESCE(v_family.owner_email, '')))
        OR EXISTS (
          SELECT 1
          FROM public.members m
          WHERE m.family_id = v_family.id
            AND lower(btrim(COALESCE(m.email, ''))) = ca.email
        )
      );

    IF v_conflict_cnt > 0 THEN
      RAISE EXCEPTION 'FAMILY_CONFLICT';
    END IF;
  END IF;

  v_member_id := gen_random_uuid()::text;
  v_added_at  := now();

  INSERT INTO public.members (id, family_id, name, email, member_type, storage_used, added_at)
  VALUES (v_member_id, v_family.id, v_member_name, v_account.email, 'pribadi', 0, v_added_at);

  RETURN jsonb_build_object(
    'member_id', v_member_id,
    'family_id', v_family.id,
    'email', v_account.email,
    'added_at', v_added_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_cockpit_account_to_family(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_cockpit_account_to_family(uuid, text, text) TO authenticated, service_role;

COMMIT;
