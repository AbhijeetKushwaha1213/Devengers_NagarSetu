# 🎯 Official Account Setup - Visual Step-by-Step Guide

## Method 1: Create New Official Account (Recommended for Testing)

### Step 1: Open Supabase Dashboard

1. Go to your Supabase project: `https://supabase.com/dashboard`
2. Select your project
3. Click on **"Authentication"** in the left sidebar
4. Click on **"Users"** tab

```
Supabase Dashboard
├── Authentication  ← Click here
│   ├── Users      ← Then click here
│   ├── Policies
│   └── Settings
```

---

### Step 2: Create New User

1. Click the **"Add User"** button (top right)
2. A modal will appear with a form

Fill in:
```
┌─────────────────────────────────────┐
│  Create New User                    │
├─────────────────────────────────────┤
│                                     │
│  Email *                            │
│  ┌─────────────────────────────┐   │
│  │ official@test.com           │   │
│  └─────────────────────────────┘   │
│                                     │
│  Password *                         │
│  ┌─────────────────────────────┐   │
│  │ Test@123456                 │   │
│  └─────────────────────────────┘   │
│                                     │
│  ☑ Auto Confirm User                │
│                                     │
│  [Cancel]  [Create User]            │
└─────────────────────────────────────┘
```

3. Click **"Create User"**

---

### Step 3: Copy User ID

After creating the user, you'll see it in the users list:

```
┌──────────────────────────────────────────────────────────────┐
│ Users                                          [Add User]     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ Email              │ Created        │ Last Sign In │ Actions │
│────────────────────┼────────────────┼──────────────┼─────────│
│ official@test.com  │ Just now       │ Never        │ [...]   │
│ ID: a1b2c3d4-...   │                │              │         │
│    ↑ COPY THIS ID                                            │
└──────────────────────────────────────────────────────────────┘
```

**Important:** Click on the user row to see the full ID, then copy it.

The ID looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

### Step 4: Run SQL to Make User an Official

1. Click on **"SQL Editor"** in the left sidebar
2. Click **"New Query"**
3. Paste this SQL (replace `YOUR-USER-ID` with the ID you copied):

```sql
-- Make this user an official
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
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  -- ⚠️ REPLACE with your copied ID
  'official@test.com',
  'Test Official',
  'official',
  'Public Works Department',
  'EMP-001',
  true,
  NOW()
);
```

4. Click **"Run"** (or press Ctrl+Enter)

---

### Step 5: Verify It Worked

Run this query to check:

```sql
SELECT 
  id,
  email,
  full_name,
  user_type,
  department,
  employee_id
FROM user_profiles 
WHERE email = 'official@test.com';
```

You should see:
```
┌──────────────────────┬───────────────────┬──────────────┬───────────┬─────────────────────────┬─────────────┐
│ id                   │ email             │ full_name    │ user_type │ department              │ employee_id │
├──────────────────────┼───────────────────┼──────────────┼───────────┼─────────────────────────┼─────────────┤
│ a1b2c3d4-e5f6-...    │ official@test.com │ Test Official│ official  │ Public Works Department │ EMP-001     │
└──────────────────────┴───────────────────┴──────────────┴───────────┴─────────────────────────┴─────────────┘
```

✅ If you see `user_type = 'official'`, you're done!

---

### Step 6: Login to Official Portal

1. Open your app: `http://localhost:5173/`
2. Click **"Access as Worker"** button
3. You'll be redirected to: `http://localhost:5173/official/login`

Login with:
```
┌─────────────────────────────────────┐
│  Nagarsetu - Official's Portal      │
├─────────────────────────────────────┤
│                                     │
│  Email ID / Employee ID             │
│  ┌─────────────────────────────┐   │
│  │ official@test.com           │   │
│  └─────────────────────────────┘   │
│                                     │
│  Password                           │
│  ┌─────────────────────────────┐   │
│  │ Test@123456                 │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Login]                            │
└─────────────────────────────────────┘
```

4. Click **"Login"**
5. You should see the **Official Dashboard**! 🎉

---

## Method 2: Convert Your Existing Account

If you want to use your current account instead:

