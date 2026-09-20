-- Row Level Security (RLS) Policies for public.departments

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Anyone can view municipal departments
DROP POLICY IF EXISTS "Public can view departments" ON public.departments;
CREATE POLICY "Public can view departments"
  ON public.departments
  FOR SELECT
  USING (true);
