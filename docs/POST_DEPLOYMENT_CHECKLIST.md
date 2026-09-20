# Post-Deployment Checklist

## ✅ Completed

- [x] Fixed worker photo upload permission error
- [x] Fixed upvote feature to use database
- [x] Applied database migrations
- [x] Updated frontend code
- [x] Committed changes to git
- [x] Pushed to GitHub

## 🧪 Testing Required

### Test 1: Worker Photo Upload
1. [ ] Open application in browser
2. [ ] Log in as a worker account
3. [ ] Navigate to an assigned issue
4. [ ] Click "Complete Job" button
5. [ ] Upload an "after" photo (< 5MB)
6. [ ] Add a resolution note (optional)
7. [ ] Click "Submit for Final Approval"
8. [ ] **Expected:** Success message, no errors
9. [ ] **Verify:** Issue status changed to "pending_approval"
10. [ ] **Verify:** Photo is visible in issue details

### Test 2: Upvote Feature
1. [ ] Open browser console (F12)
2. [ ] Run: `localStorage.removeItem('userUpvotes')`
3. [ ] Refresh the page
4. [ ] Log in as any user
5. [ ] Navigate to Issues page
6. [ ] Click upvote button on an issue
7. [ ] **Expected:** Count increases, button turns blue
8. [ ] Refresh the page
9. [ ] **Expected:** Upvote is still there (persisted)
10. [ ] Click upvote again
11. [ ] **Expected:** Count decreases, button turns gray
12. [ ] Open in different browser/device (same user)
13. [ ] **Expected:** Upvote status syncs correctly

### Test 3: Storage Bucket (Manual Check)
1. [ ] Go to Supabase Dashboard
2. [ ] Navigate to Storage section
3. [ ] Check if `issue-images` bucket exists
4. [ ] Click on bucket → Policies tab
5. [ ] Verify policy exists: "Workers can upload resolution photos"
   - Operation: INSERT
   - Policy: `(bucket_id = 'issue-images' AND auth.role() = 'authenticated')`
6. [ ] Verify policy exists: "Public can view issue images"
   - Operation: SELECT
   - Policy: `(bucket_id = 'issue-images')`
7. [ ] If policies missing, add them manually

## 🔍 Verification Queries

Run these in Supabase SQL Editor to verify:

```sql
-- Check if migrations applied
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 3;

-- Check issue_internal_notes table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'issue_internal_notes';

-- Check user_upvotes table
SELECT COUNT(*) as total_upvotes FROM user_upvotes;

-- Check upvotes_count column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'issues' AND column_name = 'upvotes_count';

-- Check RLS policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('issue_internal_notes', 'user_upvotes')
ORDER BY tablename, policyname;
```

## 🚨 Troubleshooting

### If Worker Upload Still Fails

1. Check browser console for exact error
2. Check Supabase logs: Dashboard → Logs → API
3. Verify worker is assigned to the issue:
   ```sql
   SELECT id, title, assigned_to, status
   FROM issues
   WHERE id = '<issue-id>';
   ```
4. Check if issue_internal_notes table exists:
   ```sql
   SELECT * FROM issue_internal_notes LIMIT 1;
   ```

### If Upvotes Don't Persist

1. Clear localStorage completely:
   ```javascript
   localStorage.clear();
   location.reload();
   ```
2. Check if user_upvotes table exists:
   ```sql
   SELECT * FROM user_upvotes LIMIT 1;
   ```
3. Check if toggle_upvote function exists:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'toggle_upvote';
   ```
4. Test function manually:
   ```sql
   SELECT * FROM toggle_upvote('<issue-id>', auth.uid());
   ```

### If Storage Upload Fails

1. Check bucket exists: Dashboard → Storage
2. Check bucket is public or has correct policies
3. Check file size (must be < 5MB for worker uploads)
4. Check file type (images only)

## 📊 Monitoring

### Things to Monitor

- [ ] Error rate in Supabase logs
- [ ] Worker photo upload success rate
- [ ] Upvote count accuracy
- [ ] Storage bucket usage
- [ ] Database performance

### Supabase Dashboard Checks

1. **Logs → API Logs**
   - Look for 403 errors (permission denied)
   - Look for 500 errors (server errors)

2. **Database → Tables**
   - Check `issue_internal_notes` row count
   - Check `user_upvotes` row count

3. **Storage → issue-images**
   - Check file count
   - Check storage usage

## 📝 User Communication

### For Workers
"We've fixed the photo upload issue! You can now upload resolution photos without errors. Please try completing a job and let us know if you encounter any issues."

### For All Users
"We've improved the upvote feature! Your upvotes will now persist across devices and sessions. You may need to clear your browser cache for the best experience."

## 🔄 Rollback Plan

If critical issues arise:

```bash
# 1. Rollback code
git reset --hard 7302c42
git push origin main --force

# 2. Rollback database (if needed)
# Contact Supabase support or restore from backup

# 3. Notify users
```

## ✅ Sign-off

Once all tests pass:

- [ ] Worker photo upload working
- [ ] Upvote feature working
- [ ] No errors in logs
- [ ] Storage policies configured
- [ ] Team notified
- [ ] Documentation updated

**Tested by:** _______________
**Date:** _______________
**Status:** _______________

---

**Deployment Date:** 2026-01-16
**Commit:** 67b4fc3
**Migrations:** 3 applied successfully
