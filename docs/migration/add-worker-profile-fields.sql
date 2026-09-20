-- Migration: Add Worker Profile Fields
-- Adds phone and address fields for worker profiles

-- Add phone field
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Add address field
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Create index for department-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_department 
  ON user_profiles(department) 
  WHERE user_type = 'official';

-- Create index for employee_id lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_employee_id 
  ON user_profiles(employee_id);

-- Comment on new fields
COMMENT ON COLUMN user_profiles.phone IS 'Worker contact phone number';
COMMENT ON COLUMN user_profiles.address IS 'Worker residential address';

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name IN ('phone', 'address', 'employee_id', 'department');
