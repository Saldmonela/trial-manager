-- Fresh installations only. Existing installations must baseline migration history
-- from an inspected schema, never replay historical manual migrations on production.
CREATE TABLE IF NOT EXISTS public.families (
 id text PRIMARY KEY, name text, owner_email text NOT NULL,
 owner_password text NOT NULL, expiry_date timestamptz, storage_used numeric DEFAULT 0,
 notes text, created_at timestamptz DEFAULT now(), user_id uuid REFERENCES auth.users(id)
);
CREATE TABLE IF NOT EXISTS public.members (
 id text PRIMARY KEY, family_id text REFERENCES public.families(id) ON DELETE CASCADE,
 name text, email text, added_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.join_requests (
 id text PRIMARY KEY, family_id text REFERENCES public.families(id) ON DELETE CASCADE,
 name text NOT NULL, email text NOT NULL, note text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
 created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email text NOT NULL, role text NOT NULL DEFAULT 'public' CHECK(role IN ('public','admin')),
 created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.admin_users (email text PRIMARY KEY,added_at timestamptz DEFAULT now());
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
