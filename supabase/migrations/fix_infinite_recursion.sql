-- Drop all existing policies for event_participants to avoid conflicts
DROP POLICY IF EXISTS "Participants can view event participants" ON event_participants;
DROP POLICY IF EXISTS "Users can insert their own event participants" ON event_participants;
DROP POLICY IF EXISTS "Users can delete their own event participants" ON event_participants;

-- Create a simpler policy for viewing event participants that won't cause recursion
CREATE POLICY "Participants can view event participants"
    ON event_participants FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_participants.event_id
            AND events.created_by = auth.uid()
        )
    );

-- Create a policy for inserting event participants
CREATE POLICY "Users can insert their own event participants"
    ON event_participants FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
    );

-- Make sure RLS is enabled
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- Fix the events table policies
DROP POLICY IF EXISTS "Users can view their own events" ON events;
DROP POLICY IF EXISTS "Users can create events" ON events;
DROP POLICY IF EXISTS "Users can update their own events" ON events;

-- Create a simpler policy for viewing events
CREATE POLICY "Users can view their own events"
    ON events FOR SELECT
    TO authenticated
    USING (
        auth.uid() = created_by
        OR
        EXISTS (
            SELECT 1 FROM event_participants
            WHERE event_participants.event_id = id
            AND event_participants.user_id = auth.uid()
        )
    );

-- Create a policy for creating events
CREATE POLICY "Users can create events"
    ON events FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = created_by
    );

-- Create a policy for updating events
CREATE POLICY "Users can update their own events"
    ON events FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = created_by
    );

-- Make sure RLS is enabled
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Also fix the media table policies if they have similar issues
DROP POLICY IF EXISTS "Event participants can view media" ON media;
DROP POLICY IF EXISTS "Event participants can insert media" ON media;

-- Create a simpler policy for viewing media
CREATE POLICY "Event participants can view media"
    ON media FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = media.event_id
            AND events.created_by = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM event_participants
            WHERE event_participants.event_id = media.event_id
            AND event_participants.user_id = auth.uid()
        )
    );

-- Create a policy for inserting media
CREATE POLICY "Event participants can insert media"
    ON media FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND
        EXISTS (
            SELECT 1 FROM event_participants
            WHERE event_participants.event_id = media.event_id
            AND event_participants.user_id = auth.uid()
        )
    );

-- Make sure RLS is enabled
ALTER TABLE media ENABLE ROW LEVEL SECURITY; 