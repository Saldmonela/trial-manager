-- ============================================================
-- RBAC: Profiles + Admin Whitelist
-- Run this in Supabase SQL Editor AFTER existing schema is set up.
-- ============================================================

-- 1. Profiles table: auto-created per user on first login
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'public' CHECK (role IN ('public', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Admin whitelist: simple email-based allowlist
CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Trigger function: auto-create profile on auth.users INSERT
--    Sets role = 'admin' if email is in admin_users, else 'public'
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  _role TEXT;
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM admin_users WHERE email = NEW.email
  ) THEN 'admin' ELSE 'public' END INTO _role;

  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, _role)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 5. RLS for profiles: users can only read their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admin users table: no RLS needed (only accessed by trigger via SECURITY DEFINER)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 6. Seed: Admin email
INSERT INTO admin_users (email) VALUES ('salmanlukman0302@gmail.com');

-- ============================================================
-- OPTIONAL: Backfill profiles for EXISTING users
-- Run this ONCE if you already have users in auth.users
-- ============================================================
-- Step 1: Ensure updated_at column exists (in case table was created without it)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 2: Backfill
INSERT INTO profiles (id, email, role)
SELECT
  u.id,
  u.email,
  CASE WHEN a.email IS NOT NULL THEN 'admin' ELSE 'public' END
FROM auth.users u
LEFT JOIN admin_users a ON u.email = a.email
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  updated_at = NOW();
