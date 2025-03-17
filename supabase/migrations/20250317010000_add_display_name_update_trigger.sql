-- Create a function to update display names in event_participants and events tables
CREATE OR REPLACE FUNCTION public.update_user_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_display_name TEXT;
BEGIN
    -- Get the new display name
    new_display_name := NEW.display_name;
    
    -- Update display_name in event_participants table
    UPDATE event_participants
    SET display_name = new_display_name
    WHERE user_id = NEW.id;
    
    -- Update creator_display_name in events table
    UPDATE events
    SET creator_display_name = new_display_name
    WHERE created_by = NEW.id;
    
    RETURN NEW;
END;
$$;

-- Create a trigger on the user table
DROP TRIGGER IF EXISTS update_user_display_name_trigger ON "user";
CREATE TRIGGER update_user_display_name_trigger
AFTER UPDATE OF display_name ON "user"
FOR EACH ROW
EXECUTE FUNCTION public.update_user_display_name();

-- Create a function to update auth.users metadata when user table is updated
CREATE OR REPLACE FUNCTION public.sync_user_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update user metadata in auth.users
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{display_name}',
        to_jsonb(NEW.display_name)
    )
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$;

-- Create a trigger to sync user metadata
DROP TRIGGER IF EXISTS sync_user_metadata_trigger ON "user";
CREATE TRIGGER sync_user_metadata_trigger
AFTER UPDATE OF display_name ON "user"
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_metadata(); 