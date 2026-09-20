-- COMPLETE DATABASE SETUP FOR CIVIC CONNECT (WITH IMAGES SUPPORT)
-- Run this ENTIRE script in Supabase SQL Editor
-- This creates all tables with all required columns including images array

-- ============================================================================
-- 1. USER PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  age INTEGER,
  gender TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  role TEXT,
  bio TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_onboarding_complete BOOLEAN DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Create policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 2. ISSUES TABLE (with coordinates AND images array!)
-- ============================================================================

CREATE TABLE IF NOT EXISTS issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  category TEXT,
  image TEXT,
  images TEXT[],
  after_image TEXT,
  date TEXT,
  status TEXT DEFAULT 'reported',
  comments_count INTEGER DEFAULT 0,
  volunteers_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID,
  department TEXT,
  citizen_feedback TEXT,
  citizen_feedback_comment TEXT,
  citizen_feedback_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_created_by ON issues(created_by);
CREATE INDEX IF NOT EXISTS idx_issues_coordinates ON issues(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_issues_department ON issues(department);
CREATE INDEX IF NOT EXISTS idx_issues_images ON issues USING GIN (images);

-- Enable RLS
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view issues" ON issues;
DROP POLICY IF EXISTS "public_read_issues" ON issues;
DROP POLICY IF EXISTS "Authenticated users can create issues" ON issues;
DROP POLICY IF EXISTS "Users can update own issues" ON issues;
DROP POLICY IF EXISTS "Users can delete own issues" ON issues;

-- Create policies
CREATE POLICY "public_read_issues" ON issues
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Authenticated users can create issues" ON issues
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own issues" ON issues
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own issues" ON issues
  FOR DELETE USING (auth.uid() = created_by);

-- ============================================================================
-- 3. EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  date TEXT,
  time TEXT,
  status TEXT DEFAULT 'Upcoming',
  time_remaining TEXT,
  categories TEXT[] DEFAULT '{}',
  volunteers_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view events" ON events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
DROP POLICY IF EXISTS "Users can update own events" ON events;
DROP POLICY IF EXISTS "Users can delete own events" ON events;

-- Create policies
CREATE POLICY "Anyone can view events" ON events
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create events" ON events
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own events" ON events
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own events" ON events
  FOR DELETE USING (auth.uid() = created_by);

-- ============================================================================
-- 4. COMMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS issue_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view comments" ON issue_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON issue_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON issue_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON issue_comments;

-- Create policies
CREATE POLICY "Anyone can view comments" ON issue_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON issue_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own comments" ON issue_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON issue_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 5. UPVOTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_upvotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, issue_id)
);

-- Enable RLS
ALTER TABLE user_upvotes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own upvotes" ON user_upvotes;
DROP POLICY IF EXISTS "Users can create own upvotes" ON user_upvotes;
DROP POLICY IF EXISTS "Users can delete own upvotes" ON user_upvotes;

-- Create policies
CREATE POLICY "Users can view own upvotes" ON user_upvotes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own upvotes" ON user_upvotes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own upvotes" ON user_upvotes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 6. NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT,
  type TEXT,
  read BOOLEAN DEFAULT FALSE,
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

-- Create policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- 7. FUNCTIONS
-- ============================================================================

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_view_count(issue_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE issues 
  SET view_count = COALESCE(view_count, 0) + 1 
  WHERE id = issue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. VERIFY SETUP
-- ============================================================================

-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_profiles', 'issues', 'events', 'issue_comments', 'user_upvotes', 'notifications')
ORDER BY table_name;

-- Check issues table has all required columns including images
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'issues' 
ORDER BY column_name;

-- ============================================================================
-- ✅ SETUP COMPLETE!
-- ============================================================================
-- 
-- Your database is now ready with:
-- ✓ All tables created
-- ✓ Images array column (images TEXT[])
-- ✓ Single image column (image TEXT) for backward compatibility
-- ✓ Coordinates columns (latitude, longitude)
-- ✓ After image column
-- ✓ Citizen feedback columns
-- ✓ Department tracking
-- ✓ Notifications system
-- ✓ Proper RLS policies
-- ✓ Public read access
-- ✓ Performance indexes including GIN index for images array
-- 
-- Next steps:
-- 1. Refresh your app
-- 2. Try uploading multiple images - it should work now!
-- 3. Swipe through images on the Issues page
-- 
-- ============================================================================
