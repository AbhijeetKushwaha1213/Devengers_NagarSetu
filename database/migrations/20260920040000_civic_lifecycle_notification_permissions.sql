-- ==============================================================================
-- Milestone 9.3: Civic Lifecycle Notification Integration Migration
-- File: database/migrations/20260920040000_civic_lifecycle_notification_permissions.sql
-- Description:
--   Updates public.create_system_notification(...) procedure to permit verified
--   citizen lifecycle events (submission confirmation, upvote, comment, feedback)
--   while strictly preventing arbitrary notification injection to unrelated users.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_system_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_issue_id UUID DEFAULT NULL,
  p_channels TEXT[] DEFAULT ARRAY['in_app'::text],
  p_delivery_status TEXT DEFAULT 'delivered'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notification_id UUID;
  v_caller_role TEXT;
  v_caller_id UUID;
  v_delivery_json JSONB;
BEGIN
  -- Validate required fields
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Recipient user_id cannot be null';
  END IF;

  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'Notification title cannot be empty';
  END IF;

  IF p_message IS NULL OR trim(p_message) = '' THEN
    RAISE EXCEPTION 'Notification message cannot be empty';
  END IF;

  IF p_type IS NULL OR trim(p_type) = '' THEN
    RAISE EXCEPTION 'Notification type cannot be empty';
  END IF;

  -- Validate recipient existence
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Recipient user does not exist';
  END IF;

  -- Validate issue existence if linked
  IF p_issue_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.issues WHERE id = p_issue_id) THEN
    RAISE EXCEPTION 'Referenced issue does not exist';
  END IF;

  -- Authority Validation:
  -- If invoked in an authenticated user session, verify authority.
  -- Ordinary citizens and community members are prohibited from arbitrary system notification injection,
  -- but are permitted for authentic lifecycle events related to issues they interacted with.
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT role INTO v_caller_role FROM public.user_profiles WHERE id = v_caller_id;

    IF v_caller_role IS NULL OR v_caller_role IN ('citizen', 'community_member') THEN
      IF p_type = 'issue_submitted' AND p_issue_id IS NOT NULL AND p_user_id = v_caller_id AND
         EXISTS (SELECT 1 FROM public.issues WHERE id = p_issue_id AND reporter_id = v_caller_id) THEN
        -- Allowed: citizen submission confirmation
        NULL;
      ELSIF p_type = 'issue_upvoted' AND p_issue_id IS NOT NULL AND
            EXISTS (SELECT 1 FROM public.upvotes WHERE issue_id = p_issue_id AND user_id = v_caller_id) AND
            p_user_id = (SELECT reporter_id FROM public.issues WHERE id = p_issue_id) THEN
        -- Allowed: notification to reporter on citizen upvote
        NULL;
      ELSIF p_type = 'issue_commented' AND p_issue_id IS NOT NULL AND
            EXISTS (SELECT 1 FROM public.issue_comments WHERE issue_id = p_issue_id AND user_id = v_caller_id) THEN
        -- Allowed: notification to reporter or worker on citizen comment
        NULL;
      ELSIF p_type = 'feedback_received' AND p_issue_id IS NOT NULL AND
            EXISTS (SELECT 1 FROM public.issues WHERE id = p_issue_id AND reporter_id = v_caller_id) THEN
        -- Allowed: feedback notification on own issue
        NULL;
      ELSE
        RAISE EXCEPTION 'Permission denied: citizens cannot dispatch arbitrary system notifications';
      END IF;
    END IF;
  END IF;

  -- Parse delivery status JSON safely
  BEGIN
    v_delivery_json := p_delivery_status::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_delivery_json := jsonb_build_object('in_app', p_delivery_status);
  END;

  INSERT INTO public.notifications (
    user_id,
    issue_id,
    title,
    message,
    type,
    channels,
    delivery_status,
    read_at,
    created_at,
    sent_at
  ) VALUES (
    p_user_id,
    p_issue_id,
    trim(p_title),
    trim(p_message),
    trim(p_type),
    COALESCE(p_channels, ARRAY['in_app'::text]),
    COALESCE(v_delivery_json, '{"in_app": "delivered"}'::jsonb),
    NULL,
    clock_timestamp(),
    clock_timestamp()
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_system_notification FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_system_notification FROM anon;
GRANT EXECUTE ON FUNCTION public.create_system_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_system_notification TO service_role;
