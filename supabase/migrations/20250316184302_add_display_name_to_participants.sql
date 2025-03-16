-- Add display_name column to event_participants table
ALTER TABLE event_participants ADD COLUMN display_name TEXT;

-- Create a function to copy display_name from auth.users when a participant is added
CREATE OR REPLACE FUNCTION public.set_participant_display_name()
RETURNS TRIGGER AS $$
DECLARE
    user_display_name TEXT;
BEGIN
    -- Try to get display_name from user_metadata in auth.users
    SELECT COALESCE(
        raw_user_meta_data->>'display_name',
        email,
        'User ' || SUBSTRING(NEW.user_id::text, 1, 6)
    ) INTO user_display_name
    FROM auth.users
    WHERE id = NEW.user_id;

    -- Set the display_name
    NEW.display_name := user_display_name;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically set display_name when a participant is added
CREATE TRIGGER set_participant_display_name_trigger
BEFORE INSERT ON event_participants
FOR EACH ROW
EXECUTE FUNCTION public.set_participant_display_name();

-- Update existing records
UPDATE event_participants ep
SET display_name = COALESCE(
    (SELECT raw_user_meta_data->>'display_name' FROM auth.users WHERE id = ep.user_id),
    (SELECT email FROM auth.users WHERE id = ep.user_id),
    'User ' || SUBSTRING(ep.user_id::text, 1, 6)
);
