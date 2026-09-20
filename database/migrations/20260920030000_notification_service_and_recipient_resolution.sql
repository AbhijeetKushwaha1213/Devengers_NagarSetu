-- ==============================================================================
-- Milestone 9.2: Notification Service & Recipient Resolution Migration
-- File: database/migrations/20260920030000_notification_service_and_recipient_resolution.sql
-- Description:
--   1. Adds public.mark_all_notifications_read() RPC for atomic bulk read updates.
--   2. Adds public.resolve_notification_recipients(...) RPC for secure, authoritative
--      geographic & jurisdiction-isolated recipient determination.
--   3. Maintains strict least privilege: REVOKE from PUBLIC/anon, GRANT to authenticated/service_role.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ATOMIC BULK MARK ALL READ FUNCTION (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_updated_count INT;
  v_updated_at TIMESTAMP WITH TIME ZONE;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to mark notifications as read';
  END IF;

  v_updated_at := NOW();

  UPDATE public.notifications
  SET read_at = v_updated_at
  WHERE user_id = v_caller_id
    AND read_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'read_at', v_updated_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO service_role;

-- ------------------------------------------------------------------------------
-- 2. RECIPIENT RESOLUTION PROCEDURE (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_notification_recipients(
  p_issue_id UUID,
  p_event_type TEXT,
  p_actor_id UUID DEFAULT NULL
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_issue RECORD;
  v_recipients UUID[] := ARRAY[]::UUID[];
  v_user RECORD;
  v_normalized_type TEXT;
BEGIN
  IF p_issue_id IS NULL THEN
    RAISE EXCEPTION 'Issue ID is required for recipient resolution';
  END IF;

  IF p_event_type IS NULL OR trim(p_event_type) = '' THEN
    RAISE EXCEPTION 'Event type is required for recipient resolution';
  END IF;

  v_normalized_type := trim(p_event_type);

  -- Fetch issue jurisdiction and assignment details
  SELECT id, reporter_id, assigned_worker_id, municipality_id, panchayat_id, status
  INTO v_issue
  FROM public.issues
  WHERE id = p_issue_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced issue does not exist';
  END IF;

  -- 1. CITIZEN / REPORTER CANDIDACY
  -- Reporter receives lifecycle updates, upvote/comment notifications
  IF v_issue.reporter_id IS NOT NULL AND v_normalized_type IN (
    'issue_submitted',
    'issue_verified',
    'issue_assigned',
    'issue_reassigned',
    'issue_in_progress',
    'issue_resolved',
    'issue_rejected',
    'issue_escalated',
    'issue_upvoted',
    'issue_commented',
    'system'
  ) THEN
    -- Verify reporter account exists and is active
    IF EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = v_issue.reporter_id
      AND (is_active IS NULL OR is_active = true)
    ) THEN
      v_recipients := array_append(v_recipients, v_issue.reporter_id);
    END IF;
  END IF;

  -- 2. ASSIGNED WORKER CANDIDACY
  -- Assigned worker receives assignment, progress, resolution, escalation, feedback, comment events
  IF v_issue.assigned_worker_id IS NOT NULL AND v_normalized_type IN (
    'issue_assigned',
    'issue_reassigned',
    'issue_in_progress',
    'issue_resolved',
    'issue_rejected',
    'issue_escalated',
    'feedback_received',
    'issue_commented',
    'system'
  ) THEN
    -- Verify worker account exists and is active
    IF EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = v_issue.assigned_worker_id
      AND (is_active IS NULL OR is_active = true)
    ) THEN
      v_recipients := array_append(v_recipients, v_issue.assigned_worker_id);
    END IF;
  END IF;

  -- 3. MUNICIPAL AUTHORITIES (Urban Issues Only)
  IF v_issue.municipality_id IS NOT NULL AND v_normalized_type IN (
    'issue_submitted',
    'issue_escalated',
    'feedback_received',
    'issue_rejected',
    'system'
  ) THEN
    -- Select municipal admins in the same municipality
    FOR v_user IN
      SELECT id FROM public.user_profiles
      WHERE role = 'municipal_admin'
      AND municipality_id = v_issue.municipality_id
      AND (is_active IS NULL OR is_active = true)
    LOOP
      v_recipients := array_append(v_recipients, v_user.id);
    END LOOP;
  END IF;

  -- 4. PANCHAYAT AUTHORITIES (Rural Issues Only)
  IF v_issue.panchayat_id IS NOT NULL AND v_normalized_type IN (
    'issue_submitted',
    'issue_escalated',
    'feedback_received',
    'system'
  ) THEN
    -- Select pradhan & panchayat workers in the same panchayat
    FOR v_user IN
      SELECT id FROM public.user_profiles
      WHERE role IN ('pradhan', 'panchayat_worker')
      AND panchayat_id = v_issue.panchayat_id
      AND (is_active IS NULL OR is_active = true)
    LOOP
      v_recipients := array_append(v_recipients, v_user.id);
    END LOOP;
  END IF;

  -- 5. CENTRAL ADMINISTRATORS (System-wide Oversight)
  IF v_normalized_type IN ('issue_escalated', 'system') THEN
    FOR v_user IN
      SELECT id FROM public.user_profiles
      WHERE role = 'administrator'
      AND (is_active IS NULL OR is_active = true)
    LOOP
      v_recipients := array_append(v_recipients, v_user.id);
    END LOOP;
  END IF;

  -- 6. ACTOR EXCLUSION & DEDUPLICATION
  RETURN ARRAY(
    SELECT DISTINCT r
    FROM unnest(v_recipients) AS r
    WHERE (p_actor_id IS NULL OR r != p_actor_id OR (v_normalized_type = 'issue_submitted' AND r = v_issue.reporter_id))
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_notification_recipients(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_notification_recipients(UUID, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_notification_recipients(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_notification_recipients(UUID, TEXT, UUID) TO service_role;
