-- Migration: 202611200001_add_family_cooldown_guard.sql
-- Description: Riwayat & Proteksi Cooldown Pindah Google Family (12 Bulan) untuk Akun Pribadi
--   + Penandaan Family PRO Turun ke FREE (downgraded_free).
--   - public.account_family_history : riwayat gabung/keluar Family akun pribadi (RLS admin-only).
--   - public.families               : kolom plan_status, downgraded_at, downgrade_note.
--   - Seed otomatis entri awal dari members pribadi aktif yang sudah ada (idempoten).
--   - RPC atomik: assign_cockpit_account_to_family (v2), add_personal_member_with_history,
--     remove_personal_member_with_history, set_family_plan_status.
-- CATATAN: Jalankan MANUAL via Supabase Dashboard -> SQL Editor (aman dijalankan ulang / idempoten).

BEGIN;

-- ============================================================
-- 1. Ekstensi kolom plan_status pada public.families (US-06)
-- ============================================================
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'pro_active',
  ADD COLUMN IF NOT EXISTS downgraded_at timestamptz,
  ADD COLUMN IF NOT EXISTS downgrade_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_families_plan_status'
  ) THEN
    ALTER TABLE public.families
      ADD CONSTRAINT chk_families_plan_status
      CHECK (plan_status IN ('pro_active', 'downgraded_free'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_families_downgrade_note_len'
  ) THEN
    ALTER TABLE public.families
      ADD CONSTRAINT chk_families_downgrade_note_len
      CHECK (downgrade_note IS NULL OR length(downgrade_note) <= 200);
  END IF;
END $$;

-- ============================================================
-- 2. Tabel public.account_family_history (US-01, US-04, US-05)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.account_family_history (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_email               text NOT NULL,
  family_id                   text REFERENCES public.families(id) ON DELETE SET NULL,
  family_name_snapshot        text NOT NULL,
  family_owner_email_snapshot text,
  member_id                   text,
  joined_at                   timestamptz NOT NULL DEFAULT now(),
  left_at                     timestamptz,
  source                      text NOT NULL DEFAULT 'manual',
  leave_reason                text,
  counts_for_cooldown         boolean NOT NULL DEFAULT true,
  override_reason_type        text,
  override_note               text,
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_afh_email_normalized CHECK (
    account_email = lower(btrim(account_email))
    AND length(account_email) <= 254
    AND account_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  CONSTRAINT chk_afh_family_name_len CHECK (
    length(btrim(family_name_snapshot)) BETWEEN 1 AND 120
  ),
  CONSTRAINT chk_afh_owner_email_normalized CHECK (
    family_owner_email_snapshot IS NULL
    OR (
      family_owner_email_snapshot = lower(btrim(family_owner_email_snapshot))
      AND length(family_owner_email_snapshot) <= 254
      AND family_owner_email_snapshot ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  CONSTRAINT chk_afh_joined_not_future CHECK (joined_at <= now() + interval '1 day'),
  CONSTRAINT chk_afh_left_valid CHECK (
    left_at IS NULL
    OR (left_at >= joined_at AND left_at <= now() + interval '1 day')
  ),
  CONSTRAINT chk_afh_source CHECK (source IN ('auto_assign', 'auto_admin', 'auto_seed', 'manual')),
  CONSTRAINT chk_afh_leave_reason CHECK (
    leave_reason IS NULL
    OR leave_reason IN (
      'still_active',
      'family_downgraded_free',
      'family_expired',
      'manual_move',
      'local_correction',
      'other'
    )
  ),
  CONSTRAINT chk_afh_override_reason_type CHECK (
    override_reason_type IS NULL
    OR override_reason_type IN ('local_correction', 'family_downgraded_free', 'emergency_other')
  ),
  CONSTRAINT chk_afh_override_note_len CHECK (override_note IS NULL OR length(override_note) <= 200),
  CONSTRAINT chk_afh_notes_len CHECK (notes IS NULL OR length(notes) <= 300)
);

CREATE INDEX IF NOT EXISTS idx_afh_user_email_joined
  ON public.account_family_history (user_id, account_email, joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_afh_family_id
  ON public.account_family_history (family_id)
  WHERE family_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_afh_active_member
  ON public.account_family_history (user_id, account_email, family_id)
  WHERE left_at IS NULL AND family_id IS NOT NULL AND counts_for_cooldown = true;

-- Trigger updated_at
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

DROP TRIGGER IF EXISTS trg_afh_updated ON public.account_family_history;
CREATE TRIGGER trg_afh_updated
  BEFORE UPDATE ON public.account_family_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. Keamanan & RLS (Admin-only, owner-scoped — BR-07)
-- ============================================================
ALTER TABLE public.account_family_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_family_history FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_family_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_family_history TO authenticated;

DROP POLICY IF EXISTS app_admin_account_family_history ON public.account_family_history;
CREATE POLICY app_admin_account_family_history
  ON public.account_family_history
  FOR ALL
  TO authenticated
  USING (public.app_is_admin() AND user_id = (SELECT auth.uid()))
  WITH CHECK (public.app_is_admin() AND user_id = (SELECT auth.uid()));

-- ============================================================
-- 4. Seed awal idempoten dari member pribadi yang sudah aktif
-- ============================================================
INSERT INTO public.account_family_history (
  user_id,
  account_email,
  family_id,
  family_name_snapshot,
  family_owner_email_snapshot,
  member_id,
  joined_at,
  left_at,
  source,
  leave_reason,
  counts_for_cooldown
)
SELECT
  COALESCE(f.user_id, ca.user_id) AS user_id,
  lower(btrim(m.email)) AS account_email,
  f.id AS family_id,
  COALESCE(NULLIF(btrim(f.name), ''), NULLIF(btrim(f.owner_email), ''), 'Family Plan') AS family_name_snapshot,
  CASE
    WHEN f.owner_email IS NOT NULL
      AND lower(btrim(f.owner_email)) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    THEN lower(btrim(f.owner_email))
    ELSE NULL
  END AS family_owner_email_snapshot,
  m.id AS member_id,
  LEAST(COALESCE(m.added_at, now()), now()) AS joined_at,
  NULL AS left_at,
  'auto_seed' AS source,
  'still_active' AS leave_reason,
  true AS counts_for_cooldown
FROM public.members m
JOIN public.families f ON f.id = m.family_id
LEFT JOIN public.cockpit_accounts ca
  ON ca.email = lower(btrim(m.email))
WHERE f.archived_at IS NULL
  AND m.email IS NOT NULL
  AND lower(btrim(m.email)) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  AND COALESCE(f.user_id, ca.user_id) IS NOT NULL
  AND (m.member_type = 'pribadi' OR ca.id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. RPC v2: assign_cockpit_account_to_family (US-01, US-03, US-06)
--    Atomik: cek konflik & downgraded_free, opsional tutup family lama,
--    insert members + insert account_family_history dalam 1 transaksi.
-- ============================================================
DROP FUNCTION IF EXISTS public.assign_cockpit_account_to_family(uuid, text, text);

CREATE OR REPLACE FUNCTION public.assign_cockpit_account_to_family(
  p_cockpit_account_id       uuid,
  p_family_id                text,
  p_member_name              text,
  p_leave_previous_family_id text DEFAULT NULL,
  p_override_reason_type     text DEFAULT NULL,
  p_override_note            text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor             uuid;
  v_account           public.cockpit_accounts;
  v_family            public.families;
  v_member_name       text;
  v_member_count      integer;
  v_conflict_cnt      integer;
  v_member_id         text;
  v_added_at          timestamptz;
  v_history_id        uuid;
  v_owner_email_clean text;
  v_prev_family_id    text;
BEGIN
  v_actor := public.app_require_admin();

  v_member_name := btrim(COALESCE(p_member_name, ''));
  IF length(v_member_name) < 1 OR length(v_member_name) > 80 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING DETAIL = 'Nama anggota wajib diisi (1-80 karakter).';
  END IF;

  IF p_override_reason_type IS NOT NULL
     AND p_override_reason_type NOT IN ('local_correction', 'family_downgraded_free', 'emergency_other') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING DETAIL = 'Alasan override tidak valid.';
  END IF;

  IF p_override_note IS NOT NULL AND length(p_override_note) > 200 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING DETAIL = 'Catatan override maksimal 200 karakter.';
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

  -- Lock baris family tujuan untuk mencegah race condition slot penuh atau konflik ganda
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

  IF COALESCE(v_family.plan_status, 'pro_active') = 'downgraded_free' THEN
    RAISE EXCEPTION 'FAMILY_DOWNGRADED';
  END IF;

  IF lower(btrim(COALESCE(v_family.owner_email, ''))) = v_account.email
     OR EXISTS (
       SELECT 1
       FROM public.members m
       WHERE m.family_id = v_family.id
         AND lower(btrim(COALESCE(m.email, ''))) = v_account.email
     ) THEN
    RAISE EXCEPTION 'ALREADY_IN_FAMILY';
  END IF;

  SELECT count(*)
  INTO v_member_count
  FROM public.members
  WHERE family_id = v_family.id;

  IF v_member_count >= 5 THEN
    RAISE EXCEPTION 'FAMILY_FULL';
  END IF;

  -- Cek BR-02: 0 akun Cockpit prioritas lain (bukan No Argon) di family tujuan
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

  v_added_at := now();

  -- Jika ini perpindahan langsung dari Family sebelumnya (mis. Family turun ke FREE),
  -- keluarkan member dari Family lama & tutup riwayat aktifnya secara atomik.
  v_prev_family_id := NULLIF(btrim(COALESCE(p_leave_previous_family_id, '')), '');
  IF v_prev_family_id IS NOT NULL AND v_prev_family_id <> v_family.id THEN
    DELETE FROM public.members
    WHERE family_id = v_prev_family_id
      AND lower(btrim(COALESCE(email, ''))) = v_account.email;

    UPDATE public.account_family_history
    SET
      left_at = GREATEST(joined_at, v_added_at),
      leave_reason = COALESCE(
        CASE WHEN p_override_reason_type = 'family_downgraded_free' THEN 'family_downgraded_free' ELSE NULL END,
        'manual_move'
      )
    WHERE user_id = v_actor
      AND account_email = v_account.email
      AND family_id = v_prev_family_id
      AND left_at IS NULL;
  END IF;

  v_member_id := gen_random_uuid()::text;

  INSERT INTO public.members (id, family_id, name, email, member_type, storage_used, added_at)
  VALUES (v_member_id, v_family.id, v_member_name, v_account.email, 'pribadi', 0, v_added_at);

  v_owner_email_clean := lower(btrim(COALESCE(v_family.owner_email, '')));
  IF v_owner_email_clean !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    v_owner_email_clean := NULL;
  END IF;

  INSERT INTO public.account_family_history (
    user_id,
    account_email,
    family_id,
    family_name_snapshot,
    family_owner_email_snapshot,
    member_id,
    joined_at,
    left_at,
    source,
    leave_reason,
    counts_for_cooldown,
    override_reason_type,
    override_note
  )
  VALUES (
    v_actor,
    v_account.email,
    v_family.id,
    COALESCE(NULLIF(btrim(v_family.name), ''), v_owner_email_clean, 'Family Plan'),
    v_owner_email_clean,
    v_member_id,
    v_added_at,
    NULL,
    'auto_assign',
    'still_active',
    true,
    p_override_reason_type,
    NULLIF(btrim(COALESCE(p_override_note, '')), '')
  )
  ON CONFLICT (user_id, account_email, family_id)
    WHERE left_at IS NULL AND family_id IS NOT NULL AND counts_for_cooldown = true
  DO UPDATE SET
    member_id = EXCLUDED.member_id,
    updated_at = now()
  RETURNING id INTO v_history_id;

  RETURN jsonb_build_object(
    'member_id', v_member_id,
    'family_id', v_family.id,
    'email', v_account.email,
    'added_at', v_added_at,
    'history_id', v_history_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_cockpit_account_to_family(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_cockpit_account_to_family(uuid, text, text, text, text, text) TO authenticated, service_role;

-- ============================================================
-- 6. RPC Baru: add_personal_member_with_history (Admin AddMember)
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_personal_member_with_history(
  p_family_id            text,
  p_member_id            text,
  p_name                 text,
  p_email                text,
  p_storage_used         numeric DEFAULT 0,
  p_member_type          text DEFAULT 'pembeli',
  p_expiry_date          timestamptz DEFAULT NULL,
  p_override_reason_type text DEFAULT NULL,
  p_override_note        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor             uuid;
  v_family            public.families;
  v_email_clean       text;
  v_member_id         text;
  v_member_count      integer;
  v_added_at          timestamptz;
  v_is_personal       boolean;
  v_history_id        uuid;
  v_owner_email_clean text;
BEGIN
  v_actor := public.app_require_admin();

  v_email_clean := lower(btrim(COALESCE(p_email, '')));
  IF v_email_clean = '' OR length(v_email_clean) > 254 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING DETAIL = 'Email anggota tidak valid.';
  END IF;

  IF p_member_type NOT IN ('pribadi', 'pembeli') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING DETAIL = 'Tipe anggota tidak valid.';
  END IF;

  SELECT *
  INTO v_family
  FROM public.families
  WHERE id = p_family_id
    AND archived_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAMILY_NOT_FOUND';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.family_id = v_family.id
      AND lower(btrim(COALESCE(m.email, ''))) = v_email_clean
  ) THEN
    RAISE EXCEPTION 'ALREADY_IN_FAMILY';
  END IF;

  SELECT count(*) INTO v_member_count FROM public.members WHERE family_id = v_family.id;
  IF v_member_count >= 5 THEN
    RAISE EXCEPTION 'FAMILY_FULL';
  END IF;

  v_member_id := COALESCE(NULLIF(btrim(COALESCE(p_member_id, '')), ''), gen_random_uuid()::text);
  v_added_at := now();

  INSERT INTO public.members (id, family_id, name, email, member_type, storage_used, added_at, expiry_date)
  VALUES (
    v_member_id,
    v_family.id,
    COALESCE(btrim(p_name), ''),
    v_email_clean,
    p_member_type,
    GREATEST(COALESCE(p_storage_used, 0), 0),
    v_added_at,
    CASE WHEN p_member_type = 'pribadi' THEN NULL ELSE p_expiry_date END
  );

  -- BR-01: Catat riwayat jika member_type = 'pribadi' ATAU email terdaftar di cockpit_accounts
  v_is_personal := (p_member_type = 'pribadi') OR EXISTS (
    SELECT 1
    FROM public.cockpit_accounts ca
    WHERE ca.user_id = v_actor
      AND ca.email = v_email_clean
  );

  IF v_is_personal AND v_email_clean ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    v_owner_email_clean := lower(btrim(COALESCE(v_family.owner_email, '')));
    IF v_owner_email_clean !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      v_owner_email_clean := NULL;
    END IF;

    INSERT INTO public.account_family_history (
      user_id,
      account_email,
      family_id,
      family_name_snapshot,
      family_owner_email_snapshot,
      member_id,
      joined_at,
      left_at,
      source,
      leave_reason,
      counts_for_cooldown,
      override_reason_type,
      override_note
    )
    VALUES (
      v_actor,
      v_email_clean,
      v_family.id,
      COALESCE(NULLIF(btrim(v_family.name), ''), v_owner_email_clean, 'Family Plan'),
      v_owner_email_clean,
      v_member_id,
      v_added_at,
      NULL,
      'auto_admin',
      'still_active',
      true,
      p_override_reason_type,
      NULLIF(btrim(COALESCE(p_override_note, '')), '')
    )
    ON CONFLICT (user_id, account_email, family_id)
      WHERE left_at IS NULL AND family_id IS NOT NULL AND counts_for_cooldown = true
    DO UPDATE SET
      member_id = EXCLUDED.member_id,
      updated_at = now()
    RETURNING id INTO v_history_id;
  END IF;

  RETURN jsonb_build_object(
    'member_id', v_member_id,
    'family_id', v_family.id,
    'email', v_email_clean,
    'added_at', v_added_at,
    'history_id', v_history_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_personal_member_with_history(text, text, text, text, numeric, text, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_personal_member_with_history(text, text, text, text, numeric, text, timestamptz, text, text) TO authenticated, service_role;

-- ============================================================
-- 7. RPC Baru: remove_personal_member_with_history (Admin DeleteMember)
-- ============================================================
CREATE OR REPLACE FUNCTION public.remove_personal_member_with_history(
  p_family_id            text,
  p_member_id            text,
  p_removal_mode         text DEFAULT 'google_leave',
  p_leave_reason         text DEFAULT NULL,
  p_override_reason_type text DEFAULT NULL,
  p_override_note        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor             uuid;
  v_family            public.families;
  v_member            public.members;
  v_email_clean       text;
  v_is_personal       boolean;
  v_history_id        uuid;
  v_left_at           timestamptz;
  v_counts            boolean;
  v_effective_reason  text;
  v_owner_email_clean text;
BEGIN
  v_actor := public.app_require_admin();

  IF p_removal_mode NOT IN ('google_leave', 'local_correction') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING DETAIL = 'Mode pengeluaran tidak valid.';
  END IF;

  SELECT *
  INTO v_family
  FROM public.families
  WHERE id = p_family_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAMILY_NOT_FOUND';
  END IF;

  SELECT *
  INTO v_member
  FROM public.members
  WHERE id = p_member_id
    AND family_id = p_family_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND';
  END IF;

  DELETE FROM public.members
  WHERE id = p_member_id
    AND family_id = p_family_id;

  v_email_clean := lower(btrim(COALESCE(v_member.email, '')));
  v_is_personal := (COALESCE(v_member.member_type, 'pembeli') = 'pribadi') OR EXISTS (
    SELECT 1
    FROM public.cockpit_accounts ca
    WHERE ca.user_id = v_actor
      AND ca.email = v_email_clean
  );

  v_counts := (p_removal_mode <> 'local_correction');
  v_left_at := now();
  v_effective_reason := CASE
    WHEN p_removal_mode = 'local_correction' THEN 'local_correction'
    WHEN p_leave_reason IS NOT NULL THEN p_leave_reason
    WHEN COALESCE(v_family.plan_status, 'pro_active') = 'downgraded_free' THEN 'family_downgraded_free'
    ELSE 'manual_move'
  END;

  IF v_is_personal AND v_email_clean ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    -- Cari entri aktif yang cocok di account_family_history
    SELECT id
    INTO v_history_id
    FROM public.account_family_history
    WHERE user_id = v_actor
      AND account_email = v_email_clean
      AND family_id = v_family.id
      AND left_at IS NULL
    ORDER BY joined_at DESC
    LIMIT 1;

    IF v_history_id IS NOT NULL THEN
      UPDATE public.account_family_history
      SET
        left_at = GREATEST(joined_at, v_left_at),
        leave_reason = v_effective_reason,
        counts_for_cooldown = v_counts,
        override_reason_type = COALESCE(p_override_reason_type, override_reason_type),
        override_note = COALESCE(NULLIF(btrim(COALESCE(p_override_note, '')), ''), override_note)
      WHERE id = v_history_id;
    ELSIF v_counts THEN
      -- Fallback bila member sudah ada sebelum migrasi & belum punya entri aktif
      v_owner_email_clean := lower(btrim(COALESCE(v_family.owner_email, '')));
      IF v_owner_email_clean !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
        v_owner_email_clean := NULL;
      END IF;

      INSERT INTO public.account_family_history (
        user_id,
        account_email,
        family_id,
        family_name_snapshot,
        family_owner_email_snapshot,
        member_id,
        joined_at,
        left_at,
        source,
        leave_reason,
        counts_for_cooldown,
        override_reason_type,
        override_note
      )
      VALUES (
        v_actor,
        v_email_clean,
        v_family.id,
        COALESCE(NULLIF(btrim(v_family.name), ''), v_owner_email_clean, 'Family Plan'),
        v_owner_email_clean,
        v_member.id,
        LEAST(COALESCE(v_member.added_at, v_left_at), v_left_at),
        v_left_at,
        'auto_admin',
        v_effective_reason,
        true,
        p_override_reason_type,
        NULLIF(btrim(COALESCE(p_override_note, '')), '')
      )
      RETURNING id INTO v_history_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'removed_member_id', p_member_id,
    'history_id', v_history_id,
    'counts_for_cooldown', v_counts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.remove_personal_member_with_history(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_personal_member_with_history(text, text, text, text, text, text) TO authenticated, service_role;

-- ============================================================
-- 8. RPC Baru: set_family_plan_status (US-06)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_family_plan_status(
  p_family_id      text,
  p_plan_status    text,
  p_downgrade_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor          uuid;
  v_family         public.families;
  v_downgraded_at  timestamptz;
  v_note_clean     text;
BEGIN
  v_actor := public.app_require_admin();

  IF p_plan_status NOT IN ('pro_active', 'downgraded_free') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING DETAIL = 'Status paket Family tidak valid.';
  END IF;

  v_note_clean := NULLIF(btrim(COALESCE(p_downgrade_note, '')), '');
  IF v_note_clean IS NOT NULL AND length(v_note_clean) > 200 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING DETAIL = 'Catatan maksimal 200 karakter.';
  END IF;

  SELECT *
  INTO v_family
  FROM public.families
  WHERE id = p_family_id
    AND archived_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAMILY_NOT_FOUND';
  END IF;

  IF p_plan_status = 'downgraded_free' THEN
    v_downgraded_at := COALESCE(v_family.downgraded_at, now());
  ELSE
    v_downgraded_at := NULL;
    v_note_clean := NULL;
  END IF;

  UPDATE public.families
  SET
    plan_status = p_plan_status,
    downgraded_at = v_downgraded_at,
    downgrade_note = v_note_clean
  WHERE id = p_family_id;

  -- Catat audit log jika tabel app_audit_log tersedia
  IF to_regclass('public.app_audit_log') IS NOT NULL THEN
    INSERT INTO public.app_audit_log (actor_id, object_type, object_id, action, details)
    VALUES (
      v_actor,
      'family',
      p_family_id,
      'family_plan_status_changed',
      jsonb_build_object(
        'previous_status', COALESCE(v_family.plan_status, 'pro_active'),
        'new_status', p_plan_status,
        'downgrade_note', v_note_clean
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'family_id', p_family_id,
    'plan_status', p_plan_status,
    'downgraded_at', v_downgraded_at,
    'downgrade_note', v_note_clean
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_family_plan_status(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_family_plan_status(text, text, text) TO authenticated, service_role;

COMMIT;
