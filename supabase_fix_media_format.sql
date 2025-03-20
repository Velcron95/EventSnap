-- SQL to update the storage bucket settings and fix MIME types
-- Run this in your Supabase SQL editor

-- 1. Ensure the media bucket is set to public
UPDATE storage.buckets 
SET public = true 
WHERE name = 'media';

-- 2. Clear all existing policies on storage.objects
DROP POLICY IF EXISTS "Media bucket access" ON storage.objects;
DROP POLICY IF EXISTS "Media bucket select" ON storage.objects;
DROP POLICY IF EXISTS "Media bucket insert" ON storage.objects;
DROP POLICY IF EXISTS "Media bucket update" ON storage.objects;
DROP POLICY IF EXISTS "Media bucket delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow all media bucket access" ON storage.objects;
DROP POLICY IF EXISTS "Public access to media images" ON storage.objects;
DROP POLICY IF EXISTS "Full media access for authenticated users" ON storage.objects;

-- 3. Create the most permissive policies possible for testing
-- This allows everyone to read from the bucket
CREATE POLICY "Public read access to media" ON storage.objects
FOR SELECT
USING (bucket_id = 'media');

-- This allows authenticated users to do anything with objects in the media bucket
CREATE POLICY "Authenticated users media access" ON storage.objects
FOR ALL
USING (bucket_id = 'media' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

-- 4. Ensure the CORS settings are properly configured
-- This needs to be done from the Supabase dashboard:
-- 1. Go to Storage -> Settings
-- 2. In the CORS section, add:
--    - Origin: *
--    - Methods: GET, POST, PUT, DELETE, OPTIONS
--    - Headers: *
--    - Expose Headers: *

-- 5. Update content types for existing objects (if necessary)
-- Skip this step if you don't see malformed URLs
UPDATE storage.objects
SET metadata = jsonb_set(
  metadata,
  '{mimetype}',
  '"image/jpeg"'
)
WHERE bucket_id = 'media'
AND metadata->>'mimetype' != 'image/jpeg'
AND (
  path LIKE '%.jpg'
  OR path LIKE '%.jpeg'
  OR path LIKE '%.JPG'
  OR path LIKE '%.JPEG'
);

-- 6. Make sure the media table has the right permissions
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Media access policy" ON public.media;
CREATE POLICY "Media access policy" ON public.media
FOR ALL USING (true);

-- 7. Query the storage objects to see what's actually there
SELECT 
  id, 
  name, 
  bucket_id, 
  owner, 
  metadata->>'mimetype' as content_type,
  created_at
FROM storage.objects
WHERE bucket_id = 'media'
ORDER BY created_at DESC
LIMIT 20; 