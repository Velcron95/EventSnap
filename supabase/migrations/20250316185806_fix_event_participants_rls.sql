-- Drop existing RLS policies for event_participants if they exist
DROP POLICY IF EXISTS "Users can view participants of events they are part of" ON event_participants;
DROP POLICY IF EXISTS "Users can view their own participant records" ON event_participants;
DROP POLICY IF EXISTS "Event creators can view all participants" ON event_participants;

-- Enable RLS on event_participants table if not already enabled
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view all participants of events they are part of
CREATE POLICY "Users can view participants of events they are part of"
ON event_participants
FOR SELECT
USING (
  -- User is a participant in this event
  EXISTS (
    SELECT 1 FROM event_participants
    WHERE event_id = event_participants.event_id
    AND user_id = auth.uid()
  )
  OR
  -- User is the creator of this event
  EXISTS (
    SELECT 1 FROM events
    WHERE id = event_participants.event_id
    AND created_by = auth.uid()
  )
);

-- Create policy to allow users to insert their own participant records
CREATE POLICY "Users can insert their own participant records"
ON event_participants
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);

-- Create policy to allow event creators to insert any participant records
CREATE POLICY "Event creators can insert any participant records"
ON event_participants
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE id = event_participants.event_id
    AND created_by = auth.uid()
  )
);

-- Create policy to allow users to delete their own participant records
CREATE POLICY "Users can delete their own participant records"
ON event_participants
FOR DELETE
USING (
  user_id = auth.uid()
);

-- Create policy to allow event creators to delete any participant records
CREATE POLICY "Event creators can delete any participant records"
ON event_participants
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE id = event_participants.event_id
    AND created_by = auth.uid()
  )
);

-- Create policy to allow users to update their own participant records
CREATE POLICY "Users can update their own participant records"
ON event_participants
FOR UPDATE
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- Create policy to allow event creators to update any participant records
CREATE POLICY "Event creators can update any participant records"
ON event_participants
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE id = event_participants.event_id
    AND created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE id = event_participants.event_id
    AND created_by = auth.uid()
  )
);
