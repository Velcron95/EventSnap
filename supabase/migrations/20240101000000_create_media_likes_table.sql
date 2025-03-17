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