-- Trigger to update issues.upvotes_count when an upvote is added or deleted
DROP TRIGGER IF EXISTS trigger_update_issue_upvotes_count ON public.upvotes;

CREATE TRIGGER trigger_update_issue_upvotes_count
  AFTER INSERT OR DELETE ON public.upvotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_issue_upvotes_count();
