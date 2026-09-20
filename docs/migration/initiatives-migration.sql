-- Migration to create initiatives table for community problem-solving
-- Run this in your Supabase SQL Editor

-- Create initiatives table in public schema
CREATE TABLE IF NOT EXISTS public.initiatives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  image TEXT,
  meeting_date DATE NOT NULL,
  meeting_time TIME NOT NULL,
  volunteers_needed INTEGER NOT NULL DEFAULT 5,
  volunteers_count INTEGER DEFAULT 0,
  organizer TEXT NOT NULL,
  organizer_avatar TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'completed')),
  volunteers TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for initiatives
ALTER TABLE public.initiatives ENABLE ROW LEVEL SECURITY;

-- Policies for initiatives
CREATE POLICY "Anyone can view initiatives" ON public.initiatives
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create initiatives" ON public.initiatives
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own initiatives" ON public.initiatives
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own initiatives" ON public.initiatives
  FOR DELETE USING (auth.uid() = created_by);

-- Allow users to update initiatives they've joined (for volunteer management)
CREATE POLICY "Users can join initiatives" ON public.initiatives
  FOR UPDATE USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_initiatives_status ON public.initiatives(status);
CREATE INDEX IF NOT EXISTS idx_initiatives_category ON public.initiatives(category);
CREATE INDEX IF NOT EXISTS idx_initiatives_meeting_date ON public.initiatives(meeting_date);
CREATE INDEX IF NOT EXISTS idx_initiatives_created_at ON public.initiatives(created_at DESC);

-- Function to join an initiative
CREATE OR REPLACE FUNCTION join_initiative(
  initiative_id UUID,
  user_id UUID
)
RETURNS void AS $$
BEGIN
  -- Check if user is already a volunteer
  IF EXISTS (
    SELECT 1 FROM public.initiatives 
    WHERE id = initiative_id 
    AND user_id::text = ANY(volunteers)
  ) THEN
    RAISE EXCEPTION 'User is already a volunteer for this initiative';
  END IF;
  
  -- Add user to volunteers array and increment count
  UPDATE public.initiatives 
  SET 
    volunteers = array_append(volunteers, user_id::text),
    volunteers_count = volunteers_count + 1,
    updated_at = NOW()
  WHERE id = initiative_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to leave an initiative
CREATE OR REPLACE FUNCTION leave_initiative(
  initiative_id UUID,
  user_id UUID
)
RETURNS void AS $$
BEGIN
  -- Remove user from volunteers array and decrement count
  UPDATE public.initiatives 
  SET 
    volunteers = array_remove(volunteers, user_id::text),
    volunteers_count = GREATEST(volunteers_count - 1, 0),
    updated_at = NOW()
  WHERE id = initiative_id
  AND user_id::text = ANY(volunteers);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove sample data insertion - will be handled by the application