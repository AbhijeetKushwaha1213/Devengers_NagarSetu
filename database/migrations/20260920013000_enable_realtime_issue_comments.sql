-- ==============================================================================
-- Migration: Enable Realtime for Issue Comments
-- File: database/migrations/20260920013000_enable_realtime_issue_comments.sql
-- Description:
--   Adds public.issue_comments to the supabase_realtime publication so that
--   frontend subscribers on issue details pages receive live INSERT events.
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'issue_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.issue_comments;
  END IF;
END $$;
