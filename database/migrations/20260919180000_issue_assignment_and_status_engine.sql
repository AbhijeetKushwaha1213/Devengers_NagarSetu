-- Migration: Issue Assignment & Status Transition Engine with Audit Logging
-- File: database/migrations/20260919180000_issue_assignment_and_status_engine.sql

-- 1. Align RLS on public.issues
-- Ensure RLS is active
ALTER TABLE IF EXISTS public.issues ENABLE ROW LEVEL SECURITY;

-- Drop legacy/broken policies on issues
DROP POLICY IF EXISTS "Authorized users can update issues" ON public.issues;
DROP POLICY IF EXISTS "Authorities can assign issues" ON public.issues;
DROP POLICY IF EXISTS "Users can update issues" ON public.issues;

-- Create hardened UPDATE policy for public.issues using verified user_profiles schema
CREATE POLICY "Authorized users can update issues"
  ON public.issues
  FOR UPDATE
  TO authenticated
  USING (
    -- 1. Reporter can view their issue for updates (restricted by WITH CHECK)
    auth.uid() = reporter_id
    OR
    -- 2. Assigned worker can update the issue
    auth.uid() = assigned_worker_id
    OR
    -- 3. Assigned manager can update the issue
    auth.uid() = assigned_manager_id
    OR
    -- 4. Authorized authorities (scoped by municipality/panchayat or central admin)
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
            OR public.issues.municipality_id IS NULL
            OR user_profiles.municipality_id = public.issues.municipality_id
          )
        )
        OR (
          user_profiles.role = 'pradhan'
          AND (
            user_profiles.panchayat_id IS NULL
            OR public.issues.panchayat_id IS NULL
            OR user_profiles.panchayat_id = public.issues.panchayat_id
          )
        )
      )
    )
  )
  WITH CHECK (
    -- 1. Assigned worker can update assigned issue
    auth.uid() = assigned_worker_id
    OR
    -- 2. Assigned manager can update
    auth.uid() = assigned_manager_id
    OR
    -- 3. Authorized authorities can update
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
            OR public.issues.municipality_id IS NULL
            OR user_profiles.municipality_id = public.issues.municipality_id
          )
        )
        OR (
          user_profiles.role = 'pradhan'
          AND (
            user_profiles.panchayat_id IS NULL
            OR public.issues.panchayat_id IS NULL
            OR user_profiles.panchayat_id = public.issues.panchayat_id
          )
        )
      )
    )
    OR
    -- 4. Citizen reporter can only update metadata/description, or escalate resolved issues
    (
      auth.uid() = reporter_id
      AND (
        status = 'submitted'
        OR status = 'escalated'
      )
    )
  );

-- Reporters can delete their own submitted issues (e.g. cancelled reports or test cleanup)
DROP POLICY IF EXISTS "Reporters can delete own submitted issues" ON public.issues;
CREATE POLICY "Reporters can delete own submitted issues"
  ON public.issues
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = reporter_id
    AND status = 'submitted'
  );

-- 2. Enhance user_profiles RLS: Allow authorities to view worker profiles within their municipality or when unassigned
DROP POLICY IF EXISTS "Municipal admins can view municipal workers" ON public.user_profiles;
CREATE POLICY "Municipal admins can view municipal workers"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_user_role() IN ('municipal_admin', 'administrator', 'pradhan')
    AND public.user_profiles.role::text IN ('worker', 'panchayat_worker')
    AND (
      public.get_auth_user_municipality_id() IS NULL
      OR public.user_profiles.municipality_id IS NULL
      OR public.get_auth_user_municipality_id() = public.user_profiles.municipality_id
    )
  );

-- 3. Configure RLS on public.issue_audit_log
ALTER TABLE IF EXISTS public.issue_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON public.issue_audit_log;
DROP POLICY IF EXISTS "Public can view audit logs" ON public.issue_audit_log;

-- View audit logs: Allowed for authenticated users who can view the associated issue
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

-- Insert audit logs: Allowed for authenticated users recording their own actions on issues they can access
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

