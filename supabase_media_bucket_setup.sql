-- SQL commands to properly set up the media bucket in Supabase
-- Run these in the Supabase SQL editor

-- 1. Create the media bucket with public access if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', true, 52428800, NULL) -- 50MB limit
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 52428800;

-- 2. Update RLS policies for the media bucket to ensure proper access
-- First, remove any existing policies that might be too restrictive
DROP POLICY IF EXISTS "Media bucket access" ON storage.objects;
DROP POLICY IF EXISTS "Media bucket select" ON storage.objects;
DROP POLICY IF EXISTS "Media bucket insert" ON storage.objects;
DROP POLICY IF EXISTS "Media bucket update" ON storage.objects;
DROP POLICY IF EXISTS "Media bucket delete" ON storage.objects;

-- 3. Create a policy that allows all operations on the media bucket for authenticated users
-- NOTE: This is permissive for troubleshooting - you may want to restrict this for production
CREATE POLICY "Allow all media bucket access" ON storage.objects
  FOR ALL
  USING (bucket_id = 'media' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

-- 4. Enable RLS on the media table
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- 5. Create a policy for the media table to ensure authenticated users can access it
DROP POLICY IF EXISTS "Media table access" ON public.media;
CREATE POLICY "Media table access" ON public.media
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 6. Make sure the database has the necessary columns for the improved image metadata
-- These are optional, only run if you want to store additional metadata
ALTER TABLE public.media 
ADD COLUMN IF NOT EXISTS mime_type TEXT,
ADD COLUMN IF NOT EXISTS width INTEGER,
ADD COLUMN IF NOT EXISTS height INTEGER;

-- 7. Ensure images are publicly accessible even for anonymous users
CREATE POLICY "Public access to media images" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'media'); 