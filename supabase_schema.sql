-- Create families table
CREATE TABLE families (
  id TEXT PRIMARY KEY,
  name TEXT,
  owner_email TEXT NOT NULL,
  owner_password TEXT NOT NULL,
  expiry_date TIMESTAMPTZ,
  storage_used NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) -- Optional: link to Supabase Auth user if you want per-user privacy later
);

-- Create members table
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE join_requests (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) - Optional for now if just testing, but recommended
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;

-- Create simple policies (OPEN FOR ALL FOR NOW - ADJUST FOR PRODUCTION)
-- WARNING: This allows anyone with your API key to read/write. 
-- For a personal tool, this is okay if you keep keys secret.
CREATE POLICY "Enable all access for now" ON families FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for now" ON members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for now" ON join_requests FOR ALL USING (true) WITH CHECK (true);
