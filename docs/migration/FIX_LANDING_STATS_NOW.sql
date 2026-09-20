-- Fix Landing Page Statistics - Run This in Supabase SQL Editor

-- Step 1: Enable Row Level Security
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policy if it exists (ignore error if doesn't exist)
DROP POLICY IF EXISTS "public_read_issues" ON issues;
DROP POLICY IF EXISTS "Allow public read access for statistics" ON issues;
DROP POLICY IF EXISTS "Public can view issues for statistics" ON issues;

-- Step 3: Create new policy for public read access
CREATE POLICY "public_read_issues"
ON issues
FOR SELECT
TO anon, authenticated
USING (true);

-- Step 4: Verify it works - should return counts
SELECT 
  COUNT(*) as total_issues,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_issues,
  COUNT(DISTINCT created_by) as active_citizens
FROM issues;

-- ✅ Done! Now refresh your landing page and statistics should appear.
