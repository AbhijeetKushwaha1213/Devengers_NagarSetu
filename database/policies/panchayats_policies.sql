-- Row Level Security (RLS) Policies for public.panchayats (municipalities / local bodies)

ALTER TABLE public.panchayats ENABLE ROW LEVEL SECURITY;

-- Anyone can read panchayats for selecting location
DROP POLICY IF EXISTS "Public can view panchayats" ON public.panchayats;
CREATE POLICY "Public can view panchayats"
  ON public.panchayats
  FOR SELECT
  USING (true);
