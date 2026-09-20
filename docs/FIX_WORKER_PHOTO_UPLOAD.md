# Fix: Worker Photo Upload Permission Error

## Problem
Workers get "permission denied for table users" error when trying to upload resolution photos.

## Root Cause
The error occurs because of one or more of these issues:

1. **Missing `issue_internal_notes` table** - The upload process tries to insert notes but the table doesn't exist
2. **Incorrect foreign key reference** - The `official_id` column might reference `user_profiles(id)` instead of `auth.users(id)`
3. **Missing RLS policies** - Workers don't have permission to insert notes or update issues
4. **Missing storage bucket policies** - Workers can't upload to the `issue-images` bucket

## Solution

### Step 1: Run Diagnostic Script

First, identify the exact issue:

```bash
# In Supabase SQL Editor, run:
DIAGNOSE_PERMISSION_ISSUE.sql
```

Review the output to see which components are missing or misconfigured.

### Step 2: Apply the Fix

Run the comprehensive fix script:

```bash
# In Supabase SQL Editor, run:
FIX_WORKER_PHOTO_UPLOAD_PERMISSIONS.sql
```

This script will:
- ✅ Create/update `issue_internal_notes` table with correct structure
- ✅ Set up proper RLS policies for workers
- ✅ Grant necessary permissions
- ✅ Create performance indexes

### Step 3: Configure Storage Policies

The SQL script can't create storage policies, so you need to do this manually:

1. Go to **Supabase Dashboard** → **Storage** → **Policies**
2. Select the `issue-images` bucket (create it if it doesn't exist)
3. Add these policies:

#### Policy 1: Workers can upload resolution photos
- **Name**: `Workers can upload resolution photos`
- **Allowed operations**: `INSERT`
- **Policy definition**:
  ```sql
  (bucket_id = 'issue-images' AND auth.role() = 'authenticated')
  ```

#### Policy 2: Public can view issue images
- **Name**: `Public can view issue images`
- **Allowed operations**: `SELECT`
- **Policy definition**:
  ```sql
  (bucket_id = 'issue-images')
  ```

#### Policy 3: Workers can update their uploads
- **Name**: `Workers can update their uploads`
- **Allowed operations**: `UPDATE`
- **Policy definition**:
  ```sql
  (bucket_id = 'issue-images' AND auth.role() = 'authenticated')
  ```

### Step 4: Verify the Fix

Test the upload functionality:

1. Log in as a worker
2. Navigate to an assigned issue
3. Click "Complete Job"
4. Upload an "after" photo
5. Submit for approval

If it works, you should see:
- ✅ Photo uploads successfully
- ✅ Issue status changes to "pending_approval"
- ✅ Internal notes are created
- ✅ No permission errors

## Alternative: Quick Fix for Foreign Key Issue

If the diagnostic shows that `official_id` references `user_profiles(id)` instead of `auth.users(id)`, run this:

```sql
-- Drop the incorrect foreign key
ALTER TABLE issue_internal_notes 
  DROP CONSTRAINT IF EXISTS issue_internal_notes_official_id_fkey;

-- Add the correct foreign key
ALTER TABLE issue_internal_notes 
  ADD CONSTRAINT issue_internal_notes_official_id_fkey 
  FOREIGN KEY (official_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;
```

## Common Issues and Solutions

### Issue: "relation 'issue_internal_notes' does not exist"
**Solution**: The table wasn't created. Run `FIX_WORKER_PHOTO_UPLOAD_PERMISSIONS.sql`

### Issue: "permission denied for table user_profiles"
**Solution**: The RLS policies on `user_profiles` are too restrictive. Add this policy:
```sql
CREATE POLICY "Authenticated users can read profiles"
  ON user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');
```

### Issue: "new row violates row-level security policy"
**Solution**: The INSERT policy on `issue_internal_notes` is blocking the insert. Verify the worker is assigned to the issue:
```sql
-- Check if worker is assigned
SELECT id, title, assigned_to, status 
FROM issues 
WHERE id = '<issue-id>';
```

### Issue: "Failed to upload to storage"
**Solution**: Storage bucket or policies are missing. Follow Step 3 above.

## Testing Checklist

- [ ] Worker can view assigned issues
- [ ] Worker can update issue status to "in_progress"
- [ ] Worker can upload "after" photo (< 5MB)
- [ ] Worker can add resolution notes
- [ ] Issue status changes to "pending_approval"
- [ ] Internal notes are created successfully
- [ ] No permission errors in console

## Need More Help?

If the issue persists:

1. Check browser console for detailed error messages
2. Check Supabase logs: Dashboard → Logs → API
3. Verify the worker's `user_type` is set to `'official'`:
   ```sql
   SELECT id, email, user_type, employee_id, department 
   FROM user_profiles 
   WHERE id = auth.uid();
   ```

## Related Files

- `src/pages/official/UploadResolution.tsx` - Photo upload component
- `docs/migration/department-official-portal.sql` - Original migration
- `FIX_WORKER_PHOTO_UPLOAD_PERMISSIONS.sql` - Fix script
- `DIAGNOSE_PERMISSION_ISSUE.sql` - Diagnostic script
