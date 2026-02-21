-- 1. Enable RLS on tables (if not already enabled)
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing "allow all" policies
DROP POLICY IF EXISTS "Enable all access for now" ON families;
DROP POLICY IF EXISTS "Enable all access for now" ON members;
DROP POLICY IF EXISTS "Enable all access for now" ON join_requests;

-- 3. Create SECURE policies for Families
-- Policy: Users can only see/edit families where 'user_id' matches their ID
CREATE POLICY "Users can only see their own families"
ON families FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow users to INSERT new families (automatically sets user_id)
-- Note: You might need to make sure your INSERT query from frontend includes user_id 
-- OR use a trigger. But for now, let's allow insert if user is authenticated.
-- Ideally, the frontend should send user_id, or we default it.
-- Let's stick to the check above: if frontend sends user_id = auth.uid(), it passes.

-- 4. Create SECURE policies for Members
-- Policy: Users can manage members IF they own the parent family
CREATE POLICY "Users can manage members of their families"
ON members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM families 
    WHERE families.id = members.family_id 
    AND families.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM families 
    WHERE families.id = members.family_id 
    AND families.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view join requests for their families"
ON join_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM families
    WHERE families.id = join_requests.family_id
    AND families.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create join requests"
ON join_requests FOR INSERT
WITH CHECK (
  length(requester_name) > 0 AND 
  length(requester_email) > 0
);

CREATE POLICY "Users can update join requests for their families"
ON join_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM families
    WHERE families.id = join_requests.family_id
    AND families.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM families
    WHERE families.id = join_requests.family_id
    AND families.user_id = auth.uid()
  )
);

-- 5. (OPTIONAL) Temporary Policy for Migration/Claiming
-- Allow authenticated users to update rows that have NO owner (user_id is NULL)
CREATE POLICY "Allow claiming orphaned data"
ON families FOR UPDATE
USING (user_id IS NULL)
WITH CHECK (user_id = auth.uid());
