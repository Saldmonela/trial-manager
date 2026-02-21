-- ============================================
-- Supabase SQL: Profile Setup for Auth System
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Enable RLS on profiles table (if not already)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Allow authenticated users to read their OWN profile
-- This is needed so fetchProfile() works after login
CREATE POLICY "Users can read their own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- 3. Allow the trigger function to insert profiles (service role)
-- This policy allows new profiles to be created during signup
CREATE POLICY "Allow profile creation on signup"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 4. Auto-create a profile row when a new user signs up via Google OAuth
-- This ensures every new user gets a default 'public' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'public'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach the trigger to auth.users
-- Fires automatically when a new user is created (e.g., Google sign-in)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
