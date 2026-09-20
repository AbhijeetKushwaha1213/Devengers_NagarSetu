-- ============================================
-- TROUBLESHOOT DEPARTMENT COLUMN ERROR
-- Run each section step by step
-- ============================================

-- ============================================
-- STEP 1: CHECK IF COLUMNS EXIST
-- ============================================
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name IN ('department', 'employee_id', 'phone', 'address', 'is_onboarding_complete')
ORDER BY column_name;

-- Expected: 5 rows
-- If you see less than 5 rows, columns are missing!

-- ============================================
-- STEP 2: ADD MISSING COLUMNS (if needed)
-- ============================================
-- Run this if Step 1 showed missing columns

DO $$ 
BEGIN
    -- Add department
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'department'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN department VARCHAR(100);
        RAISE NOTICE 'Added department column';
    ELSE
        RAISE NOTICE 'department column already exists';
    END IF;

    -- Add employee_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'employee_id'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN employee_id VARCHAR(50);
        RAISE NOTICE 'Added employee_id column';
    ELSE
        RAISE NOTICE 'employee_id column already exists';
    END IF;

    -- Add phone
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'phone'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN phone VARCHAR(20);
        RAISE NOTICE 'Added phone column';
    ELSE
        RAISE NOTICE 'phone column already exists';
    END IF;

    -- Add address
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'address'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN address TEXT;
        RAISE NOTICE 'Added address column';
    ELSE
        RAISE NOTICE 'address column already exists';
    END IF;

    -- Add is_onboarding_complete
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'is_onboarding_complete'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN is_onboarding_complete BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_onboarding_complete column';
    ELSE
        RAISE NOTICE 'is_onboarding_complete column already exists';
    END IF;
END $$;

-- ============================================
-- STEP 3: VERIFY COLUMNS WERE ADDED
-- ============================================
SELECT 
  column_name, 
  data_type
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name IN ('department', 'employee_id', 'phone', 'address', 'is_onboarding_complete')
ORDER BY column_name;

-- Should now show 5 rows!

-- ============================================
-- STEP 4: FORCE SCHEMA CACHE REFRESH
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- STEP 5: TEST INSERT/UPDATE
-- ============================================
-- Find your user ID first
SELECT id, email FROM user_profiles WHERE email = 'your-email@example.com';

-- Then test update (replace YOUR-USER-ID)
/*
UPDATE user_profiles 
SET 
  department = 'Test Department',
  employee_id = 'TEST-001',
  phone = '555-1234',
  address = 'Test Address',
  is_onboarding_complete = true
WHERE id = 'YOUR-USER-ID';
*/

-- Verify the update worked
/*
SELECT 
  id,
  email,
  full_name,
  department,
  employee_id,
  phone,
  address,
  is_onboarding_complete
FROM user_profiles 
WHERE id = 'YOUR-USER-ID';
*/

-- ============================================
-- STEP 6: CHECK TABLE STRUCTURE
-- ============================================
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- This shows ALL columns in user_profiles table

-- ============================================
-- STEP 7: CHECK FOR CONSTRAINTS
-- ============================================
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'user_profiles'::regclass;

-- ============================================
-- TROUBLESHOOTING TIPS
-- ============================================

-- If columns exist but still getting error:
-- 1. Restart your development server (npm run dev)
-- 2. Clear browser cache (Ctrl+Shift+R)
-- 3. Check Supabase project URL in .env file
-- 4. Verify you're connected to the right project

-- If columns don't exist after Step 2:
-- 1. Check if you have permission to alter table
-- 2. Try running ALTER TABLE commands individually
-- 3. Check Supabase logs for errors

-- If update test fails:
-- 1. Check RLS policies on user_profiles table
-- 2. Verify user is authenticated
-- 3. Check if user_id exists in table

-- ============================================
-- FINAL VERIFICATION
-- ============================================
-- Run this to confirm everything is ready:
SELECT 
  CASE 
    WHEN COUNT(*) = 5 THEN '✅ All columns exist! Ready to use.'
    ELSE '❌ Missing columns. Run Step 2 again.'
  END AS status,
  COUNT(*) AS columns_found
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name IN ('department', 'employee_id', 'phone', 'address', 'is_onboarding_complete');

-- ============================================
-- SUCCESS!
-- ============================================
-- If you see "✅ All columns exist! Ready to use."
-- Then:
-- 1. Restart your dev server
-- 2. Clear browser cache
-- 3. Try the onboarding form again
-- It should work now!
