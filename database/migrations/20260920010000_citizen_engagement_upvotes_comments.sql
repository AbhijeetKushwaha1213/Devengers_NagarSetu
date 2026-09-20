-- ==============================================================================
-- Migration: Citizen Engagement — Persistent Upvotes & Issue Comments
-- File: database/migrations/20260920010000_citizen_engagement_upvotes_comments.sql
-- Description:
--   1. Creates public.upvotes table with composite unique constraint (issue_id, user_id).
--   2. Adds atomic database trigger on public.upvotes to maintain issues.upvotes_count.
--   3. Sets hardened Row Level Security (RLS) on public.upvotes.
--   4. Creates public.issue_comments table with foreign keys and timestamp triggers.
--   5. Sets hardened Row Level Security (RLS) on public.issue_comments tied to issue visibility.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UPVOTES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT upvotes_issue_user_unique UNIQUE (issue_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_upvotes_issue_id ON public.upvotes(issue_id);
CREATE INDEX IF NOT EXISTS idx_upvotes_user_id ON public.upvotes(user_id);

-- ------------------------------------------------------------------------------
-- 2. ATOMIC UPVOTES COUNTER TRIGGER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_issue_upvotes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.issues
    SET upvotes_count = (
      SELECT COUNT(*) FROM public.upvotes WHERE issue_id = NEW.issue_id
    )
    WHERE id = NEW.issue_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.issues
    SET upvotes_count = (
      SELECT COUNT(*) FROM public.upvotes WHERE issue_id = OLD.issue_id
    )
    WHERE id = OLD.issue_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_issue_upvotes_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_issue_upvotes_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_issue_upvotes_count() TO service_role;

DROP TRIGGER IF EXISTS trigger_update_issue_upvotes_count ON public.upvotes;
CREATE TRIGGER trigger_update_issue_upvotes_count
  AFTER INSERT OR DELETE ON public.upvotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_issue_upvotes_count();

-- ------------------------------------------------------------------------------
-- 3. UPVOTES ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.upvotes ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Anyone can view upvotes for visible issues
DROP POLICY IF EXISTS "Anyone can view upvotes" ON public.upvotes;
CREATE POLICY "Anyone can view upvotes"
  ON public.upvotes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.issues
      WHERE issues.id = upvotes.issue_id
    )
  );

-- 2. INSERT: Authenticated users can insert their own upvote on visible issues
DROP POLICY IF EXISTS "Authenticated users can upvote" ON public.upvotes;
CREATE POLICY "Authenticated users can upvote"
  ON public.upvotes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.issues
      WHERE issues.id = upvotes.issue_id
    )
  );

-- 3. DELETE: Users can remove their own upvote
DROP POLICY IF EXISTS "Users can remove upvote" ON public.upvotes;
CREATE POLICY "Users can remove upvote"
  ON public.upvotes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- 4. ISSUE COMMENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_issue_comments_issue_id ON public.issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_user_id ON public.issue_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_created_at ON public.issue_comments(created_at);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_issue_comments_updated_at ON public.issue_comments;
CREATE TRIGGER update_issue_comments_updated_at
  BEFORE UPDATE ON public.issue_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 5. ISSUE COMMENTS ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Anyone can view comments for visible issues
DROP POLICY IF EXISTS "Users can view comments for accessible issues" ON public.issue_comments;
CREATE POLICY "Users can view comments for accessible issues"
  ON public.issue_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.issues
      WHERE issues.id = issue_comments.issue_id
    )
  );

-- 2. INSERT: Authenticated users can comment on visible issues (ownership strictly enforced)
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.issue_comments;
CREATE POLICY "Authenticated users can create comments"
  ON public.issue_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.issues
      WHERE issues.id = issue_comments.issue_id
    )
  );

-- 3. UPDATE: Users can update only their own comments
DROP POLICY IF EXISTS "Users can update own comments" ON public.issue_comments;
CREATE POLICY "Users can update own comments"
  ON public.issue_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. DELETE: Users can delete only their own comments
DROP POLICY IF EXISTS "Users can delete own comments" ON public.issue_comments;
CREATE POLICY "Users can delete own comments"
  ON public.issue_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
