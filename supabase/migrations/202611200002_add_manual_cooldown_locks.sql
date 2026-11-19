-- Migration: 202611200002_add_manual_cooldown_locks.sql
-- Description: Penandaan manual untuk akun pribadi yang SUDAH terkunci cooldown 12 bulan
--   Google Family sebelum fitur ini dibuat (hanya bisa menetap / kembali di Family terakhirnya,
--   tidak bisa pindah ke Family lain; tanggal bebas bersifat opsional bila lupa tanggal persisnya).
-- CATATAN: Idempoten — aman dijalankan ulang via Supabase CLI / SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.account_cooldown_locks (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_email             text NOT NULL,
  is_locked                 boolean NOT NULL DEFAULT true,
  locked_family_id          text REFERENCES public.families(id) ON DELETE SET NULL,
  locked_family_name        text,
  locked_family_owner_email text,
  cooldown_ends_at          timestamptz,
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_acl_user_email UNIQUE (user_id, account_email),
  CONSTRAINT chk_acl_email_normalized CHECK (
    account_email = lower(btrim(account_email))
    AND length(account_email) <= 254
    AND account_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  CONSTRAINT chk_acl_family_name_len CHECK (
    locked_family_name IS NULL OR length(btrim(locked_family_name)) BETWEEN 1 AND 120
  ),
  CONSTRAINT chk_acl_owner_email_normalized CHECK (
    locked_family_owner_email IS NULL
    OR (
      locked_family_owner_email = lower(btrim(locked_family_owner_email))
      AND length(locked_family_owner_email) <= 254
      AND locked_family_owner_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  CONSTRAINT chk_acl_notes_len CHECK (notes IS NULL OR length(notes) <= 300)
);

CREATE INDEX IF NOT EXISTS idx_acl_user_locked
  ON public.account_cooldown_locks (user_id, is_locked);

DROP TRIGGER IF EXISTS trg_acl_updated ON public.account_cooldown_locks;
CREATE TRIGGER trg_acl_updated
  BEFORE UPDATE ON public.account_cooldown_locks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.account_cooldown_locks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_cooldown_locks FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_cooldown_locks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_cooldown_locks TO authenticated;

DROP POLICY IF EXISTS app_admin_account_cooldown_locks ON public.account_cooldown_locks;
CREATE POLICY app_admin_account_cooldown_locks
  ON public.account_cooldown_locks
  FOR ALL
  TO authenticated
  USING (public.app_is_admin() AND user_id = (SELECT auth.uid()))
  WITH CHECK (public.app_is_admin() AND user_id = (SELECT auth.uid()));

COMMIT;
