-- Create a function to automatically add the creator as a participant when an event is created
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
  
  -- Add the creator as a participant
  INSERT INTO event_participants (event_id, user_id, display_name)
  VALUES (NEW.id, NEW.created_by, creator_display_name);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to add the creator as a participant when an event is created
CREATE TRIGGER add_creator_as_participant_trigger
AFTER INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION add_creator_as_participant();

-- Add existing event creators as participants if they're not already
DO $$
DECLARE
  event_record RECORD;
  creator_display_name TEXT;
BEGIN
  FOR event_record IN SELECT * FROM events LOOP
    -- Check if creator is already a participant
    IF NOT EXISTS (
      SELECT 1 FROM event_participants 
      WHERE event_id = event_record.id AND user_id = event_record.created_by
    ) THEN
      -- Get the creator's display name
      SELECT COALESCE(
        raw_user_meta_data->>'display_name',
        email,
        'User ' || SUBSTRING(event_record.created_by::text, 1, 6)
      ) INTO creator_display_name
      FROM auth.users
      WHERE id = event_record.created_by;
      
      -- Add the creator as a participant
      INSERT INTO event_participants (event_id, user_id, display_name)
      VALUES (event_record.id, event_record.created_by, creator_display_name);
    END IF;
  END LOOP;
END;
$$;
