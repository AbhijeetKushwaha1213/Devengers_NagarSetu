-- ============================================
-- COMPLETE DATABASE FIX FOR IMAGE UPLOAD
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================

-- Step 1: Check current schema
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'issues'
ORDER BY ordinal_position;

-- Step 2: Add ALL missing columns
ALTER TABLE issues ADD COLUMN IF NOT EXISTS after_image TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS show_in_gallery BOOLEAN DEFAULT FALSE;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE issues ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- Step 3: Update status constraint
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check 
  CHECK (status IN ('reported', 'assigned', 'in_progress', 'pending_approval', 'resolved', 'closed'));

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_issues_after_image ON issues(after_image) WHERE after_image IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_updated_at ON issues(updated_at);

-- Step 5: Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_issues_updated_at ON issues;
CREATE TRIGGER update_issues_updated_at
    BEFORE UPDATE ON issues
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Force schema cache refresh
NOTIFY pgrst, 'reload schema';

-- Step 7: Verify all columns exist
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'issues'
AND column_name IN (
  'after_image', 
  'completed_at', 
  'show_in_gallery', 
  'updated_at',
  'assigned_to',
  'department'
)
ORDER BY column_name;

-- Expected: 6 rows

-- Step 8: Test update (don't run this, just for reference)
/*
UPDATE issues 
SET 
  after_image = 'test',
  status = 'resolved'
WHERE id = (SELECT id FROM issues LIMIT 1);
*/

-- ============================================
-- SUCCESS INDICATORS
-- ============================================
-- If Step 7 returns 6 rows, you're ready!
-- The upload feature will now work.
