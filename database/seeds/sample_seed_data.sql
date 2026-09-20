-- Sample development seeds for NagarSetu-Civic local testing

-- 1. Sample Municipalities / Panchayats
INSERT INTO public.panchayats (id, name, district, state)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'South Delhi Municipal Corporation', 'South Delhi', 'Delhi'),
  ('a0000000-0000-0000-0000-000000000002', 'Greater Mumbai Municipal Corporation', 'Mumbai City', 'Maharashtra'),
  ('a0000000-0000-0000-0000-000000000003', 'Bengaluru Urban Zilla Panchayat', 'Bengaluru Urban', 'Karnataka')
ON CONFLICT (id) DO NOTHING;

-- 2. Sample Departments
INSERT INTO public.departments (id, name, code)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Public Works & Roads', 'PWD'),
  ('b0000000-0000-0000-0000-000000000002', 'Electricity & Street Lighting', 'ELEC'),
  ('b0000000-0000-0000-0000-000000000003', 'Sanitation & Solid Waste Management', 'SWM'),
  ('b0000000-0000-0000-0000-000000000004', 'Water Supply & Drainage', 'WSD')
ON CONFLICT (id) DO NOTHING;
