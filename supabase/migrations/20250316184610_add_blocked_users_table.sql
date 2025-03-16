-- Create a table to track blocked users for each event
CREATE TABLE event_blocked_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  UNIQUE(event_id, user_id)
);

-- Add RLS policies for the blocked users table
ALTER TABLE event_blocked_users ENABLE ROW LEVEL SECURITY;

-- Only event creators can see the blocked users list
CREATE POLICY "Event creators can view blocked users"
  ON event_blocked_users
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT created_by FROM events WHERE id = event_id
    )
  );

-- Only event creators can block users
CREATE POLICY "Event creators can block users"
  ON event_blocked_users
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT created_by FROM events WHERE id = event_id
    )
  );

-- Only event creators can unblock users
CREATE POLICY "Event creators can unblock users"
  ON event_blocked_users
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT created_by FROM events WHERE id = event_id
    )
  );

-- Create a function to check if a user is blocked from an event
CREATE OR REPLACE FUNCTION is_user_blocked_from_event(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM event_blocked_users
    WHERE event_id = p_event_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to block a user from an event
CREATE OR REPLACE FUNCTION block_user_from_event(p_event_id UUID, p_user_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_creator BOOLEAN;
BEGIN
  -- Check if the current user is the event creator
  SELECT EXISTS (
    SELECT 1 FROM events
    WHERE id = p_event_id AND created_by = auth.uid()
  ) INTO v_is_creator;
  
  IF NOT v_is_creator THEN
    RAISE EXCEPTION 'Only the event creator can block users';
  END IF;
  
  -- Remove the user from the event participants if they're already in it
  DELETE FROM event_participants
  WHERE event_id = p_event_id AND user_id = p_user_id;
  
  -- Add the user to the blocked list
  INSERT INTO event_blocked_users (event_id, user_id, blocked_by, reason)
  VALUES (p_event_id, p_user_id, auth.uid(), p_reason)
  ON CONFLICT (event_id, user_id) DO NOTHING;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to unblock a user from an event and add them back as a participant
CREATE OR REPLACE FUNCTION unblock_user_from_event(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_creator BOOLEAN;
  v_display_name TEXT;
BEGIN
  -- Check if the current user is the event creator
  SELECT EXISTS (
    SELECT 1 FROM events
    WHERE id = p_event_id AND created_by = auth.uid()
  ) INTO v_is_creator;
  
  IF NOT v_is_creator THEN
    RAISE EXCEPTION 'Only the event creator can unblock users';
  END IF;
  
  -- Get the user's display name from auth.users
  SELECT COALESCE(
    raw_user_meta_data->>'display_name',
    email,
    'User ' || SUBSTRING(p_user_id::text, 1, 6)
  ) INTO v_display_name
  FROM auth.users
  WHERE id = p_user_id;
  
  -- Remove the user from the blocked list
  DELETE FROM event_blocked_users
  WHERE event_id = p_event_id AND user_id = p_user_id;
  
  -- Add the user back to the event participants
  INSERT INTO event_participants (event_id, user_id, display_name)
  VALUES (p_event_id, p_user_id, v_display_name)
  ON CONFLICT (event_id, user_id) DO NOTHING;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Modify the event_participants table to prevent blocked users from joining
CREATE OR REPLACE FUNCTION check_user_not_blocked()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM event_blocked_users
    WHERE event_id = NEW.event_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'User is blocked from this event';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to check if a user is blocked before they can join an event
CREATE TRIGGER check_user_not_blocked_trigger
BEFORE INSERT ON event_participants
FOR EACH ROW
EXECUTE FUNCTION check_user_not_blocked();
