-- Row Level Security (RLS) Policies for the public.issues and public.issue_audit_log tables

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- 1. Anyone (including anonymous users) can view public civic issues
DROP POLICY IF EXISTS "Anyone can view issues" ON public.issues;
CREATE POLICY "Anyone can view issues"
  ON public.issues
  FOR SELECT
  USING (true);

-- 2. Authenticated citizens can submit new issues
DROP POLICY IF EXISTS "Authenticated users can create issues" ON public.issues;
CREATE POLICY "Authenticated users can create issues"
  ON public.issues
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- 3. Issue reporters, assigned workers, or authorized authorities can update issues
DROP POLICY IF EXISTS "Authorized users can update issues" ON public.issues;
CREATE POLICY "Authorized users can update issues"
  ON public.issues
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = reporter_id
    OR auth.uid() = assigned_worker_id
    OR auth.uid() = assigned_manager_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_active = true
      AND (
        -- Central administrator: system-wide
        user_profiles.role = 'administrator'
        OR (
          -- Municipal admin: strictly requires matching non-null municipality_id
          user_profiles.role = 'municipal_admin'
          AND user_profiles.municipality_id IS NOT NULL
          AND public.issues.municipality_id IS NOT NULL
          AND user_profiles.municipality_id = public.issues.municipality_id
        )
        OR (
          -- Pradhan: strictly requires matching non-null panchayat_id
          user_profiles.role = 'pradhan'
          AND user_profiles.panchayat_id IS NOT NULL
          AND public.issues.panchayat_id IS NOT NULL
          AND user_profiles.panchayat_id = public.issues.panchayat_id
        )
      )
    )
  )
  WITH CHECK (
    auth.uid() = assigned_worker_id
    OR auth.uid() = assigned_manager_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_active = true
      AND (
        -- Central administrator: system-wide
        user_profiles.role = 'administrator'
        OR (
          -- Municipal admin: strictly requires matching non-null municipality_id
          user_profiles.role = 'municipal_admin'
          AND user_profiles.municipality_id IS NOT NULL
          AND public.issues.municipality_id IS NOT NULL
          AND user_profiles.municipality_id = public.issues.municipality_id
        )
        OR (
          -- Pradhan: strictly requires matching non-null panchayat_id
          user_profiles.role = 'pradhan'
          AND user_profiles.panchayat_id IS NOT NULL
          AND public.issues.panchayat_id IS NOT NULL
          AND user_profiles.panchayat_id = public.issues.panchayat_id
        )
      )
    )
    OR (
      auth.uid() = reporter_id
      AND (
        status = 'submitted'
        OR status = 'escalated'
      )
    )
  );

-- 4. Reporters can delete their own submitted issues (e.g. cancelled reports or test cleanup)
DROP POLICY IF EXISTS "Reporters can delete own submitted issues" ON public.issues;
CREATE POLICY "Reporters can delete own submitted issues"
  ON public.issues
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = reporter_id
    AND status = 'submitted'
  );

GRANT DELETE ON public.issues TO authenticated;

-- 5. RLS Policies for public.issue_audit_log
ALTER TABLE public.issue_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON public.issue_audit_log;
CREATE POLICY "Authenticated users can view audit logs"
  ON public.issue_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.issues
      WHERE issues.id = issue_audit_log.issue_id
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.issue_audit_log;
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.issue_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.issues
      WHERE issues.id = issue_audit_log.issue_id
    )
  );
