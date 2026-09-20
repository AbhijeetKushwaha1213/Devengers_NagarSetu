-- Row Level Security (RLS) Policies for public.issue_comments table

ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;

-- 1. Anyone can view comments for visible issues
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

-- 2. Authenticated users can create comments on accessible issues
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

-- 3. Users can update own comments
DROP POLICY IF EXISTS "Users can update own comments" ON public.issue_comments;
CREATE POLICY "Users can update own comments"
  ON public.issue_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Users can delete own comments
DROP POLICY IF EXISTS "Users can delete own comments" ON public.issue_comments;
CREATE POLICY "Users can delete own comments"
  ON public.issue_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
