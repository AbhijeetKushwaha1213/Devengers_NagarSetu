-- Add support for multiple images in issues table
-- Run this SQL in your Supabase SQL Editor

-- Add new column for storing multiple images as JSON array
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS images TEXT[];

-- Add comment to explain the column
COMMENT ON COLUMN issues.images IS 'Array of image URLs for the issue (supports multiple images)';

-- Migrate existing single images to array format (optional)
-- This will copy the existing 'image' column value into the 'images' array
UPDATE issues 
SET images = ARRAY[image]
WHERE image IS NOT NULL AND (images IS NULL OR array_length(images, 1) IS NULL);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_issues_images ON issues USING GIN (images);

-- Verify the changes
SELECT 
  id, 
  title, 
  image as single_image, 
  images as multiple_images,
  array_length(images, 1) as image_count
FROM issues 
LIMIT 5;

-- Example: How to query issues with multiple images
-- SELECT * FROM issues WHERE array_length(images, 1) > 1;

-- Example: How to insert issue with multiple images
-- INSERT INTO issues (title, description, location, category, images, created_by)
-- VALUES ('Test Issue', 'Description', 'Location', 'Infrastructure', 
--         ARRAY['url1', 'url2', 'url3'], 'user-id');
