-- ============================================
-- QUICK CREATE OFFICIAL ACCOUNT
-- ============================================
-- This script helps you create an official account quickly
-- 
-- STEP 1: Create user in Supabase Dashboard first!
--   1. Go to Authentication > Users
--   2. Click "Add User"
--   3. Email: official@test.com
--   4. Password: Test@123456
--   5. Copy the User ID that gets generated
--
-- STEP 2: Replace 'YOUR-USER-ID-HERE' below with the copied ID
-- STEP 3: Run this script
-- ============================================

-- Option A: Create a new official profile
-- (Use this if you just created a new user in Authentication)
INSERT INTO user_profiles (
  id,
  email,
  full_name,
  user_type,
  department,
  employee_id,
  is_onboarding_complete,
  created_at
) VALUES (
  'YOUR-USER-ID-HERE',  -- ⚠️ REPLACE THIS with your user ID
  'official@test.com',
  'Test Official',
  'official',
  'Public Works Department',
  'EMP-001',
  true,
  NOW()
);

-- ============================================
-- OR
-- ============================================

-- Option B: Convert your existing account to official
-- (Use this if you want to use your current account)
-- Uncomment the lines below and replace YOUR-EMAIL with your email

/*
UPDATE user_profiles 
SET 
  user_type = 'official',
  department = 'Public Works Department',
  employee_id = 'EMP-001',
  is_onboarding_complete = true
WHERE email = 'YOUR-EMAIL@example.com';  -- ⚠️ REPLACE with your email
*/

-- ============================================
-- VERIFY IT WORKED
-- ============================================
-- Run this to see all official accounts:
SELECT 
  id,
  email,
  full_name,
  user_type,
  department,
  employee_id,
  created_at
FROM user_profiles 
WHERE user_type = 'official'
ORDER BY created_at DESC;

-- ============================================
-- TEST LOGIN
-- ============================================
-- After running the script above:
-- 1. Go to: http://localhost:5173/official/login
-- 2. Login with:
--    Email: official@test.com
--    Password: Test@123456
-- 3. You should see the Official Dashboard!
-- ============================================

-- ============================================
-- OPTIONAL: Assign a test issue to your official
-- ============================================
-- First, find an issue:
SELECT id, title, status FROM issues LIMIT 5;

-- Then assign it (replace the IDs):
/*
UPDATE issues 
SET 
  assigned_to = 'YOUR-OFFICIAL-USER-ID',
  status = 'assigned',
  department = 'Public Works Department',
  updated_at = NOW()
WHERE id = 'SOME-ISSUE-ID';
*/

-- Verify the assignment:
/*
SELECT 
  i.id,
  i.title,
  i.status,
  i.department,
  u.full_name as assigned_to_name,
  u.employee_id
FROM issues i
LEFT JOIN user_profiles u ON i.assigned_to = u.id
WHERE i.assigned_to = 'YOUR-OFFICIAL-USER-ID';
*/

-- ============================================
-- DONE! 🎉
-- ============================================
-- You can now login to the Official Portal!
