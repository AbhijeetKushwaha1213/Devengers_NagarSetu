-- Ensure after_image column exists in issues table
-- Run this in Supabase SQL Editor

-- Add after_image column if it doesn't exist
ALTER TABLE issues 
  ADD COLUMN IF NOT EXISTS after_image TEXT;

-- Add completed_at column if it doesn't exist
ALTER TABLE issues 
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add show_in_gallery column if it doesn't exist
ALTER TABLE issues 
  ADD COLUMN IF NOT EXISTS show_in_gallery BOOLEAN DEFAULT FALSE;

-- Update status constraint to include pending_approval
ALTER TABLE issues 
  DROP CONSTRAINT IF EXISTS issues_status_check;

ALTER TABLE issues 
  ADD CONSTRAINT issues_status_check 
  CHECK (status IN ('reported', 'assigned', 'in_progress', 'pending_approval', 'resolved', 'closed'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_issues_after_image 
  ON issues(after_image) 
  WHERE after_image IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_issues_pending_approval 
  ON issues(status) 
  WHERE status = 'pending_approval';

-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'issues' 
AND column_name IN ('after_image', 'completed_at', 'show_in_gallery');

-- Should return 3 rows
