-- Row Level Security (RLS) Policies for public.upvotes table

ALTER TABLE public.upvotes ENABLE ROW LEVEL SECURITY;

-- 1. Anyone can view upvotes for visible issues
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

-- 2. Authenticated users can insert their own upvote on visible issues
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

-- 3. Users can remove their own upvote
DROP POLICY IF EXISTS "Users can remove upvote" ON public.upvotes;
CREATE POLICY "Users can remove upvote"
  ON public.upvotes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
