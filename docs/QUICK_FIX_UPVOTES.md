# Quick Fix: Upvote Feature

## The Problem
Upvotes not working - using localStorage instead of database.

## Quick Fix (3 steps)

### 1. Run SQL Script
Open **Supabase SQL Editor** and run:
```bash
FIX_UPVOTE_FEATURE.sql
```

### 2. Clear Browser Cache
In browser console:
```javascript
localStorage.removeItem('userUpvotes');
```
Then refresh the page.

### 3. Test It
- Click upvote button ✅
- Count should increase
- Refresh page
- Upvote should persist ✅

## What Changed

**Before:**
- ❌ Upvotes stored in localStorage
- ❌ Lost when cache cleared
- ❌ Not synced across devices

**After:**
- ✅ Upvotes stored in database
- ✅ Persistent and reliable
- ✅ Synced across all devices
- ✅ Proper user tracking

## Files Updated
- `src/components/IssueCard.tsx` ✅
- `src/pages/IssueDetail.tsx` ✅
- Database: `user_upvotes` table ✅
- Database: `toggle_upvote()` function ✅

## Still Not Working?

See full guide: `docs/FIX_UPVOTE_FEATURE.md`

## Verify Database Setup
```sql
-- Check if function exists
SELECT proname FROM pg_proc WHERE proname = 'toggle_upvote';

-- Check if table exists
SELECT * FROM user_upvotes LIMIT 1;

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'user_upvotes';
```

All queries should return results. If not, run `FIX_UPVOTE_FEATURE.sql` again.
