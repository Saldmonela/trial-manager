-- Migration: 20260621_add_connected_accounts.sql
-- Description: v1 multi-cloud storage — connect Google Drive accounts + sync quota.
--   connected_accounts : satu baris per akun Google Drive terhubung (token terenkripsi + quota).
--   oauth_states       : state single-use yang membawa identitas user ke callback (yang tanpa JWT).
-- CATATAN: jalankan MANUAL via Supabase Dashboard -> SQL Editor (repo ini pakai migrasi manual).

-- ============================================================
-- 1. connected_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.connected_accounts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider                TEXT NOT NULL DEFAULT 'google_drive',
  provider_account_id     TEXT NOT NULL,                       -- Google 'sub'
  email                   TEXT,
  display_name            TEXT,
  avatar_url              TEXT,
  -- Rahasia (AES-256-GCM, base64). REVOKE kolom di bawah menjaga ini dari client.
  access_token_encrypted  TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at        TIMESTAMPTZ,
  scopes                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  status                  TEXT NOT NULL DEFAULT 'connected',   -- 'connected' | 'disconnected'
  -- Quota (StorageAccount didenormalisasi ke baris yang sama untuk v1)
  total_bytes             NUMERIC,        -- NULL = unlimited (limit tidak dikirim Google)
  used_bytes              NUMERIC DEFAULT 0,
  available_bytes         NUMERIC,        -- NULL saat unlimited
  trash_bytes             NUMERIC DEFAULT 0,
  last_synced_at          TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT uniq_user_provider_account UNIQUE (user_id, provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_user
  ON public.connected_accounts (user_id);

ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

-- Owner-only: admin hanya melihat akun miliknya
DROP POLICY IF EXISTS "Owner can read own connected accounts" ON public.connected_accounts;
CREATE POLICY "Owner can read own connected accounts"
  ON public.connected_accounts FOR SELECT USING (auth.uid() = user_id);

-- Owner boleh ubah status / disconnect langsung dari frontend authed (tanpa Edge Function).
-- INSERT + tulis token hanya lewat service role di Edge Function (bypass RLS) -> tak ada policy INSERT.
DROP POLICY IF EXISTS "Owner can update own connected accounts" ON public.connected_accounts;
CREATE POLICY "Owner can update own connected accounts"
  ON public.connected_accounts FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner can delete own connected accounts" ON public.connected_accounts;
CREATE POLICY "Owner can delete own connected accounts"
  ON public.connected_accounts FOR DELETE USING (auth.uid() = user_id);

-- ----- KEAMANAN KOLOM (bagian paling penting) -----
-- Browser TIDAK BISA membaca/menulis kolom token, bahkan saat query select('*').
REVOKE SELECT (access_token_encrypted, refresh_token_encrypted)
  ON public.connected_accounts FROM anon, authenticated;
REVOKE UPDATE (access_token_encrypted, refresh_token_encrypted)
  ON public.connected_accounts FROM anon, authenticated;

-- ============================================================
-- 2. oauth_states (single-use, membawa user_id ke callback yang tanpa JWT)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.oauth_states (
  state        TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL DEFAULT 'google_drive',
  redirect_to  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()) + interval '10 minutes'),
  consumed_at  TIMESTAMPTZ
);
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
-- Tanpa policy anon/authenticated => hanya service role yang menyentuh tabel ini.

-- ============================================================
-- 3. trigger updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_connected_accounts_updated ON public.connected_accounts;
CREATE TRIGGER trg_connected_accounts_updated
  BEFORE UPDATE ON public.connected_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
