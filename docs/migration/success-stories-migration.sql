-- Migration to add success stories support to issues table
-- Run this in your Supabase SQL Editor

-- Add new columns to issues table for success stories
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS solved_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS solver_name TEXT,
ADD COLUMN IF NOT EXISTS solver_avatar TEXT,
ADD COLUMN IF NOT EXISTS after_image TEXT;

-- Update existing solved issues with sample data (optional)
-- You can remove this section if you don't want sample data
UPDATE issues 
SET 
  solved_date = NOW() - INTERVAL '5 days',
  solver_name = 'Community Helper',
  after_image = 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=400&auto=format&fit=crop'
WHERE status = 'solved' AND after_image IS NULL
LIMIT 1;

-- Create an index for better performance when querying solved issues
CREATE INDEX IF NOT EXISTS idx_issues_solved_status ON issues(status, solved_date DESC) 
WHERE status = 'solved';

-- Function to update solved issue with solver info
CREATE OR REPLACE FUNCTION mark_issue_solved(
  issue_id UUID,
  solver_name_param TEXT,
  solver_avatar_param TEXT DEFAULT NULL,
  after_image_param TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE issues 
  SET 
    status = 'solved',
    solved_date = NOW(),
    solver_name = solver_name_param,
    solver_avatar = solver_avatar_param,
    after_image = after_image_param
  WHERE id = issue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;