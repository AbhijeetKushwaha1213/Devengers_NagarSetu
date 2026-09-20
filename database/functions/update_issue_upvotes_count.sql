-- Stored procedure to atomically maintain issues.upvotes_count based on public.upvotes rows
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
