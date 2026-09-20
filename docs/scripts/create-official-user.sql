-- Script to Create Department Official User
-- Replace the values in CAPITAL LETTERS with actual data

-- Step 1: Create the auth user (run this first)
-- Note: You'll need to do this through Supabase Dashboard > Authentication > Users
-- Or use the Supabase Admin API

-- Step 2: After creating the auth user, get the user ID and run this:

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
  'USER_ID_FROM_AUTH_USERS',  -- Replace with actual user ID from auth.users
  'official@municipality.gov',  -- Replace with official's email
  'Mr. A.K. Sharma',  -- Replace with official's full name
  'official',  -- Don't change this
  'Public Works - Pothole Division',  -- Replace with department name
  'EMP-405',  -- Replace with employee ID
  true,  -- Officials don't need onboarding
  NOW()
);

-- Example: Create multiple officials at once
-- Uncomment and modify as needed:

/*
INSERT INTO user_profiles (id, email, full_name, user_type, department, employee_id, is_onboarding_complete, created_at) VALUES
('user-id-1', 'sharma@municipality.gov', 'Mr. A.K. Sharma', 'official', 'Public Works - Pothole Division', 'EMP-405', true, NOW()),
('user-id-2', 'patel@municipality.gov', 'Ms. Priya Patel', 'official', 'Water Supply Department', 'EMP-406', true, NOW()),
('user-id-3', 'kumar@municipality.gov', 'Mr. Raj Kumar', 'official', 'Electrical Department', 'EMP-407', true, NOW()),
('user-id-4', 'singh@municipality.gov', 'Mr. Vikram Singh', 'official', 'Sanitation Department', 'EMP-408', true, NOW());
*/

-- Step 3: Verify the official was created correctly
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

-- Step 4: Test by assigning an issue to the official
-- Replace ISSUE_ID and OFFICIAL_USER_ID with actual values

/*
UPDATE issues
SET 
  assigned_to = 'OFFICIAL_USER_ID',
  status = 'assigned',
  department = 'Public Works - Pothole Division',
  updated_at = NOW()
WHERE id = 'ISSUE_ID';
*/

-- Step 5: Verify the assignment
/*
SELECT 
  i.id,
  i.title,
  i.status,
  i.department,
  i.assigned_to,
  u.full_name as assigned_to_name,
  u.employee_id
FROM issues i
LEFT JOIN user_profiles u ON i.assigned_to = u.id
WHERE i.assigned_to = 'OFFICIAL_USER_ID';
*/
