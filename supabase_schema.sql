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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies: public read, authenticated write scoped to owner
-- Families: anyone can read (storefront), only owner can write
CREATE POLICY "Public read families" ON families FOR SELECT USING (true);
CREATE POLICY "Owner insert families" ON families FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner update families" ON families FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner delete families" ON families FOR DELETE USING (auth.uid() = user_id);

-- Members: anyone can read (slot count), only family owner can write
CREATE POLICY "Public read members" ON members FOR SELECT USING (true);
CREATE POLICY "Owner manage members" ON members FOR ALL
  USING (EXISTS (SELECT 1 FROM families WHERE families.id = members.family_id AND families.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM families WHERE families.id = members.family_id AND families.user_id = auth.uid()));

-- Join requests: anyone can read & insert (public storefront), only family owner can update/delete
CREATE POLICY "Public read join_requests" ON join_requests FOR SELECT USING (true);
CREATE POLICY "Public insert join_requests" ON join_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Owner update join_requests" ON join_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM families WHERE families.id = join_requests.family_id AND families.user_id = auth.uid()));
CREATE POLICY "Owner delete join_requests" ON join_requests FOR DELETE
  USING (EXISTS (SELECT 1 FROM families WHERE families.id = join_requests.family_id AND families.user_id = auth.uid()));
