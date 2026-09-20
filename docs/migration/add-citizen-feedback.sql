-- Migration: Add Citizen Feedback System
-- Adds fields for citizen satisfaction feedback on resolved issues

-- Add citizen feedback fields
ALTER TABLE issues 
  ADD COLUMN IF NOT EXISTS citizen_feedback VARCHAR(20) CHECK (citizen_feedback IN ('satisfied', 'not_satisfied'));

ALTER TABLE issues 
  ADD COLUMN IF NOT EXISTS citizen_feedback_comment TEXT;

ALTER TABLE issues 
  ADD COLUMN IF NOT EXISTS citizen_feedback_at TIMESTAMP WITH TIME ZONE;

-- Create index for feedback queries
CREATE INDEX IF NOT EXISTS idx_issues_citizen_feedback 
  ON issues(citizen_feedback) 
  WHERE citizen_feedback IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_issues_feedback_at 
  ON issues(citizen_feedback_at) 
  WHERE citizen_feedback_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN issues.citizen_feedback IS 'Citizen satisfaction rating: satisfied or not_satisfied';
COMMENT ON COLUMN issues.citizen_feedback_comment IS 'Citizen feedback comment explaining their rating';
COMMENT ON COLUMN issues.citizen_feedback_at IS 'Timestamp when citizen provided feedback';

-- Force schema refresh
NOTIFY pgrst, 'reload schema';

-- Verify columns were added
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'issues' 
AND column_name IN ('citizen_feedback', 'citizen_feedback_comment', 'citizen_feedback_at')
ORDER BY column_name;

-- Should return 3 rows
