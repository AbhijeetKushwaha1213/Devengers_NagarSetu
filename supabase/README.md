# Supabase Migrations

This directory contains database migrations for the NagarSetu project.

## Structure

```
supabase/
├── migrations/           # Database migration files
│   ├── 20260116072056_fix_worker_photo_upload_permissions.sql
│   └── 20260116072105_fix_upvote_feature.sql
├── .temp/               # Temporary CLI files (gitignored)
└── README.md            # This file
```

## Migrations

### 20260116072056 - Fix Worker Photo Upload Permissions
Fixes the "permission denied for table users" error when workers upload resolution photos.

**Changes:**
- Creates `issue_internal_notes` table
- Sets up RLS policies for workers
- Adds indexes for performance

### 20260116072105 - Fix Upvote Feature
Migrates upvote system from localStorage to proper database tracking.

**Changes:**
- Creates `user_upvotes` table
- Adds `upvotes_count` column to issues
- Creates `toggle_upvote()` function
- Sets up RLS policies
- Adds performance indexes

## Usage

### Apply Migrations

To apply all pending migrations to your remote database:

```bash
supabase db push
```

### Create New Migration

To create a new migration file:

```bash
supabase migration new <migration_name>
```

Example:
```bash
supabase migration new add_notifications_table
```

This creates a new file: `supabase/migrations/YYYYMMDDHHMMSS_add_notifications_table.sql`

### List Migrations

To see which migrations have been applied:

```bash
supabase migration list
```

Output shows:
- **Local**: Migrations in your local `migrations/` folder
- **Remote**: Migrations applied to your Supabase database
- **Time**: When the migration was created

### Reset Database (Caution!)

To reset your local database and reapply all migrations:

```bash
supabase db reset
```

⚠️ **Warning**: This will delete all data in your local database!

## Best Practices

### 1. Never Edit Applied Migrations
Once a migration is applied to production, never edit it. Create a new migration instead.

❌ **Bad:**
```bash
# Editing an already-applied migration
vim supabase/migrations/20260116072056_fix_worker_photo_upload_permissions.sql
```

✅ **Good:**
```bash
# Create a new migration to make changes
supabase migration new update_worker_permissions
```

### 2. Use Idempotent SQL
Always use `IF EXISTS` and `IF NOT EXISTS` to make migrations safe to run multiple times:

```sql
-- Good: Safe to run multiple times
CREATE TABLE IF NOT EXISTS my_table (...);
ALTER TABLE my_table ADD COLUMN IF NOT EXISTS my_column TEXT;
DROP POLICY IF EXISTS "my_policy" ON my_table;

-- Bad: Will fail if run twice
CREATE TABLE my_table (...);
ALTER TABLE my_table ADD COLUMN my_column TEXT;
```

### 3. Test Migrations Locally First
Before pushing to production:

```bash
# 1. Test locally (if using local Supabase)
supabase db reset
supabase db push

# 2. Verify everything works
# 3. Then push to remote
supabase db push
```

### 4. Include Rollback Instructions
Add comments in your migration explaining how to rollback if needed:

```sql
-- To rollback this migration:
-- DROP TABLE IF EXISTS my_new_table;
-- ALTER TABLE my_table DROP COLUMN IF EXISTS my_new_column;
```

### 5. Keep Migrations Small
One migration = one logical change. Don't combine unrelated changes.

✅ **Good:**
- `add_user_profiles_table.sql`
- `add_email_column_to_users.sql`
- `create_upvote_function.sql`

❌ **Bad:**
- `big_update_with_everything.sql`

## Troubleshooting

### Migration Failed to Apply

If a migration fails:

1. Check the error message in the output
2. Fix the SQL in the migration file
3. Run `supabase db push` again

### Migration Applied but Not Working

1. Check if RLS policies are correct
2. Verify permissions are granted
3. Check if indexes were created
4. Test queries manually in SQL Editor

### Need to Rollback

Create a new migration that reverses the changes:

```bash
supabase migration new rollback_feature_x
```

Then write SQL to undo the previous migration.

## Project Setup

### Link to Supabase Project

```bash
supabase link --project-ref vzqtjhoevvjxdgocnfju
```

### Login to Supabase

```bash
supabase login
```

### Check Connection

```bash
supabase db remote status
```

## Documentation

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Database Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [SQL Best Practices](https://supabase.com/docs/guides/database/overview)

## Related Files

- `MIGRATION_APPLIED.md` - Summary of applied migrations
- `docs/FIX_WORKER_PHOTO_UPLOAD.md` - Worker photo upload fix guide
- `docs/FIX_UPVOTE_FEATURE.md` - Upvote feature fix guide

---

**Project:** NagarSetu
**Supabase Project ID:** vzqtjhoevvjxdgocnfju
**Last Updated:** 2026-01-16
