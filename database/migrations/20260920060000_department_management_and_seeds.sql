-- ==============================================================================
-- Migration: Department Management & RLS Hardening with Seeds
-- File: database/migrations/20260920060000_department_management_and_seeds.sql
-- Description:
--   1. Ensures RLS is enabled on public.departments.
--   2. Preserves public read access for all authenticated & public users.
--   3. Adds administrative management policies allowing municipal admins and central
--      administrators to insert, update, and manage departments in their jurisdiction.
--   4. Seeds standard municipal departments (Sanitation, Electrical, Water Supply)
--      for Prayagraj Municipal Corporation (e15a8684-df60-4451-8897-699aaf8a33c6).
-- ==============================================================================

-- 1. Ensure RLS is active on public.departments
ALTER TABLE IF EXISTS public.departments ENABLE ROW LEVEL SECURITY;

-- 2. Preserve / ensure public read access policy
DROP POLICY IF EXISTS "Public can view departments" ON public.departments;
CREATE POLICY "Public can view departments"
  ON public.departments
  FOR SELECT
  USING (true);

-- 3. Create administrative management policy
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
CREATE POLICY "Admins can manage departments"
  ON public.departments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_active = true
      AND (
        user_profiles.role = 'administrator'
        OR (
          user_profiles.role = 'municipal_admin'
          AND (
            user_profiles.municipality_id IS NULL
            OR public.departments.municipality_id IS NULL
            OR user_profiles.municipality_id = public.departments.municipality_id
          )
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_active = true
      AND (
        user_profiles.role = 'administrator'
        OR (
          user_profiles.role = 'municipal_admin'
          AND (
            user_profiles.municipality_id IS NULL
            OR public.departments.municipality_id IS NULL
            OR user_profiles.municipality_id = public.departments.municipality_id
          )
        )
      )
    )
  );

-- 4. Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;

-- 5. Seed standard municipal departments for Prayagraj Municipal Corporation
-- Prayagraj Municipal Corporation ID: e15a8684-df60-4451-8897-699aaf8a33c6
INSERT INTO public.departments (id, municipality_id, name)
VALUES
  (
    '1694091f-28e9-4b81-92f6-9ab9935438b6',
    'e15a8684-df60-4451-8897-699aaf8a33c6',
    'Sanitation Department'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'e15a8684-df60-4451-8897-699aaf8a33c6',
    'Electrical Department'
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'e15a8684-df60-4451-8897-699aaf8a33c6',
    'Water Supply Department'
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  municipality_id = EXCLUDED.municipality_id;
