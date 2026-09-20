# Quick Fix: Worker Photo Upload Error

## The Error
```
Failed to upload photo: Update failed: permission denied for table users
```

## Quick Fix (5 minutes)

### 1. Run This SQL Script
Open **Supabase SQL Editor** and run:

```sql
-- Fix issue_internal_notes table
CREATE TABLE IF NOT EXISTS issue_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  official_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE issue_internal_notes ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Officials can create internal notes for their issues" ON issue_internal_notes;

-- Create new policy
CREATE POLICY "Officials can create internal notes for their issues"
  ON issue_internal_notes FOR INSERT
  WITH CHECK (
    official_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM issues 
      WHERE issues.id = issue_internal_notes.issue_id 
      AND issues.assigned_to = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT, INSERT ON issue_internal_notes TO authenticated;
```

### 2. Configure Storage (if needed)
Go to **Supabase Dashboard** → **Storage** → **issue-images** bucket → **Policies**

Add this policy if missing:
- **Name**: `Authenticated users can upload`
- **Operation**: `INSERT`
- **Policy**: `(bucket_id = 'issue-images' AND auth.role() = 'authenticated')`

### 3. Test
1. Log in as worker
2. Go to assigned issue
3. Upload photo
4. Should work now! ✅

## Still Not Working?

Run the full diagnostic:
```bash
# See: DIAGNOSE_PERMISSION_ISSUE.sql
# Then: FIX_WORKER_PHOTO_UPLOAD_PERMISSIONS.sql
```

Full guide: `docs/FIX_WORKER_PHOTO_UPLOAD.md`
