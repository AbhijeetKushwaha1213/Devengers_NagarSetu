-- Migration to add missing columns and authority permissions for issues table

-- Add missing columns to issues table
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS department TEXT;

-- Add user_type and department columns to user_profiles if they don't exist
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'citizen',
ADD COLUMN IF NOT EXISTS department TEXT;

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_issues_updated_at ON issues;
CREATE TRIGGER update_issues_updated_at
    BEFORE UPDATE ON issues
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for authorities to manage issues
CREATE POLICY "Authorities can update any issue status" ON issues
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.user_type = 'authority'
    )
  );

CREATE POLICY "Authorities can view all issues" ON issues
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.user_type = 'authority'
    )
  );

-- Grant necessary permissions
GRANT SELECT, UPDATE ON issues TO authenticated;
GRANT SELECT ON user_profiles TO authenticated;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_type ON user_profiles(user_type);