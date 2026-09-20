-- Supabase Storage Setup for Issue Images
-- Run this in your Supabase SQL Editor to set up image storage

-- Create storage bucket for issue images
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-images', 'issue-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
CREATE POLICY "Anyone can view issue images" ON storage.objects
FOR SELECT USING (bucket_id = 'issue-images');

CREATE POLICY "Authenticated users can upload issue images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'issue-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own issue images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'issue-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own issue images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'issue-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add images column to issues table if it doesn't exist
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS images TEXT;

-- Add comment for documentation
COMMENT ON COLUMN issues.image IS 'Primary image URL for the issue';
COMMENT ON COLUMN issues.images IS 'JSON array of all image URLs for the issue';

-- Verify the setup
SELECT 
  id, 
  name, 
  public 
FROM storage.buckets 
WHERE id = 'issue-images';