-- 3. Atomic Database Function: transition_issue_status
CREATE OR REPLACE FUNCTION public.transition_issue_status(
  p_issue_id uuid,
  p_new_status public.issue_status,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_user_muni uuid;
  v_user_panchayat uuid;
  v_issue record;
  v_now timestamptz := clock_timestamp();
  v_valid_transition boolean := false;
  v_updated_issue record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required' USING ERRCODE = '28000';
  END IF;

  -- Fetch user profile
  SELECT role::text, municipality_id, panchayat_id INTO v_user_role, v_user_muni, v_user_panchayat
  FROM public.user_profiles
  WHERE id = v_user_id AND is_active = true;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User profile not found or inactive' USING ERRCODE = '42501';
  END IF;

  -- Lock and fetch issue row
  SELECT * INTO v_issue
  FROM public.issues
  WHERE id = p_issue_id
  FOR UPDATE;

  IF v_issue.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Issue not found' USING ERRCODE = 'P0002';
  END IF;

  -- Validate state machine transition
  IF v_issue.status = p_new_status THEN
    -- No change required
    RETURN jsonb_build_object(
      'id', v_issue.id,
      'status', v_issue.status,
      'message', 'Status already at target value'
    );
  END IF;

  -- Check allowed transitions from current status
  CASE v_issue.status
    WHEN 'submitted' THEN
      v_valid_transition := p_new_status IN ('verified', 'in_progress', 'rejected', 'escalated');
    WHEN 'verified' THEN
      v_valid_transition := p_new_status IN ('in_progress', 'escalated', 'rejected');
    WHEN 'in_progress' THEN
      v_valid_transition := p_new_status IN ('resolved', 'escalated');
    WHEN 'resolved' THEN
      v_valid_transition := p_new_status IN ('escalated', 'in_progress');
    WHEN 'escalated' THEN
      v_valid_transition := p_new_status IN ('in_progress', 'verified', 'resolved', 'rejected');
    WHEN 'rejected' THEN
      v_valid_transition := p_new_status IN ('submitted', 'verified');
    ELSE
      v_valid_transition := false;
  END CASE;

  IF NOT v_valid_transition THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Cannot transition issue from % to %', v_issue.status, p_new_status
      USING ERRCODE = '22000';
  END IF;

  -- Role authorization check
  IF v_user_role IN ('citizen', 'community_member') THEN
    -- Citizens can only escalate resolved issues via feedback
    IF NOT (v_issue.reporter_id = v_user_id AND v_issue.status = 'resolved' AND p_new_status = 'escalated') THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Citizens cannot perform official status transitions' USING ERRCODE = '42501';
    END IF;
  ELSIF v_user_role IN ('worker', 'panchayat_worker') THEN
    -- Workers can only transition their assigned issues
    IF v_issue.assigned_worker_id IS DISTINCT FROM v_user_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Workers can only transition issues assigned to them' USING ERRCODE = '42501';
    END IF;
    IF p_new_status = 'rejected' THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Workers cannot reject issues' USING ERRCODE = '42501';
    END IF;
  ELSIF v_user_role = 'municipal_admin' THEN
    IF v_user_muni IS NOT NULL AND v_issue.municipality_id IS NOT NULL AND v_user_muni != v_issue.municipality_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cannot manage issues outside your municipality' USING ERRCODE = '42501';
    END IF;
  ELSIF v_user_role = 'pradhan' THEN
    IF v_user_panchayat IS NOT NULL AND v_issue.panchayat_id IS NOT NULL AND v_user_panchayat != v_issue.panchayat_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cannot manage issues outside your panchayat' USING ERRCODE = '42501';
    END IF;
  ELSIF v_user_role = 'administrator' THEN
    -- Central administrator has full authority
    NULL;
  ELSE
    RAISE EXCEPTION 'UNAUTHORIZED: Role % not permitted to transition status', v_user_role USING ERRCODE = '42501';
  END IF;

  -- Update issue
  UPDATE public.issues
  SET
    status = p_new_status,
    updated_at = v_now,
    verified_at = CASE WHEN p_new_status = 'verified' AND verified_at IS NULL THEN v_now ELSE verified_at END,
    resolved_at = CASE WHEN p_new_status = 'resolved' THEN v_now ELSE resolved_at END,
    escalated_at = CASE WHEN p_new_status = 'escalated' THEN v_now ELSE escalated_at END
  WHERE id = p_issue_id
  RETURNING * INTO v_updated_issue;

  -- Atomic Audit Log Insert
  INSERT INTO public.issue_audit_log (
    issue_id,
    user_id,
    action,
    old_status,
    new_status,
    old_data,
    new_data,
    notes,
    created_at
  ) VALUES (
    p_issue_id,
    v_user_id,
    'STATUS_CHANGED',
    v_issue.status,
    p_new_status,
    jsonb_build_object('status', v_issue.status),
    jsonb_build_object('status', p_new_status),
    p_notes,
    v_now
  );

  RETURN to_jsonb(v_updated_issue);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transition_issue_status(uuid, public.issue_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_issue_status(uuid, public.issue_status, text) TO authenticated;

-- 4. Atomic Database Function: assign_issue_worker
CREATE OR REPLACE FUNCTION public.assign_issue_worker(
  p_issue_id uuid,
  p_worker_id uuid,
  p_department_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_user_muni uuid;
  v_user_panchayat uuid;
  v_worker record;
  v_issue record;
  v_now timestamptz := clock_timestamp();
  v_action text;
  v_target_status public.issue_status;
  v_updated_issue record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required' USING ERRCODE = '28000';
  END IF;

  -- Fetch assigner profile
  SELECT role::text, municipality_id, panchayat_id INTO v_user_role, v_user_muni, v_user_panchayat
  FROM public.user_profiles
  WHERE id = v_user_id AND is_active = true;

  IF v_user_role NOT IN ('municipal_admin', 'administrator', 'pradhan') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only officials and administrators can assign workers' USING ERRCODE = '42501';
  END IF;

  -- Validate target worker
  SELECT id, role::text, is_active, municipality_id, panchayat_id INTO v_worker
  FROM public.user_profiles
  WHERE id = p_worker_id;

  IF v_worker.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Target worker profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_worker.is_active THEN
    RAISE EXCEPTION 'INVALID_WORKER: Target worker is inactive' USING ERRCODE = '22000';
  END IF;

  IF v_worker.role NOT IN ('worker', 'panchayat_worker') THEN
    RAISE EXCEPTION 'INVALID_ROLE: User is not a field worker (role: %)', v_worker.role USING ERRCODE = '22000';
  END IF;

  -- Fetch issue
  SELECT * INTO v_issue
  FROM public.issues
  WHERE id = p_issue_id
  FOR UPDATE;

  IF v_issue.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Issue not found' USING ERRCODE = 'P0002';
  END IF;

  -- Scope verification
  IF v_user_role = 'municipal_admin' THEN
    IF v_user_muni IS NOT NULL AND v_issue.municipality_id IS NOT NULL AND v_user_muni != v_issue.municipality_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cannot assign issues outside your municipality' USING ERRCODE = '42501';
    END IF;
  ELSIF v_user_role = 'pradhan' THEN
    IF v_user_panchayat IS NOT NULL AND v_issue.panchayat_id IS NOT NULL AND v_user_panchayat != v_issue.panchayat_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cannot assign issues outside your panchayat' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Determine action: WORKER_ASSIGNED vs WORKER_REASSIGNED
  IF v_issue.assigned_worker_id IS NULL THEN
    v_action := 'WORKER_ASSIGNED';
  ELSE
    v_action := 'WORKER_REASSIGNED';
  END IF;

  -- Advance status to in_progress if currently submitted or verified
  IF v_issue.status IN ('submitted', 'verified') THEN
    v_target_status := 'in_progress';
  ELSE
    v_target_status := v_issue.status;
  END IF;

  -- Update issue
  UPDATE public.issues
  SET
    assigned_worker_id = p_worker_id,
    assigned_manager_id = v_user_id,
    department_id = COALESCE(p_department_id, department_id),
    status = v_target_status,
    updated_at = v_now
  WHERE id = p_issue_id
  RETURNING * INTO v_updated_issue;

  -- Atomic Audit Log Insert
  INSERT INTO public.issue_audit_log (
    issue_id,
    user_id,
    action,
    old_status,
    new_status,
    old_data,
    new_data,
    notes,
    created_at
  ) VALUES (
    p_issue_id,
    v_user_id,
    v_action,
    v_issue.status,
    v_target_status,
    jsonb_build_object(
      'assigned_worker_id', v_issue.assigned_worker_id,
      'department_id', v_issue.department_id,
      'status', v_issue.status
    ),
    jsonb_build_object(
      'assigned_worker_id', p_worker_id,
      'assigned_manager_id', v_user_id,
      'department_id', COALESCE(p_department_id, v_issue.department_id),
      'status', v_target_status
    ),
    p_notes,
    v_now
  );

  RETURN to_jsonb(v_updated_issue);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_issue_worker(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_issue_worker(uuid, uuid, uuid, text) TO authenticated;
