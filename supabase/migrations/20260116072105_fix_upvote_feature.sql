-- ============================================
-- FIX: Upvote Feature
-- Run this script in Supabase SQL Editor
-- ============================================

-- This fixes the upvote feature to use proper database tracking
-- instead of localStorage

-- 1. Ensure user_upvotes table exists with correct structure
CREATE TABLE IF NOT EXISTS user_upvotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, issue_id)
);

-- 2. Add upvotes_count column to issues if it doesn't exist
ALTER TABLE issues 
  ADD COLUMN IF NOT EXISTS upvotes_count INTEGER DEFAULT 0;

-- 3. Enable RLS on user_upvotes
ALTER TABLE user_upvotes ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own upvotes" ON user_upvotes;
DROP POLICY IF EXISTS "Users can create own upvotes" ON user_upvotes;
DROP POLICY IF EXISTS "Users can delete own upvotes" ON user_upvotes;
DROP POLICY IF EXISTS "Anyone can view upvote counts" ON user_upvotes;
DROP POLICY IF EXISTS "Authenticated users can upvote" ON user_upvotes;
DROP POLICY IF EXISTS "Authenticated users can remove upvote" ON user_upvotes;

-- 5. Create new policies for user_upvotes
-- Allow users to view all upvotes (to check if they've upvoted)
CREATE POLICY "Anyone can view upvotes"
  ON user_upvotes FOR SELECT
  USING (true);

-- Allow authenticated users to create upvotes
CREATE POLICY "Authenticated users can upvote"
  ON user_upvotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own upvotes
CREATE POLICY "Users can remove own upvotes"
  ON user_upvotes FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Create function to handle upvote (atomic operation)
CREATE OR REPLACE FUNCTION toggle_upvote(p_issue_id UUID, p_user_id UUID)
RETURNS TABLE(upvoted BOOLEAN, new_count INTEGER) AS $$
DECLARE
  v_exists BOOLEAN;
  v_count INTEGER;
BEGIN
  -- Check if upvote exists
  SELECT EXISTS(
    SELECT 1 FROM user_upvotes 
    WHERE issue_id = p_issue_id AND user_id = p_user_id
  ) INTO v_exists;

  IF v_exists THEN
    -- Remove upvote
    DELETE FROM user_upvotes 
    WHERE issue_id = p_issue_id AND user_id = p_user_id;
    
    -- Decrement count
    UPDATE issues 
    SET upvotes_count = GREATEST(0, COALESCE(upvotes_count, 0) - 1)
    WHERE id = p_issue_id
    RETURNING upvotes_count INTO v_count;
    
    RETURN QUERY SELECT FALSE, v_count;
  ELSE
    -- Add upvote
    INSERT INTO user_upvotes (issue_id, user_id)
    VALUES (p_issue_id, p_user_id);
    
    -- Increment count
    UPDATE issues 
    SET upvotes_count = COALESCE(upvotes_count, 0) + 1
    WHERE id = p_issue_id
    RETURNING upvotes_count INTO v_count;
    
    RETURN QUERY SELECT TRUE, v_count;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create function to get upvote status for a user
CREATE OR REPLACE FUNCTION get_user_upvote_status(p_issue_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM user_upvotes 
    WHERE issue_id = p_issue_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Migrate existing volunteers_count to upvotes_count
UPDATE issues 
SET upvotes_count = COALESCE(volunteers_count, 0)
WHERE upvotes_count IS NULL OR upvotes_count = 0;

-- 9. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_upvotes_user_id ON user_upvotes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_upvotes_issue_id ON user_upvotes(issue_id);
CREATE INDEX IF NOT EXISTS idx_user_upvotes_user_issue ON user_upvotes(user_id, issue_id);
CREATE INDEX IF NOT EXISTS idx_issues_upvotes_count ON issues(upvotes_count);

-- 10. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, DELETE ON user_upvotes TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_upvote(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_upvote_status(UUID, UUID) TO authenticated, anon;

-- 11. Create a view for issue upvote counts (optional, for analytics)
CREATE OR REPLACE VIEW issue_upvote_stats AS
SELECT 
  i.id as issue_id,
  i.title,
  i.upvotes_count,
  COUNT(u.id) as actual_upvote_count,
  ARRAY_AGG(u.user_id) FILTER (WHERE u.user_id IS NOT NULL) as upvoters
FROM issues i
LEFT JOIN user_upvotes u ON i.id = u.issue_id
GROUP BY i.id, i.title, i.upvotes_count;

GRANT SELECT ON issue_upvote_stats TO authenticated;

-- 12. Verify the setup
SELECT 
  'user_upvotes' as table_name,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'user_upvotes'
UNION ALL
SELECT 
  'functions' as table_name,
  COUNT(*) as count
FROM pg_proc 
WHERE proname IN ('toggle_upvote', 'get_user_upvote_status');

-- ============================================
-- ✅ VERIFICATION COMPLETE
-- ============================================
-- 
-- The upvote system is now properly configured with:
-- ✓ user_upvotes table for tracking
-- ✓ upvotes_count column on issues
-- ✓ Atomic toggle_upvote function
-- ✓ RLS policies for security
-- ✓ Performance indexes
-- 
-- Next steps:
-- 1. Update frontend code to use the new functions
-- 2. Remove localStorage-based upvote tracking
-- 3. Test upvote functionality
-- 
-- ============================================
