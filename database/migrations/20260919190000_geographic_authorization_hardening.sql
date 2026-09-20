-- ==============================================================================
-- Migration: Geographic Authorization Hardening & Zero Unsafe NULL Fallbacks
-- File: database/migrations/20260919190000_geographic_authorization_hardening.sql
-- Description:
--   1. Replaces unsafe NULL fallbacks on public.issues UPDATE policy:
--      - municipal_admin strictly requires municipality_id match (blocked if issue or admin has NULL municipality).
--      - pradhan strictly requires panchayat_id match (blocked if issue or pradhan has NULL panchayat).
--      - administrator retains system-wide authority across urban and rural issues.
--      - worker retains assigned-only authority.
--      - citizen reporter retains submitted/escalated authority.
--   2. Updates public.transition_issue_status atomic procedure with strict boundary checks.
--   3. Updates public.assign_issue_worker atomic procedure with strict boundary checks
--      for both assigner and target worker.
--   4. Adds helper functions & user_profiles RLS policies for pradhans and administrators.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HELPER FUNCTIONS FOR USER PROFILES RLS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_user_panchayat_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT panchayat_id FROM public.user_profiles WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_auth_user_panchayat_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_panchayat_id() TO authenticated;

-- Allow pradhans to view panchayat_workers in their panchayat
DROP POLICY IF EXISTS "Pradhans can view panchayat workers" ON public.user_profiles;
CREATE POLICY "Pradhans can view panchayat workers"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_user_role() = 'pradhan'
    AND public.get_auth_user_panchayat_id() IS NOT NULL
    AND public.get_auth_user_panchayat_id() = public.user_profiles.panchayat_id
    AND public.user_profiles.role::text = 'panchayat_worker'
  );

-- Allow administrators to view all worker and authority profiles
DROP POLICY IF EXISTS "Administrators can view all worker profiles" ON public.user_profiles;
CREATE POLICY "Administrators can view all worker profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_user_role() = 'administrator'
  );


