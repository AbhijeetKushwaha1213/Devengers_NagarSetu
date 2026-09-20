-- UrbanCare Database Setup Script
-- Run this in your Supabase SQL Editor

-- User Profiles Table
CREATE TABLE user_profiles (
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

-- Enable RLS for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Events Table
CREATE TABLE events (
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

-- Enable RLS for events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policies for events
CREATE POLICY "Anyone can view events" ON events
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create events" ON events
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own events" ON events
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own events" ON events
  FOR DELETE USING (auth.uid() = created_by);

-- Issues Table
CREATE TABLE issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  category TEXT,
  image TEXT,
  date TEXT,
  status TEXT DEFAULT 'reported',
  comments_count INTEGER DEFAULT 0,
  volunteers_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for issues
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- Policies for issues
CREATE POLICY "Anyone can view issues" ON issues
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create issues" ON issues
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own issues" ON issues
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own issues" ON issues
  FOR DELETE USING (auth.uid() = created_by);

-- Function to increment view count atomically
CREATE OR REPLACE FUNCTION increment_view_count(issue_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE issues 
  SET view_count = COALESCE(view_count, 0) + 1 
  WHERE id = issue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments Table (for future use)
CREATE TABLE issue_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for comments
ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;

-- Policies for comments
CREATE POLICY "Anyone can view comments" ON issue_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON issue_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own comments" ON issue_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON issue_comments
  FOR DELETE USING (auth.uid() = user_id);

-- User Upvotes Table (to track who upvoted what)
CREATE TABLE user_upvotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, issue_id)
);

-- Enable RLS for upvotes
ALTER TABLE user_upvotes ENABLE ROW LEVEL SECURITY;

-- Policies for upvotes
CREATE POLICY "Users can view own upvotes" ON user_upvotes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own upvotes" ON user_upvotes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own upvotes" ON user_upvotes
  FOR DELETE USING (auth.uid() = user_id);