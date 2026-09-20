-- Migration: Department Official Portal
-- This adds support for department officials with their own portal

-- 1. Update user_profiles to support 'official' user type
ALTER TABLE user_profiles 
  DROP CONSTRAINT IF EXISTS user_profiles_user_type_check;

ALTER TABLE user_profiles 
  ADD CONSTRAINT user_profiles_user_type_check 
  CHECK (user_type IN ('citizen', 'authority', 'official'));

-- 2. Add employee_id field for officials
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE;

-- 3. Add department field if not exists
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- 4. Add internal_notes table for officials to add notes to issues
CREATE TABLE IF NOT EXISTS issue_internal_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  official_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Add after_image field to issues table for resolution proof
ALTER TABLE issues 
  ADD COLUMN IF NOT EXISTS after_image TEXT;

-- 6. Add completed_at timestamp for tracking when work was finished
ALTER TABLE issues 
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- 7. Add show_in_gallery flag for success stories
ALTER TABLE issues 
  ADD COLUMN IF NOT EXISTS show_in_gallery BOOLEAN DEFAULT FALSE;

-- 8. Update issue status to include 'pending_approval'
ALTER TABLE issues 
  DROP CONSTRAINT IF EXISTS issues_status_check;

ALTER TABLE issues 
  ADD CONSTRAINT issues_status_check 
  CHECK (status IN ('reported', 'assigned', 'in_progress', 'pending_approval', 'resolved', 'closed'));

-- 9. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_department ON issues(department);
CREATE INDEX IF NOT EXISTS idx_issues_show_in_gallery ON issues(show_in_gallery);
CREATE INDEX IF NOT EXISTS idx_internal_notes_issue ON issue_internal_notes(issue_id);

-- 10. Add RLS policies for officials
ALTER TABLE issue_internal_notes ENABLE ROW LEVEL SECURITY;

-- Officials can view notes for issues assigned to them
CREATE POLICY "Officials can view internal notes for their issues"
  ON issue_internal_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM issues 
      WHERE issues.id = issue_internal_notes.issue_id 
      AND issues.assigned_to = auth.uid()
    )
  );

-- Officials can create notes for issues assigned to them
CREATE POLICY "Officials can create internal notes for their issues"
  ON issue_internal_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM issues 
      WHERE issues.id = issue_internal_notes.issue_id 
      AND issues.assigned_to = auth.uid()
    )
  );

-- Authorities can view all internal notes
CREATE POLICY "Authorities can view all internal notes"
  ON issue_internal_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.user_type = 'authority'
    )
  );

-- 11. Update issues RLS policies for officials
-- Officials can view issues assigned to them
CREATE POLICY "Officials can view assigned issues"
  ON issues FOR SELECT
  USING (assigned_to = auth.uid());

-- Officials can update issues assigned to them
CREATE POLICY "Officials can update assigned issues"
  ON issues FOR UPDATE
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- 12. Create a view for official dashboard stats
CREATE OR REPLACE VIEW official_dashboard_stats AS
SELECT 
  assigned_to as official_id,
  COUNT(*) FILTER (WHERE status = 'assigned') as new_assigned,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
  COUNT(*) FILTER (WHERE status = 'pending_approval') as pending_approval,
  COUNT(*) FILTER (WHERE urgency = 'critical') as critical_count,
  COUNT(*) as total_assigned
FROM issues
WHERE assigned_to IS NOT NULL
GROUP BY assigned_to;

-- Grant access to the view
GRANT SELECT ON official_dashboard_stats TO authenticated;

COMMENT ON TABLE issue_internal_notes IS 'Internal notes added by department officials for issue tracking';
COMMENT ON COLUMN issues.after_image IS 'Photo uploaded by official after resolving the issue';
COMMENT ON COLUMN issues.completed_at IS 'Timestamp when the official marked the issue as resolved';
COMMENT ON COLUMN issues.show_in_gallery IS 'Flag to show this issue in the public success stories gallery';
