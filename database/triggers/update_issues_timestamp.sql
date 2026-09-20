-- Trigger to update updated_at timestamp when an issue row is modified
DROP TRIGGER IF EXISTS update_issues_updated_at ON public.issues;

CREATE TRIGGER update_issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
