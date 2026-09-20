-- Simple Migration: Add Latitude and Longitude Columns
-- This is the simplest version - just adds the columns and indexes

-- Step 1: Add the columns
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Step 2: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_issues_coordinates ON issues(latitude, longitude);

-- Step 3: Verify columns were created
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'issues' 
AND column_name IN ('latitude', 'longitude');

-- Expected output:
-- latitude  | numeric | YES
-- longitude | numeric | YES

-- Step 4: Check current data
SELECT 
  COUNT(*) as total_issues,
  COUNT(latitude) as with_coordinates,
  COUNT(*) - COUNT(latitude) as missing_coordinates
FROM issues;

-- ✅ Done! New issues will now save coordinates automatically.
