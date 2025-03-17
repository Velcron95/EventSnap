-- Create a function to update the background_image column in the events table
CREATE OR REPLACE FUNCTION update_event_background(event_id UUID, bg_image_url TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the event exists
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = event_id) THEN
    RETURN FALSE;
  END IF;
  
  -- Update the event with the background image URL
  UPDATE events 
  SET background_image = bg_image_url
  WHERE id = event_id;
  
  -- Return success
  RETURN TRUE;
END;
$$; 