-- Migration: 202611190001_add_cockpit_accounts.sql
-- Description: v1.0 Integrasi Pantau Akun Cockpit & Penempatan Family PRO Unik.
--   - cockpit_accounts : metadata & tag akun dari Cockpit Tools (TANPA refresh_token / rahasia).
--   - assign_cockpit_account_to_family : RPC transaksional dengan row lock FOR UPDATE untuk
--     mencegah konflik family ganda (BR-02) dan slot penuh > 5 member (BR-03).
-- CATATAN: Jalankan MANUAL via Supabase Dashboard -> SQL Editor.

BEGIN;

-- ============================================================
-- 1. Tabel cockpit_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cockpit_accounts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email                text NOT NULL,
  plan_tier            text NOT NULL DEFAULT 'AUTO_FAMILY',
  eligibility_status   text NOT NULL DEFAULT 'untagged',
  raw_tags             jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_current           boolean NOT NULL DEFAULT false,
  switch_time          timestamptz,
  quotas               jsonb NOT NULL DEFAULT '[]'::jsonb,
  available_ai_credits numeric,
  notes                text,
  last_synced_at       timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_cockpit_accounts_user_email UNIQUE (user_id, email),
  CONSTRAINT chk_cockpit_email_normalized CHECK (
    email = lower(btrim(email))
    AND length(email) <= 254
    AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  CONSTRAINT chk_cockpit_plan_tier CHECK (plan_tier IN ('AUTO_FAMILY', 'PRO', 'FREE')),
  CONSTRAINT chk_cockpit_eligibility CHECK (eligibility_status IN ('bisa', 'ban', 'need_verif', 'untagged')),
  CONSTRAINT chk_cockpit_notes_len CHECK (notes IS NULL OR length(notes) <= 500),
  CONSTRAINT chk_cockpit_raw_tags_array CHECK (jsonb_typeof(raw_tags) = 'array'),
  CONSTRAINT chk_cockpit_quotas_array CHECK (jsonb_typeof(quotas) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_cockpit_accounts_user_synced
  ON public.cockpit_accounts (user_id, last_synced_at DESC);

-- Trigger updated_at (aman bila set_updated_at sudah ada dari migrasi sebelumnya)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cockpit_accounts_updated ON public.cockpit_accounts;
CREATE TRIGGER trg_cockpit_accounts_updated
  BEFORE UPDATE ON public.cockpit_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. Keamanan & RLS (Admin-only, owner-scoped)
-- ============================================================
ALTER TABLE public.cockpit_accounts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cockpit_accounts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cockpit_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cockpit_accounts TO authenticated;

DROP POLICY IF EXISTS app_admin_cockpit_accounts ON public.cockpit_accounts;
CREATE POLICY app_admin_cockpit_accounts
  ON public.cockpit_accounts
  FOR ALL
  TO authenticated
  USING (public.app_is_admin() AND user_id = (SELECT auth.uid()))
  WITH CHECK (public.app_is_admin() AND user_id = (SELECT auth.uid()));

-- ============================================================
-- 3. RPC Transaksional: assign_cockpit_account_to_family (US-03)
--    Menjamin BR-02 (maks 1 akun Cockpit aktif per Family Owner)
--    dan BR-03 (maks 5 member, family aktif & belum kedaluwarsa)
--    secara atomik dengan row lock FOR UPDATE.
-- ============================================================
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

  -- Cek BR-02: 0 akun Cockpit aktif (bisa/untagged) milik owner yang sudah berada di family ini
  SELECT count(*)
  INTO v_conflict_cnt
  FROM public.cockpit_accounts ca
  WHERE ca.user_id = v_actor
    AND ca.id <> v_account.id
    AND ca.eligibility_status IN ('bisa', 'untagged')
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
