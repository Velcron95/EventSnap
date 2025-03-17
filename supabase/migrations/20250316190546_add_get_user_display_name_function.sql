-- Create a function to get a user's display name from auth.users
CREATE OR REPLACE FUNCTION public.get_user_display_name(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    display_name TEXT;
BEGIN
    -- Try to get display_name from user_metadata in auth.users
    SELECT COALESCE(
        raw_user_meta_data->>'display_name',
        email,
        'User ' || SUBSTRING(user_id::text, 1, 6)
    ) INTO display_name
    FROM auth.users
    WHERE id = user_id;
    
    RETURN display_name;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_display_name(UUID) TO authenticated;

-- Test the function
SELECT get_user_display_name(id) FROM auth.users LIMIT 1;
