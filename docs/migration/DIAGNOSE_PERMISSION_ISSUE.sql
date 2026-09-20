-- ============================================
-- DIAGNOSTIC SCRIPT: Worker Photo Upload Issues
-- Run this to identify permission problems
-- ============================================

-- 1. Check if issue_internal_notes table exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'issue_internal_notes';

-- 2. Check issue_internal_notes table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'issue_internal_notes'
ORDER BY ordinal_position;

-- 3. Check RLS status on issue_internal_notes
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'issue_internal_notes';

-- 4. List all policies on issue_internal_notes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'issue_internal_notes';

-- 5. Check issues table policies for officials
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'issues' 
  AND (policyname LIKE '%official%' OR policyname LIKE '%Official%');

-- 6. Check user_profiles table structure (for official_id reference)
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
  AND column_name IN ('id', 'user_type', 'employee_id', 'department');

-- 7. Check foreign key constraints on issue_internal_notes
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'issue_internal_notes';

-- 8. Check storage buckets
SELECT 
  id,
  name,
  public
FROM storage.buckets 
WHERE name = 'issue-images';

-- 9. Check storage policies for issue-images bucket
SELECT 
  name,
  definition
FROM storage.policies
WHERE bucket_id = 'issue-images';

-- ============================================
-- INTERPRETATION GUIDE
-- ============================================
-- 
-- Query 1: Should return 1 row (table exists)
-- Query 2: Should show columns: id, issue_id, official_id, note, created_at, updated_at
-- Query 3: Should show rls_enabled = true
-- Query 4: Should show at least 2-3 policies
-- Query 5: Should show policies for officials to view/update issues
-- Query 6: Should show user_profiles columns exist
-- Query 7: Should show official_id references either auth.users or user_profiles
-- Query 8: Should return 1 row (bucket exists)
-- Query 9: Should show INSERT and SELECT policies
-- 
-- If any query returns empty or unexpected results, that's your problem!
-- 
-- ============================================
