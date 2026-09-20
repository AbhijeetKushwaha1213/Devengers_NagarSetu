-- ==============================================================================
-- Migration: Citizen Issue Deletion RLS Policy
-- File: supabase/migrations/20260920050000_enable_citizen_issue_deletion_rls.sql
-- Description:
--   Enables authenticated citizen reporters to delete their own issues strictly while status = 'submitted'.
--   Prevents unauthorized deletion by other users or on issues already verified, in_progress, or resolved.
-- ==============================================================================

-- 1. Ensure RLS is active on public.issues
ALTER TABLE IF EXISTS public.issues ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policy if any exists
DROP POLICY IF EXISTS "Reporters can delete own submitted issues" ON public.issues;

-- 3. Create hardened DELETE policy for reporters
CREATE POLICY "Reporters can delete own submitted issues"
  ON public.issues
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = reporter_id
    AND status = 'submitted'
  );

-- 4. Ensure authenticated role has DELETE permission on public.issues
GRANT DELETE ON public.issues TO authenticated;
