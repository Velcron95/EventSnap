-- SQL to check the structure of the media table
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM 
  information_schema.columns
WHERE 
  table_schema = 'public' 
  AND table_name = 'media'
ORDER BY 
  ordinal_position;

-- Check if the media table has expected permissions
SELECT 
  tablename,
  has_table_privilege('anon', 'media', 'SELECT') as anon_select,
  has_table_privilege('authenticated', 'media', 'SELECT') as auth_select,
  has_table_privilege('authenticated', 'media', 'INSERT') as auth_insert,
  has_table_privilege('authenticated', 'media', 'UPDATE') as auth_update,
  has_table_privilege('authenticated', 'media', 'DELETE') as auth_delete
FROM 
  pg_tables
WHERE 
  schemaname = 'public'
  AND tablename = 'media';

-- Check if RLS is enabled
SELECT
  tablename,
  rowsecurity
FROM
  pg_tables
WHERE
  schemaname = 'public'
  AND tablename = 'media';

-- Check storage.objects permissions
SELECT 
  has_table_privilege('anon', 'storage.objects', 'SELECT') as anon_select,
  has_table_privilege('authenticated', 'storage.objects', 'SELECT') as auth_select,
  has_table_privilege('authenticated', 'storage.objects', 'INSERT') as auth_insert,
  has_table_privilege('authenticated', 'storage.objects', 'UPDATE') as auth_update,
  has_table_privilege('authenticated', 'storage.objects', 'DELETE') as auth_delete;

-- Check current RLS policies on storage.objects
SELECT 
  policname,
  permissive,
  cmd,
  qual,
  with_check
FROM 
  pg_policies
WHERE 
  tablename = 'objects' 
  AND schemaname = 'storage';

-- Check storage buckets configuration
SELECT 
  id, 
  name, 
  public, 
  file_size_limit
FROM 
  storage.buckets
WHERE 
  name = 'media'; 