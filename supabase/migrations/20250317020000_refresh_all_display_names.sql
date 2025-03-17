-- Create a function to refresh all display names in the database
CREATE OR REPLACE FUNCTION public.refresh_all_display_names()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
    display_name TEXT;
BEGIN
    -- Loop through all users in auth.users
    FOR user_record IN SELECT id, raw_user_meta_data, email FROM auth.users LOOP
        -- Get the display name
        display_name := COALESCE(
            user_record.raw_user_meta_data->>'display_name',
            user_record.email,
            'User ' || SUBSTRING(user_record.id::text, 1, 6)
        );
        
        -- Update display_name in user table
        UPDATE "user"
        SET display_name = display_name
        WHERE id = user_record.id;
        
        -- Update display_name in event_participants table
        UPDATE event_participants
        SET display_name = display_name
        WHERE user_id = user_record.id;
        
        -- Update creator_display_name in events table
        UPDATE events
        SET creator_display_name = display_name
        WHERE created_by = user_record.id;
    END LOOP;
END;
$$;

-- Execute the function to refresh all display names
SELECT public.refresh_all_display_names();

-- Create a scheduled function to periodically refresh display names
-- This ensures that even if triggers fail, display names will eventually be updated
CREATE OR REPLACE FUNCTION public.scheduled_refresh_display_names()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.refresh_all_display_names();
END;
$$; 