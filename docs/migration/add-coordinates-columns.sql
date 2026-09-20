-- Migration: Add Latitude and Longitude Columns to Issues Table
-- Run this FIRST before using the navigation features

-- Step 1: Add the columns if they don't exist
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Step 2: Add comments to document the columns
COMMENT ON COLUMN issues.latitude IS 'Latitude coordinate for issue location (required for navigation)';
COMMENT ON COLUMN issues.longitude IS 'Longitude coordinate for issue location (required for navigation)';

-- Step 3: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_issues_latitude ON issues(latitude);
CREATE INDEX IF NOT EXISTS idx_issues_longitude ON issues(longitude);
CREATE INDEX IF NOT EXISTS idx_issues_coordinates ON issues(latitude, longitude);

-- Step 4: Add constraints to ensure valid coordinate ranges
-- Note: We use DO block to check if constraint exists before adding
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_latitude_range'
  ) THEN
    ALTER TABLE issues 
    ADD CONSTRAINT check_latitude_range 
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_longitude_range'
  ) THEN
    ALTER TABLE issues 
    ADD CONSTRAINT check_longitude_range 
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;
END $$;

-- Step 5: Verify the columns were created
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'issues' 
AND column_name IN ('latitude', 'longitude');

-- Step 6: Check current data
SELECT 
  COUNT(*) as total_issues,
  COUNT(latitude) as issues_with_latitude,
  COUNT(longitude) as issues_with_longitude,
  COUNT(*) - COUNT(latitude) as missing_coordinates
FROM issues;

-- Expected output:
-- All existing issues will have NULL coordinates
-- New issues will automatically populate these fields

-- Step 7: (Optional) Try to populate coordinates from location strings
-- This will work for issues where location is in "lat, lng" format
UPDATE issues
SET 
  latitude = CAST(SPLIT_PART(location, ',', 1) AS DECIMAL),
  longitude = CAST(SPLIT_PART(location, ',', 2) AS DECIMAL)
WHERE 
  (latitude IS NULL OR longitude IS NULL)
  AND location ~ '^-?\d+\.?\d*,\s*-?\d+\.?\d*$';

-- Step 8: Verify the update
SELECT 
  COUNT(*) as total_issues,
  COUNT(latitude) as issues_with_coordinates,
  COUNT(*) - COUNT(latitude) as still_missing_coordinates
FROM issues;

-- Step 9: View sample of issues with coordinates
SELECT 
  id,
  title,
  location,
  latitude,
  longitude,
  created_at
FROM issues
WHERE latitude IS NOT NULL AND longitude IS NOT NULL
LIMIT 5;

-- Step 10: View issues still missing coordinates
SELECT 
  id,
  title,
  location,
  created_at
FROM issues
WHERE latitude IS NULL OR longitude IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- ✅ Migration Complete!
-- New issues will now automatically save coordinates
-- Navigation features will work for all new issues
