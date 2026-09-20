-- Database Migration: Add Latitude and Longitude to Issues Table
-- Run this in your Supabase SQL Editor to add coordinate support

-- Add latitude and longitude columns to issues table
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add index for location-based queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_issues_coordinates 
ON issues (latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN issues.latitude IS 'Latitude coordinate of the issue location';
COMMENT ON COLUMN issues.longitude IS 'Longitude coordinate of the issue location';

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'issues' 
AND column_name IN ('latitude', 'longitude');