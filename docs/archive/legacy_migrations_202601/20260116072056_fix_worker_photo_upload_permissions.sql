-- ============================================
-- FIX: Worker Photo Upload Permission Issues
-- Run this script in Supabase SQL Editor
-- ============================================

-- This fixes the "permission denied for table users" error
-- when workers try to upload photos

-- 1. Ensure issue_internal_notes table exists with correct structure
CREATE TABLE IF NOT EXISTS issue_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  official_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS on issue_internal_notes
ALTER TABLE issue_internal_notes ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Officials can view internal notes for their issues" ON issue_internal_notes;
DROP POLICY IF EXISTS "Officials can create internal notes for their issues" ON issue_internal_notes;
DROP POLICY IF EXISTS "Authorities can view all internal notes" ON issue_internal_notes;
DROP POLICY IF EXISTS "Officials can insert notes" ON issue_internal_notes;
DROP POLICY IF EXISTS "Authenticated users can insert notes" ON issue_internal_notes;

-- 4. Create new policies for issue_internal_notes
-- Allow officials to view notes for issues assigned to them
CREATE POLICY "Officials can view internal notes for their issues"
  ON issue_internal_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM issues 
      WHERE issues.id = issue_internal_notes.issue_id 
      AND issues.assigned_to = auth.uid()
    )
  );

-- Allow officials to create notes for issues assigned to them
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

-- Allow authorities to view all internal notes
CREATE POLICY "Authorities can view all internal notes"
  ON issue_internal_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.user_type = 'authority'
    )
  );

-- 5. Update issues table RLS policies for officials
DROP POLICY IF EXISTS "Officials can view assigned issues" ON issues;
DROP POLICY IF EXISTS "Officials can update assigned issues" ON issues;

-- Officials can view issues assigned to them
CREATE POLICY "Officials can view assigned issues"
  ON issues FOR SELECT
  USING (assigned_to = auth.uid());

-- Officials can update issues assigned to them (including after_image)
CREATE POLICY "Officials can update assigned issues"
  ON issues FOR UPDATE
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- 6. Ensure storage bucket policies are correct
-- Note: Run this in the Supabase Storage Policies section, not SQL Editor
-- 
-- For bucket: issue-images
-- Policy name: Workers can upload resolution photos
-- Allowed operations: INSERT
-- Policy definition:
-- (bucket_id = 'issue-images' AND auth.role() = 'authenticated')
--
-- Policy name: Public can view issue images
-- Allowed operations: SELECT
-- Policy definition:
-- (bucket_id = 'issue-images')

-- 7. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON issue_internal_notes TO authenticated;
GRANT SELECT, UPDATE ON issues TO authenticated;

-- 8. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_internal_notes_issue ON issue_internal_notes(issue_id);
CREATE INDEX IF NOT EXISTS idx_internal_notes_official ON issue_internal_notes(official_id);

-- 9. Verify the setup
SELECT 
  'issue_internal_notes' as table_name,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'issue_internal_notes'
UNION ALL
SELECT 
  'issues' as table_name,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'issues' AND policyname LIKE '%Official%';

-- ============================================
-- ✅ VERIFICATION COMPLETE
-- ============================================
-- 
-- If you see policy counts above, the setup is correct.
-- 
-- Next steps:
-- 1. Go to Storage > Policies in Supabase Dashboard
-- 2. Ensure 'issue-images' bucket exists
-- 3. Add the storage policies mentioned in step 6 above
-- 4. Test photo upload from worker portal
-- 
-- ============================================
