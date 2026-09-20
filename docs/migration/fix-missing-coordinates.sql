-- Migration: Fix Missing Coordinates for Existing Issues
-- ⚠️ IMPORTANT: Run add-coordinates-columns.sql FIRST before running this script!
-- This script helps populate latitude and longitude for issues that don't have them

-- Step 1: Check how many issues are missing coordinates
SELECT 
  COUNT(*) as total_issues,
  COUNT(latitude) as issues_with_lat,
  COUNT(longitude) as issues_with_lng,
  COUNT(*) - COUNT(latitude) as missing_coordinates
FROM issues;

-- Step 2: View issues with missing coordinates
SELECT 
  id,
  title,
  location,
  latitude,
  longitude,
  created_at
FROM issues
WHERE latitude IS NULL OR longitude IS NULL
ORDER BY created_at DESC;

-- Step 3: For issues with location in "lat, lng" format, extract coordinates
-- This will parse location strings like "28.6139, 77.2090" into separate lat/lng columns
UPDATE issues
SET 
  latitude = CAST(SPLIT_PART(location, ',', 1) AS DECIMAL),
  longitude = CAST(SPLIT_PART(location, ',', 2) AS DECIMAL)
WHERE 
  (latitude IS NULL OR longitude IS NULL)
  AND location ~ '^-?\d+\.?\d*,\s*-?\d+\.?\d*$';

-- Step 4: Verify the update
SELECT 
  COUNT(*) as total_issues,
  COUNT(latitude) as issues_with_lat,
  COUNT(longitude) as issues_with_lng,
  COUNT(*) - COUNT(latitude) as still_missing_coordinates
FROM issues;

-- Step 5: For remaining issues without coordinates, you'll need to:
-- Option A: Manually geocode the location strings using Google Maps API
-- Option B: Ask users to re-submit with proper location picker
-- Option C: Set default coordinates (not recommended)

-- To see which issues still need manual attention:
SELECT 
  id,
  title,
  location,
  created_at
FROM issues
WHERE latitude IS NULL OR longitude IS NULL
ORDER BY created_at DESC;

-- Optional: Add a comment to track which issues were auto-fixed
COMMENT ON COLUMN issues.latitude IS 'Latitude coordinate - required for navigation features';
COMMENT ON COLUMN issues.longitude IS 'Longitude coordinate - required for navigation features';