### Step 1: Find Your Current User ID

1. Go to **SQL Editor** in Supabase
2. Run this query (replace with your email):

```sql
SELECT id, email, user_type 
FROM user_profiles 
WHERE email = 'your-current-email@example.com';
```

3. Copy the `id` value

---

### Step 2: Convert to Official

Run this SQL (replace with your ID):

```sql
UPDATE user_profiles 
SET 
  user_type = 'official',
  department = 'Public Works Department',
  employee_id = 'EMP-001',
  is_onboarding_complete = true
WHERE id = 'YOUR-USER-ID';
```

---

### Step 3: Verify

```sql
SELECT id, email, user_type, department, employee_id
FROM user_profiles 
WHERE id = 'YOUR-USER-ID';
```

Should show `user_type = 'official'`

---

### Step 4: Logout and Login Again

1. Logout from your current session
2. Go to `/official/login`
3. Login with your email and password
4. Access the official portal!

---

## Quick Reference Card

### Test Credentials
```
Email:    official@test.com
Password: Test@123456
Portal:   http://localhost:5173/official/login
```

### SQL Quick Commands

**Check if user is official:**
```sql
SELECT email, user_type FROM user_profiles WHERE email = 'official@test.com';
```

**Make user official:**
```sql
UPDATE user_profiles SET user_type = 'official', department = 'Public Works', employee_id = 'EMP-001' WHERE email = 'your-email@example.com';
```

**List all officials:**
```sql
SELECT email, full_name, department, employee_id FROM user_profiles WHERE user_type = 'official';
```

---

## Troubleshooting

### ❌ "This portal is for authorized officials only"

**Cause:** Your user_type is not 'official'

**Fix:**
```sql
-- Check current type
SELECT email, user_type FROM user_profiles WHERE email = 'your-email@example.com';

-- Change to official
UPDATE user_profiles SET user_type = 'official' WHERE email = 'your-email@example.com';
```

---

### ❌ "Invalid credentials"

**Cause:** Wrong email or password

**Fix:**
1. Go to Supabase Dashboard > Authentication > Users
2. Find your user
3. Click the three dots (...)
4. Select "Send Password Recovery Email"
5. Check your email and reset password

---

### ❌ "User not found"

**Cause:** User exists in auth but not in user_profiles table

**Fix:**
```sql
-- Check if user exists in auth
SELECT email FROM auth.users WHERE email = 'your-email@example.com';

-- If yes, create profile
INSERT INTO user_profiles (id, email, full_name, user_type, department, employee_id, is_onboarding_complete)
SELECT id, email, email, 'official', 'Public Works', 'EMP-001', true
FROM auth.users 
WHERE email = 'your-email@example.com';
```

---

## What's Next?

After logging in successfully:

### 1. Assign a Test Issue

```sql
-- Find an issue
SELECT id, title FROM issues LIMIT 1;

-- Assign it to your official account
UPDATE issues 
SET 
  assigned_to = 'your-official-user-id',
  status = 'assigned',
  department = 'Public Works'
WHERE id = 'issue-id-from-above';
```

### 2. Test the Complete Workflow

1. ✅ View assigned issue in dashboard
2. ✅ Click to see details
3. ✅ Mark as "In-Progress"
4. ✅ Add internal notes
5. ✅ Upload after photo
6. ✅ Submit for approval

---

## Summary

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. Create user in Supabase Authentication              │
│     Email: official@test.com                            │
│     Password: Test@123456                               │
│                                                         │
│  2. Copy the User ID                                    │
│                                                         │
│  3. Run SQL to make user official                       │
│     INSERT INTO user_profiles ...                       │
│                                                         │
│  4. Login at /official/login                            │
│                                                         │
│  5. Access Official Dashboard! 🎉                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Need More Help?

Check these files:
- `docs/CREATE_OFFICIAL_ACCOUNT_GUIDE.md` - Detailed text guide
- `docs/scripts/quick-create-official.sql` - Ready-to-run SQL script
- `docs/OFFICIAL_PORTAL_QUICKSTART.md` - Complete quick start guide

---

**You're all set! Happy issue resolving! 🚀**
