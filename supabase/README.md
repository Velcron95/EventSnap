# Supabase Database Setup

This directory contains SQL migration files for setting up the database schema and permissions for the EventSnap app.

## Setting Up the Media Likes Feature

The app includes a feature for users to like media in event galleries. This requires the `media_likes` table to be set up in the database.

### Option 1: Run the Migration File

The easiest way to set up the media_likes table is to run the migration file:

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Open and run the file `migrations/20240101000000_create_media_likes_table.sql`

### Option 2: Create the RPC Function

Alternatively, you can create an RPC function that allows the app to create the table on demand:

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Open and run the file `migrations/create_media_likes_rpc.sql`

This will create a function called `create_media_likes_table_if_not_exists()` that the app can call to create the table if it doesn't exist.

### Manual Setup

If you prefer to set up the table manually:

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Run the following SQL:

```sql
-- Create media_likes table
CREATE TABLE IF NOT EXISTS media_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(media_id, user_id)
);

-- Add RLS policies for media_likes table
ALTER TABLE media_likes ENABLE ROW LEVEL SECURITY;

-- Allow users to view likes for media in events they participate in
CREATE POLICY "Users can view likes for media in events they participate in" ON media_likes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM media m
      JOIN event_participants ep ON m.event_id = ep.event_id
      WHERE m.id = media_likes.media_id AND ep.user_id = auth.uid()
    )
  );

-- Allow users to like/unlike media in events they participate in
CREATE POLICY "Users can like media in events they participate in" ON media_likes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM media m
      JOIN event_participants ep ON m.event_id = ep.event_id
      WHERE m.id = media_likes.media_id AND ep.user_id = auth.uid()
    ) AND
    auth.uid() = user_id
  );

-- Allow users to delete their own likes
CREATE POLICY "Users can delete their own likes" ON media_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS media_likes_media_id_idx ON media_likes(media_id);
CREATE INDEX IF NOT EXISTS media_likes_user_id_idx ON media_likes(user_id);
```

## Verifying the Setup

To verify that the media_likes table is set up correctly:

1. Go to the Table Editor in your Supabase dashboard
2. Check if the `media_likes` table exists
3. Verify that it has the following columns:
   - `id` (UUID, primary key)
   - `media_id` (UUID, foreign key to media.id)
   - `user_id` (UUID, foreign key to auth.users.id)
   - `created_at` (timestamp) 