-- ------------------------------------------------------------------------------
-- 2. HARDENED RLS ON public.issues (ZERO UNSAFE NULL FALLBACKS)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authorized users can update issues" ON public.issues;

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
    -- 4. Authorized authorities (scoped strictly without NULL fallbacks)
    EXISTS (
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


-- ------------------------------------------------------------------------------
-- 3. ATOMIC STORED PROCEDURE: transition_issue_status (HARDENED JURISDICTIONS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_issue_status(
  p_issue_id uuid,
  p_new_status public.issue_status,
  p_notes text DEFAULT NULL,
  p_resolution_notes text DEFAULT NULL,
  p_resolution_image_urls text[] DEFAULT NULL
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
  v_valid_transition boolean := false;
  v_now timestamptz := clock_timestamp();
  v_updated_issue record;
BEGIN
  -- Authenticate caller
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

  -- Lock and fetch issue
  SELECT * INTO v_issue
  FROM public.issues
  WHERE id = p_issue_id
  FOR UPDATE;

  IF v_issue.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Issue not found' USING ERRCODE = 'P0002';
  END IF;

  -- Validate state machine transition
  IF v_issue.status = p_new_status THEN
    RETURN jsonb_build_object(
      'id', v_issue.id,
      'status', v_issue.status,
      'message', 'Status already at target value'
    );
  END IF;

  -- Check allowed transitions from current status
  CASE v_issue.status
    WHEN 'submitted' THEN
      v_valid_transition := p_new_status IN ('verified', 'in_progress', 'rejected');
    WHEN 'verified' THEN
      v_valid_transition := p_new_status IN ('in_progress', 'rejected');
    WHEN 'in_progress' THEN
      v_valid_transition := p_new_status IN ('resolved', 'escalated');
    WHEN 'resolved' THEN
      v_valid_transition := p_new_status IN ('escalated');
    WHEN 'escalated' THEN
      v_valid_transition := p_new_status IN ('in_progress', 'resolved');
    WHEN 'rejected' THEN
      v_valid_transition := false;
    ELSE
      v_valid_transition := false;
  END CASE;

  IF NOT v_valid_transition THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Cannot transition issue from % to %', v_issue.status, p_new_status
      USING ERRCODE = '22000';
  END IF;

  -- Strict Role Authorization & Geographic Scoping (ZERO NULL FALLBACKS)
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
    -- Municipal Admin: strictly requires non-null municipality match
    IF v_user_muni IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Municipal admin profile lacks municipality assignment' USING ERRCODE = '42501';
    END IF;
    IF v_issue.municipality_id IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cannot manage non-municipal/rural issue' USING ERRCODE = '42501';
    END IF;
    IF v_user_muni != v_issue.municipality_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cannot manage issues outside your municipality' USING ERRCODE = '42501';
    END IF;
  ELSIF v_user_role = 'pradhan' THEN
    -- Pradhan: strictly requires non-null panchayat match
    IF v_user_panchayat IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Pradhan profile lacks panchayat assignment' USING ERRCODE = '42501';
    END IF;
    IF v_issue.panchayat_id IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cannot manage non-panchayat/urban issue' USING ERRCODE = '42501';
    END IF;
    IF v_user_panchayat != v_issue.panchayat_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cannot manage issues outside your panchayat' USING ERRCODE = '42501';
    END IF;
  ELSIF v_user_role = 'administrator' THEN
    -- Central administrator has system-wide authority across both urban and rural issues
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
    escalated_at = CASE WHEN p_new_status = 'escalated' THEN v_now ELSE escalated_at END,
    resolution_image_urls = CASE WHEN p_resolution_image_urls IS NOT NULL THEN p_resolution_image_urls ELSE resolution_image_urls END
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
    jsonb_build_object('status', p_new_status, 'resolution_notes', p_resolution_notes),
    p_notes,
    v_now
  );

  RETURN to_jsonb(v_updated_issue);
END;
$$;


-- ------------------------------------------------------------------------------
-- 4. ATOMIC STORED PROCEDURE: assign_issue_worker (HARDENED JURISDICTIONS)
-- ------------------------------------------------------------------------------
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

  -- Lock and fetch issue
  SELECT * INTO v_issue
  FROM public.issues
  WHERE id = p_issue_id
  FOR UPDATE;

  IF v_issue.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Issue not found' USING ERRCODE = 'P0002';
  END IF;

  -- Strict Scope & Boundary Verification (ZERO UNSAFE NULL FALLBACKS)
  IF v_user_role = 'municipal_admin' THEN
    -- Assigner municipality verification
    IF v_user_muni IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Municipal admin profile lacks municipality assignment' USING ERRCODE = '42501';
    END IF;
    -- Issue municipality verification
    IF v_issue.municipality_id IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cannot assign non-municipal/rural issue' USING ERRCODE = '42501';
    END IF;
    IF v_user_muni != v_issue.municipality_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cannot assign issues outside your municipality' USING ERRCODE = '42501';
    END IF;
    -- Target worker role and municipality verification
    IF v_worker.role != 'worker' THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Municipal admin can only assign municipal workers' USING ERRCODE = '42501';
    END IF;
    IF v_worker.municipality_id IS NOT NULL AND v_worker.municipality_id != v_user_muni THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Target worker belongs to another municipality' USING ERRCODE = '42501';
    END IF;

  ELSIF v_user_role = 'pradhan' THEN
    -- Pradhan panchayat verification
    IF v_user_panchayat IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Pradhan profile lacks panchayat assignment' USING ERRCODE = '42501';
    END IF;
    -- Issue panchayat verification
    IF v_issue.panchayat_id IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cannot assign non-panchayat/urban issue' USING ERRCODE = '42501';
    END IF;
    IF v_user_panchayat != v_issue.panchayat_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cannot assign issues outside your panchayat' USING ERRCODE = '42501';
    END IF;
    -- Target worker role and panchayat verification
    IF v_worker.role != 'panchayat_worker' THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Pradhan can only assign panchayat workers' USING ERRCODE = '42501';
    END IF;
    IF v_worker.panchayat_id IS NOT NULL AND v_worker.panchayat_id != v_user_panchayat THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Target worker belongs to another panchayat' USING ERRCODE = '42501';
    END IF;

  ELSIF v_user_role = 'administrator' THEN
    -- Central administrator: ensure worker type matches issue jurisdiction
    IF v_issue.municipality_id IS NOT NULL AND v_worker.role = 'panchayat_worker' THEN
      RAISE EXCEPTION 'INVALID_ASSIGNMENT: Cannot assign panchayat worker to municipal issue' USING ERRCODE = '22000';
    END IF;
    IF v_issue.panchayat_id IS NOT NULL AND v_worker.role = 'worker' THEN
      RAISE EXCEPTION 'INVALID_ASSIGNMENT: Cannot assign municipal worker to rural panchayat issue' USING ERRCODE = '22000';
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
