-- ==============================================================================
-- Migration: Milestone 9.1 — Notification Database Foundation & RLS Hardening
-- File: database/migrations/20260920020000_harden_notifications_schema_and_rls.sql
-- Description:
--   1. Reconciles public.notifications canonical schema and foreign keys.
--   2. Enforces read_at TIMESTAMPTZ NULL semantics (NULL = unread, non-NULL = read).
--   3. Adds performance indexes for user lookups, unread counts, and chronological pagination.
--   4. Hardens Row-Level Security (RLS):
--      - Strict recipient-only SELECT (auth.uid() = user_id).
--      - Owner-only UPDATE with both USING and WITH CHECK guards.
--      - Prohibits direct client INSERT (no arbitrary client injection).
--   5. Creates anti-tampering trigger preventing client mutation of immutable notification fields.
--   6. Creates SECURITY DEFINER function public.mark_notification_read(p_notification_id UUID).
--   7. Creates SECURITY DEFINER function public.create_system_notification(...) with authority validation.
--   8. Idempotently ensures public.notifications is registered in supabase_realtime.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CANONICAL TABLE SCHEMA RECONCILIATION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES public.issues(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  channels TEXT[] DEFAULT ARRAY['in_app'::text],
  delivery_status JSONB DEFAULT '{"in_app": "delivered"}'::jsonb,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure all columns and defaults are in place if the table already existed
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS issue_id UUID REFERENCES public.issues(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS channels TEXT[] DEFAULT ARRAY['in_app'::text];
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS delivery_status JSONB DEFAULT '{"in_app": "delivered"}'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 2. QUERY PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
  ON public.notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON public.notifications (user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_issue_id 
  ON public.notifications (issue_id) 
  WHERE issue_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. ROW-LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Users can ONLY view their own notifications. No anonymous access.
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. UPDATE: Users can only update their own notifications.
-- USING and WITH CHECK prevent tampering with recipient ownership.
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. DELETE: Users can delete their own notifications; Administrators can delete for cleanup.
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('administrator', 'municipal_admin')
    )
  );

-- 4. INSERT: Explicitly remove any legacy permissive policies.
-- Direct client INSERT remains prohibited; system notifications must route through trusted backend/functions.
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

-- ------------------------------------------------------------------------------
-- 4. ANTI-TAMPERING UPDATE TRIGGER
-- ------------------------------------------------------------------------------
-- Prevents clients from mutating immutable columns (title, message, user_id, type, etc.)
-- Only read_at is permitted to change on an existing notification.
CREATE OR REPLACE FUNCTION public.prevent_notification_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.id != OLD.id THEN
    RAISE EXCEPTION 'Cannot modify notification id';
  END IF;

  IF NEW.user_id != OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify notification user_id';
  END IF;

  IF NEW.issue_id IS DISTINCT FROM OLD.issue_id THEN
    RAISE EXCEPTION 'Cannot modify notification issue_id';
  END IF;

  IF NEW.title != OLD.title THEN
    RAISE EXCEPTION 'Cannot modify notification title';
  END IF;

  IF NEW.message != OLD.message THEN
    RAISE EXCEPTION 'Cannot modify notification message';
  END IF;

  IF NEW.type != OLD.type THEN
    RAISE EXCEPTION 'Cannot modify notification type';
  END IF;

  IF NEW.channels IS DISTINCT FROM OLD.channels THEN
    RAISE EXCEPTION 'Cannot modify notification channels';
  END IF;

  IF NEW.delivery_status IS DISTINCT FROM OLD.delivery_status THEN
    RAISE EXCEPTION 'Cannot modify notification delivery_status';
  END IF;

  IF NEW.sent_at IS DISTINCT FROM OLD.sent_at THEN
    RAISE EXCEPTION 'Cannot modify notification sent_at';
  END IF;

  IF NEW.created_at != OLD.created_at THEN
    RAISE EXCEPTION 'Cannot modify notification created_at';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_notification_tampering ON public.notifications;
CREATE TRIGGER trigger_prevent_notification_tampering
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_notification_tampering();

-- ------------------------------------------------------------------------------
-- 5. MARK NOTIFICATION AS READ FUNCTION (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_notification RECORD;
  v_updated_at TIMESTAMP WITH TIME ZONE;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to mark notification as read';
  END IF;

  IF p_notification_id IS NULL THEN
    RAISE EXCEPTION 'Notification ID is required';
  END IF;

  -- Verify notification exists and caller is recipient
  SELECT * INTO v_notification
  FROM public.notifications
  WHERE id = p_notification_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found';
  END IF;

  IF v_notification.user_id != v_caller_id THEN
    RAISE EXCEPTION 'Permission denied: cannot mark another user''s notification as read';
  END IF;

  -- Idempotent: If already read, return existing timestamp
  IF v_notification.read_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'id', p_notification_id,
      'read_at', v_notification.read_at,
      'already_read', true
    );
  END IF;

  v_updated_at := NOW();

  UPDATE public.notifications
  SET read_at = v_updated_at
  WHERE id = p_notification_id
    AND user_id = v_caller_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', p_notification_id,
    'read_at', v_updated_at,
    'already_read', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_notification_read(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_notification_read(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO service_role;

-- ------------------------------------------------------------------------------
-- 6. SYSTEM NOTIFICATION CREATION FOUNDATION (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
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
  -- Ordinary citizens and community members are prohibited from arbitrary system notification injection.
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO v_caller_role FROM public.user_profiles WHERE id = auth.uid();
    IF v_caller_role IS NULL OR v_caller_role IN ('citizen', 'community_member') THEN
      RAISE EXCEPTION 'Permission denied: citizens cannot dispatch arbitrary system notifications';
    END IF;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    issue_id,
    title,
    message,
    type,
    channels,
    delivery_status,
    sent_at,
    created_at
  ) VALUES (
    p_user_id,
    p_issue_id,
    trim(p_title),
    trim(p_message),
    trim(p_type),
    COALESCE(p_channels, ARRAY['in_app'::text]),
    CASE 
      WHEN p_delivery_status IS NULL THEN '{"in_app": "delivered"}'::jsonb
      WHEN p_delivery_status ~ '^\s*[\{\[]' THEN p_delivery_status::jsonb
      ELSE to_jsonb(p_delivery_status)
    END,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_system_notification FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_system_notification FROM anon;
GRANT EXECUTE ON FUNCTION public.create_system_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_system_notification TO service_role;

-- ------------------------------------------------------------------------------
-- 7. REALTIME PUBLICATION REGISTRATION
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
