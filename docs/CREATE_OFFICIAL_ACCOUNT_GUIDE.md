# How to Create an Official Account - Step by Step

## Quick Method: Create Your Own Official Account

### Step 1: Go to Supabase Dashboard

1. Open your Supabase project dashboard
2. Go to **Authentication** → **Users**

### Step 2: Create a New User

Click **"Add User"** button and fill in:

```
Email: official@test.com
Password: Test@123456
```

Or use your own email/password.

**Important:** Copy the **User ID** that gets generated (it looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### Step 3: Make This User an Official

1. Go to **SQL Editor** in Supabase
2. Click **"New Query"**
3. Paste this SQL (replace `YOUR-USER-ID` with the ID you copied):

```sql
-- Update existing user to be an official
UPDATE user_profiles 
SET 
  user_type = 'official',
  department = 'Public Works Department',
  employee_id = 'EMP-001',
  is_onboarding_complete = true
WHERE id = 'YOUR-USER-ID';

-- Verify it worked
SELECT id, email, full_name, user_type, department, employee_id 
FROM user_profiles 
WHERE id = 'YOUR-USER-ID';
```

4. Click **"Run"**
5. You should see your user with `user_type = 'official'`

### Step 4: Login to Official Portal

1. Go to your app: `http://localhost:5173/`
2. Click **"Access as Worker"**
3. Login with:
   - Email: `official@test.com`
   - Password: `Test@123456`
4. You should now see the Official Dashboard! 🎉

---

## Alternative: Convert Your Existing Account

If you want to use your current account as an official:

### Step 1: Find Your User ID

```sql
-- Find your user ID by email
SELECT id, email, user_type FROM user_profiles 
WHERE email = 'your-current-email@example.com';
```

Copy the `id` value.

### Step 2: Convert to Official

```sql
-- Replace YOUR-USER-ID with your actual ID
UPDATE user_profiles 
SET 
  user_type = 'official',
  department = 'Public Works Department',
  employee_id = 'EMP-001'
WHERE id = 'YOUR-USER-ID';
```

### Step 3: Logout and Login Again

1. Logout from your current session
2. Go to `/official/login`
3. Login with your email/password
4. You should now access the official portal!

---

## Create Multiple Officials (For Testing)

If you want to create multiple official accounts:

```sql
-- First, create users in Authentication > Users in Supabase Dashboard
-- Then run this for each user (replace the IDs and details):

INSERT INTO user_profiles (
  id,
  email,
  full_name,
  user_type,
  department,
  employee_id,
  is_onboarding_complete,
  created_at
) VALUES 
-- Official 1
('user-id-1', 'sharma@municipality.gov', 'Mr. A.K. Sharma', 'official', 'Public Works - Pothole Division', 'EMP-405', true, NOW()),
-- Official 2
('user-id-2', 'patel@municipality.gov', 'Ms. Priya Patel', 'official', 'Water Supply Department', 'EMP-406', true, NOW()),
-- Official 3
('user-id-3', 'kumar@municipality.gov', 'Mr. Raj Kumar', 'official', 'Electrical Department', 'EMP-407', true, NOW());

-- Verify all officials were created
SELECT id, email, full_name, user_type, department, employee_id 
FROM user_profiles 
WHERE user_type = 'official';
```

---

## Quick Test Credentials

For quick testing, create this account:

**Email:** `official@test.com`  
**Password:** `Test@123456`  
**Department:** `Public Works Department`  
**Employee ID:** `EMP-001`

---

## Troubleshooting

### "This portal is for authorized officials only"

**Problem:** Your account is not set as `user_type = 'official'`

**Solution:**
```sql
-- Check your user type
SELECT email, user_type FROM user_profiles WHERE email = 'your-email@example.com';

-- If it's not 'official', update it:
UPDATE user_profiles 
SET user_type = 'official', department = 'Public Works', employee_id = 'EMP-001'
WHERE email = 'your-email@example.com';
```

### "Invalid credentials"

**Problem:** Wrong email or password

**Solution:**
- Double-check email and password
- Reset password in Supabase Dashboard > Authentication > Users
- Click on the user and select "Send Password Recovery"

### "User not found"

**Problem:** User doesn't exist in `user_profiles` table

**Solution:**
```sql
-- Check if user exists in auth but not in profiles
SELECT email FROM auth.users WHERE email = 'your-email@example.com';

-- If exists in auth but not profiles, create profile:
INSERT INTO user_profiles (id, email, full_name, user_type, department, employee_id, is_onboarding_complete)
SELECT id, email, email, 'official', 'Public Works', 'EMP-001', true
FROM auth.users 
WHERE email = 'your-email@example.com';
```

---

## Understanding User Types

Your app has 3 user types:

| User Type | Access | Portal |
|-----------|--------|--------|
| `citizen` | Report issues, view events | Main app |
| `authority` | Review & assign issues | Authority Dashboard |
| `official` | Complete assigned work | Official Portal |

**Important:** Each user can only be ONE type at a time.

---

## Security Note

In production:
- Use strong passwords
- Don't share official credentials
- Each official should have their own account
- Use real employee IDs
- Set proper departments

---

## Next Steps After Creating Official Account

1. **Login to Official Portal**
   - Go to `/official/login`
   - Use your official credentials

2. **Assign Test Issue**
   ```sql
   -- As authority, assign an issue to your official account
   UPDATE issues 
   SET 
     assigned_to = 'your-official-user-id',
     status = 'assigned',
     department = 'Public Works'
   WHERE id = 'some-issue-id';
   ```

3. **Test Complete Workflow**
   - View assigned issue in dashboard
   - Mark as in-progress
   - Add internal notes
   - Upload after photo
   - Submit for approval

---

## Quick Reference

### Create Official (Complete Script)

```sql
-- 1. Create user in Supabase Dashboard > Authentication > Users
--    Email: official@test.com
--    Password: Test@123456
--    Copy the generated User ID

-- 2. Run this (replace YOUR-USER-ID):
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
  'YOUR-USER-ID',
  'official@test.com',
  'Test Official',
  'official',
  'Public Works Department',
  'EMP-001',
  true,
  NOW()
);

-- 3. Verify
SELECT * FROM user_profiles WHERE user_type = 'official';
```

### Login Credentials

```
URL: http://localhost:5173/official/login
Email: official@test.com
Password: Test@123456
```

---

## Need Help?

If you're still having issues:

1. Check Supabase logs for errors
2. Verify database migration ran successfully
3. Ensure RLS policies are active
4. Check browser console for errors

---

**You're now ready to access the Official Portal!** 🎉
