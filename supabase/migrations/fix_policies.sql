-- Drop the problematic policies
DROP POLICY IF EXISTS "Participants can view event participants" ON event_participants;
DROP POLICY IF EXISTS "Event participants can view media" ON media;

-- Create fixed policies that avoid infinite recursion
-- For event_participants table
CREATE POLICY "Participants can view event participants"
    ON event_participants FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM event_participants ep
            WHERE ep.event_id = event_participants.event_id
            AND ep.user_id = auth.uid()
        )
    );

-- For media table
CREATE POLICY "Event participants can view media"
    ON media FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM event_participants ep
            WHERE ep.event_id = media.event_id
            AND ep.user_id = auth.uid()
        )
    );

-- Add a policy to allow users to view their own events
CREATE POLICY "Users can view their own events"
    ON events FOR SELECT
    TO authenticated
    USING (
        auth.uid() = created_by
        OR
        EXISTS (
            SELECT 1 FROM event_participants ep
            WHERE ep.event_id = id
            AND ep.user_id = auth.uid()
        )
    );

-- Add a policy to allow users to view their own user profile
CREATE POLICY "Users can view their own profile"
    ON "user" FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
    );

-- Add a policy to allow users to update their own user profile
CREATE POLICY "Users can update their own profile"
    ON "user" FOR UPDATE
    TO authenticated
    USING (
        id = auth.uid()
    ); 