-- SQL to enable signed URLs in Supabase storage
-- Run this in your Supabase SQL editor

-- 1. Make sure the media bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES ('media', 'media', true, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif'])
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

-- 2. Drop existing policies to recreate them
DROP POLICY IF EXISTS "Public read access to media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users media access" ON storage.objects;
DROP POLICY IF EXISTS "Media bucket access" ON storage.objects;
DROP POLICY IF EXISTS "Media bucket select" ON storage.objects;
DROP POLICY IF EXISTS "Media bucket insert" ON storage.objects;
DROP POLICY IF EXISTS "Media bucket update" ON storage.objects;
DROP POLICY IF EXISTS "Media bucket delete" ON storage.objects;

-- 3. Create a policy for anonymous read access (important for shared images)
CREATE POLICY "Public read access to media" ON storage.objects
FOR SELECT
USING (bucket_id = 'media');

-- 4. Create a policy for authenticated users to manage media
CREATE POLICY "Authenticated users media access" ON storage.objects
FOR ALL
USING (bucket_id = 'media' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

-- 5. Run this to check if the correct policies are in place
SELECT 
  policname,
  permissive,
  cmd,
  qual
FROM 
  pg_policies
WHERE 
  tablename = 'objects' 
  AND schemaname = 'storage';

-- 6. Run this to manually fix any Content-Type issues for existing objects
UPDATE storage.objects
SET metadata = jsonb_set(
  metadata,
  '{mimetype}',
  '"image/jpeg"'
)
WHERE bucket_id = 'media'
AND path LIKE '%.jpg';

-- 7. Make sure security settings allow for signed URLs
ALTER TABLE storage.buckets 
ADD COLUMN IF NOT EXISTS allow_signed_urls BOOLEAN DEFAULT TRUE;

UPDATE storage.buckets 
SET allow_signed_urls = TRUE
WHERE name = 'media';

-- 8. Check if signed URLs are enabled
SELECT 
  id, 
  name, 
  public, 
  allow_signed_urls
FROM 
  storage.buckets
WHERE 
  name = 'media'; 