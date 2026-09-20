-- ============================================
-- COMPLETE WORKER SETUP MIGRATION
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- 1. Add department column if it doesn't exist
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- 2. Add employee_id column if it doesn't exist
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE;

-- 3. Add phone column
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- 4. Add address column
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS address TEXT;

-- 5. Add is_onboarding_complete if it doesn't exist
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS is_onboarding_complete BOOLEAN DEFAULT FALSE;

-- 6. Update user_type constraint to include 'official'
ALTER TABLE user_profiles 
  DROP CONSTRAINT IF EXISTS user_profiles_user_type_check;

ALTER TABLE user_profiles 
  ADD CONSTRAINT user_profiles_user_type_check 
  CHECK (user_type IN ('citizen', 'authority', 'official'));

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_department 
  ON user_profiles(department) 
  WHERE user_type = 'official';

CREATE INDEX IF NOT EXISTS idx_user_profiles_employee_id 
  ON user_profiles(employee_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_type 
  ON user_profiles(user_type);

-- 8. Add comments for documentation
COMMENT ON COLUMN user_profiles.department IS 'Worker department/division';
COMMENT ON COLUMN user_profiles.employee_id IS 'Unique employee identification number';
COMMENT ON COLUMN user_profiles.phone IS 'Worker contact phone number';
COMMENT ON COLUMN user_profiles.address IS 'Worker residential address';
COMMENT ON COLUMN user_profiles.is_onboarding_complete IS 'Whether user has completed profile setup';

-- ============================================
-- VERIFY THE CHANGES
-- ============================================
-- Run this to check all columns exist:
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name IN ('department', 'employee_id', 'phone', 'address', 'is_onboarding_complete', 'user_type')
ORDER BY column_name;

-- Should return 6 rows showing all the columns

-- ============================================
-- TEST QUERIES
-- ============================================

-- Check if you can insert/update with new fields
-- (Don't run this, just for reference)
/*
UPDATE user_profiles 
SET 
  department = 'Public Works',
  employee_id = 'EMP-001',
  phone = '555-1234',
  address = '123 Main St',
  is_onboarding_complete = true
WHERE id = 'your-user-id';
*/

-- ============================================
-- SUCCESS!
-- ============================================
-- If the verification query returns 6 rows,
-- your database is ready for worker onboarding!
