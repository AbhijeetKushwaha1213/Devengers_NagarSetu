# Database & RLS Security Tests

This test document outlines the validation checklist for Supabase Row Level Security (RLS) policies and database constraints.

## Test Scenarios

### 1. Public Issue Visibility
- **Role**: Anonymous (unauthenticated)
- **Action**: Query `public.issues`
- **Expected**: HTTP 200, returns public civic issues without exposing reporter PII.

### 2. Citizen Issue Creation
- **Role**: Authenticated citizen (`role = 'citizen'`)
- **Action**: Insert into `public.issues` with `reporter_id = auth.uid()`
- **Expected**: Successful insert.
- **Action**: Insert into `public.issues` with `reporter_id != auth.uid()`
- **Expected**: RLS violation (Permission denied).

### 3. Upvote Integrity
- **Role**: Authenticated citizen
- **Action**: Insert upvote for issue
- **Expected**: Succeeds on first attempt, duplicate throws primary key conflict.
- **Action**: Delete upvote where `user_id = auth.uid()`
- **Expected**: Succeeds.

### 4. Worker Resolution Verification
- **Role**: Assigned field worker (`auth.uid() = assigned_worker_id`)
- **Action**: Update issue with status = `resolved` and `resolution_image_urls`
- **Expected**: Successfully updates issue record.
