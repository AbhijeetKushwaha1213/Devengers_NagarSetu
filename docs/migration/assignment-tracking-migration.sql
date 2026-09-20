-- Migration to add assignment tracking columns to issues table

-- Add assignment tracking columns
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS assignment_notes TEXT,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;

-- Update the existing assigned_to and department columns if they don't exist
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS department TEXT;

-- Create index for better performance on assignment queries
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_department ON issues(department);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_at ON issues(assigned_at);

-- Add RLS policy for assignment operations
CREATE POLICY "Authorities can assign issues" ON issues
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.user_type = 'authority'
    )
  );

-- Create a function to automatically update assignment timestamp
CREATE OR REPLACE FUNCTION update_assignment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- If assigned_to is being set and wasn't set before, update assigned_at
    IF NEW.assigned_to IS NOT NULL AND OLD.assigned_to IS NULL THEN
        NEW.assigned_at = NOW();
    END IF;
    
    -- If assigned_to is being cleared, clear assigned_at too
    IF NEW.assigned_to IS NULL AND OLD.assigned_to IS NOT NULL THEN
        NEW.assigned_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for assignment timestamp
DROP TRIGGER IF EXISTS trigger_assignment_timestamp ON issues;
CREATE TRIGGER trigger_assignment_timestamp
    BEFORE UPDATE ON issues
    FOR EACH ROW
    EXECUTE FUNCTION update_assignment_timestamp();

-- Grant necessary permissions
GRANT SELECT, UPDATE ON issues TO authenticated;

-- Create view for assignment statistics
CREATE OR REPLACE VIEW assignment_stats AS
SELECT 
    department,
    COUNT(*) as total_assigned,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
    COUNT(CASE WHEN status = 'in-progress' THEN 1 END) as in_progress_count,
    AVG(EXTRACT(EPOCH FROM (COALESCE(updated_at, NOW()) - assigned_at))/86400) as avg_resolution_days
FROM issues 
WHERE assigned_to IS NOT NULL 
GROUP BY department;

-- Grant access to the view
GRANT SELECT ON assignment_stats TO authenticated;