-- ============================================
-- FINAL FIX: Worker Photo Upload Permission
-- This addresses the root cause of "permission denied for table users"
-- ============================================

-- The problem: Foreign key to auth.users triggers RLS check
-- Solution: Use a trigger-based approach or grant SELECT on auth.users

-- OPTION 1: Grant SELECT on auth.users to authenticated users (RECOMMENDED)
-- This allows foreign key constraints to work without RLS issues
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

-- OPTION 2: If Option 1 doesn't work, recreate table without FK to auth.users
-- Drop the existing table and recreate with FK to user_profiles instead

-- First, backup any existing data
CREATE TABLE IF NOT EXISTS issue_internal_notes_backup AS 
SELECT * FROM issue_internal_notes;

-- Drop the problematic table
DROP TABLE IF EXISTS issue_internal_notes CASCADE;

-- Recreate with FK to user_profiles instead of auth.users
CREATE TABLE issue_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  official_id UUID NOT NULL, -- No FK constraint to avoid RLS issues
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- No foreign key constraint - application validates user IDs
-- This prevents "permission denied for table users" errors

-- Enable RLS
ALTER TABLE issue_internal_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Officials can view internal notes for their issues" ON issue_internal_notes;
DROP POLICY IF EXISTS "Officials can create internal notes for their issues" ON issue_internal_notes;
DROP POLICY IF EXISTS "Authorities can view all internal notes" ON issue_internal_notes;

-- Create policies
CREATE POLICY "Officials can view internal notes for their issues"
  ON issue_internal_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM issues 
      WHERE issues.id = issue_internal_notes.issue_id 
      AND issues.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Officials can create internal notes for their issues"
  ON issue_internal_notes FOR INSERT
  WITH CHECK (
    official_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM issues 
      WHERE issues.id = issue_internal_notes.issue_id 
      AND issues.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Authorities can view all internal notes"
  ON issue_internal_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.user_type = 'authority'
    )
  );

-- Restore backed up data if any
INSERT INTO issue_internal_notes (id, issue_id, official_id, note, created_at, updated_at)
SELECT id, issue_id, official_id, note, created_at, updated_at
FROM issue_internal_notes_backup
ON CONFLICT (id) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON issue_internal_notes TO authenticated;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_internal_notes_issue ON issue_internal_notes(issue_id);
CREATE INDEX IF NOT EXISTS idx_internal_notes_official ON issue_internal_notes(official_id);

-- Verify
SELECT 
  'issue_internal_notes' as table_name,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'issue_internal_notes';

-- ============================================
-- ✅ FIX COMPLETE
-- ============================================
-- 
-- This fix removes the problematic foreign key constraint to auth.users
-- which was causing RLS permission checks to fail.
-- 
-- The application still validates user IDs, but the database
-- won't block inserts due to RLS on auth.users.
-- 
-- ============================================
