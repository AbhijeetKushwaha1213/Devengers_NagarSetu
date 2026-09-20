-- ==============================================================================
-- Controlled Migration: Security Advisor & RLS Alignment
-- File: supabase/migrations/20260919141500_enable_rls_security_advisor_fixes.sql
-- Description:
--   1. Ensures RLS is enabled on user_profiles without broad public exposure.
--   2. Preserves strict auth.uid() = id access for individual users.
--   3. Implements recursion-safe helper functions (SECURITY DEFINER) for
--      scoped municipal-admin access to worker profiles.
--   4. Hardens EXECUTE grants on SECURITY DEFINER functions (revokes from
--      PUBLIC, grants only to authenticated; blocks anon).
--   5. Enables RLS and authenticated SELECT policies on legacy/reference
--      tables (districts, blocks, panchayats).
--   6. Preserves all legacy tables, columns, enums, and data untouched.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HELPER FUNCTIONS (Prevent Infinite Recursion in user_profiles RLS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Revoke default public execution & grant strictly to authenticated users
REVOKE EXECUTE ON FUNCTION public.get_auth_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_role() TO authenticated;


CREATE OR REPLACE FUNCTION public.get_auth_user_municipality_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT municipality_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Revoke default public execution & grant strictly to authenticated users
REVOKE EXECUTE ON FUNCTION public.get_auth_user_municipality_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_municipality_id() TO authenticated;


-- ------------------------------------------------------------------------------
-- 2. USER PROFILES TABLE (Strict Least Privilege)
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Ensure broad public SELECT is NOT present
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.user_profiles;

-- Ensure users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Ensure users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Ensure users can update only their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Scoped Policy: Municipal Admins can view worker profiles within their municipality
DROP POLICY IF EXISTS "Municipal admins can view municipal workers" ON public.user_profiles;
CREATE POLICY "Municipal admins can view municipal workers"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_user_role() = 'municipal_admin'
    AND public.get_auth_user_municipality_id() = public.user_profiles.municipality_id
    AND public.user_profiles.role::text = 'worker'
  );


-- ------------------------------------------------------------------------------
-- 3. REFERENCE TABLES (districts, blocks, panchayats)
-- Restricted to authenticated users, matching municipalities/wards/departments
-- ------------------------------------------------------------------------------

-- Districts
ALTER TABLE IF EXISTS public.districts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access to all users for districts" ON public.districts;
DROP POLICY IF EXISTS "Authenticated users can select districts" ON public.districts;
CREATE POLICY "Authenticated users can select districts"
  ON public.districts
  FOR SELECT
  TO authenticated
  USING (true);

-- Blocks
ALTER TABLE IF EXISTS public.blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access to all users for blocks" ON public.blocks;
DROP POLICY IF EXISTS "Authenticated users can select blocks" ON public.blocks;
CREATE POLICY "Authenticated users can select blocks"
  ON public.blocks
  FOR SELECT
  TO authenticated
  USING (true);

-- Panchayats
ALTER TABLE IF EXISTS public.panchayats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access to all users for panchayats" ON public.panchayats;
DROP POLICY IF EXISTS "Authenticated users can select panchayats" ON public.panchayats;
CREATE POLICY "Authenticated users can select panchayats"
  ON public.panchayats
  FOR SELECT
  TO authenticated
  USING (true);
