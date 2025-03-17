-- Add creator_display_name column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS creator_display_name TEXT;

-- Update existing events with creator display names from auth.users
DO $$
DECLARE
  event_record RECORD;
  creator_display_name TEXT;
BEGIN
  FOR event_record IN SELECT * FROM events LOOP
    -- Get the creator's display name
    SELECT COALESCE(
      raw_user_meta_data->>'display_name',
      email,
      'User ' || SUBSTRING(event_record.created_by::text, 1, 6)
    ) INTO creator_display_name
    FROM auth.users
    WHERE id = event_record.created_by;
    
    -- Update the event with the creator's display name
    UPDATE events 
    SET creator_display_name = creator_display_name
    WHERE id = event_record.id;
  END LOOP;
END;
$$;

-- Modify the add_creator_as_participant function to also store the creator's display name
CREATE OR REPLACE FUNCTION add_creator_as_participant()
RETURNS TRIGGER AS $$
DECLARE
  creator_display_name TEXT;
BEGIN
  -- Get the creator's display name from auth.users
  SELECT COALESCE(
    raw_user_meta_data->>'display_name',
    email,
    'User ' || SUBSTRING(NEW.created_by::text, 1, 6)
  ) INTO creator_display_name
  FROM auth.users
  WHERE id = NEW.created_by;
  
  -- Update the event with the creator's display name
  UPDATE events
  SET creator_display_name = creator_display_name
  WHERE id = NEW.id;
  
  -- Add the creator as a participant
  INSERT INTO event_participants (event_id, user_id, display_name)
  VALUES (NEW.id, NEW.created_by, creator_display_name);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events' AND column_name = 'creator_display_name'; 