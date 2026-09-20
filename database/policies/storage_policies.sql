-- Storage bucket RLS policies for civic issue photos
-- Bucket: issue-images (Public, 5MB limit, JPEG/PNG/WebP/HEIC)

-- 1. Anyone can view/download uploaded issue images
DROP POLICY IF EXISTS "Public can view issue photos" ON storage.objects;
CREATE POLICY "Public can view issue photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'issue-images');

-- 2. Authenticated users can upload with strict path isolation
-- - Citizen report photos: path must be issues/{auth.uid()}/...
-- - Resolution photos: verified authority or assigned worker for the issue
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload issue photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload issue photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'issue-images'
    AND (
      -- 1. Citizen report photos: path must be issues/{auth.uid()}/...
      (
        (storage.foldername(name))[1] = 'issues'
        AND (storage.foldername(name))[2] = (auth.uid())::text
      )
      OR
      -- 2. Resolution photos: only authorized roles (municipal_admin, administrator, pradhan, worker, panchayat_worker)
      (
        (storage.foldername(name))[1] = 'resolutions'
        AND (
          -- Authority roles
          EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('municipal_admin', 'administrator', 'pradhan')
          )
          OR
          -- Field workers assigned to the specific issue
          EXISTS (
            SELECT 1 FROM public.issues
            WHERE public.issues.id::text = (storage.foldername(name))[2]
            AND (
              public.issues.assigned_worker_id = auth.uid()
              OR public.issues.assigned_manager_id = auth.uid()
            )
          )
        )
      )
    )
  );

-- 3. Users can only update their own photos (or municipal_admin/administrator)
DROP POLICY IF EXISTS "Authenticated users can update photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own issue photos" ON storage.objects;
CREATE POLICY "Users can update their own issue photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'issue-images'
    AND (
      auth.uid() = owner
      OR EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('municipal_admin', 'administrator')
      )
    )
  )
  WITH CHECK (bucket_id = 'issue-images');

-- 4. Users can only delete their own photos (or municipal_admin/administrator)
DROP POLICY IF EXISTS "Users can delete their own issue photos" ON storage.objects;
CREATE POLICY "Users can delete their own issue photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'issue-images'
    AND (
      auth.uid() = owner
      OR EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('municipal_admin', 'administrator')
      )
    )
  );
