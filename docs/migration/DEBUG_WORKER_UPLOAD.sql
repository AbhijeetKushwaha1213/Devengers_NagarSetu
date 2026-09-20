-- ============================================
-- DEBUG: Worker Photo Upload Issue
-- Run this to diagnose the exact problem
-- ============================================

-- 1. Check if issue_internal_notes table exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'issue_internal_notes';

-- 2. Check the foreign key constraints on issue_internal_notes
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

-- 3. Check RLS policies on issue_internal_notes
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

-- 4. Check if there are any triggers on issue_internal_notes
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'issue_internal_notes';

-- 5. Test if we can insert directly (replace with actual values)
-- SELECT auth.uid(); -- Get current user ID first
-- Then try:
-- INSERT INTO issue_internal_notes (issue_id, official_id, note)
-- VALUES ('<issue-id>', auth.uid(), 'Test note');

-- 6. Check if auth.users table has RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'auth' AND tablename = 'users';

-- 7. Check policies on auth.users (if any)
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE schemaname = 'auth' AND tablename = 'users';

-- ============================================
-- INTERPRETATION
-- ============================================
-- 
-- Query 2: If official_id references auth.users(id), that's the problem!
--          It should reference auth.users(id) but with SECURITY DEFINER
--          OR we need to grant SELECT on auth.users
-- 
-- Query 6-7: If auth.users has RLS enabled with restrictive policies,
--            the foreign key check will fail
-- 
-- ============================================
