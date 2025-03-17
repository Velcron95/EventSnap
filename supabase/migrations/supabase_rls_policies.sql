-- Enable Row Level Security on events table
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policy for selecting events (anyone can view events they participate in)
CREATE POLICY select_events ON events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM event_participants
            WHERE event_participants.event_id = events.id
            AND event_participants.user_id = auth.uid()
        )
    );

-- Policy for inserting events (authenticated users can create events)
CREATE POLICY insert_events ON events
    FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- Policy for updating events (only creator can update)
CREATE POLICY update_events ON events
    FOR UPDATE
    USING (auth.uid() = created_by);

-- Policy for deleting events (only creator can delete)
CREATE POLICY delete_events ON events
    FOR DELETE
    USING (auth.uid() = created_by);

-- Enable RLS on event_participants table
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- Policy for selecting participants (anyone can view participants of events they participate in)
CREATE POLICY select_participants ON event_participants
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM event_participants AS ep
            WHERE ep.event_id = event_participants.event_id
            AND ep.user_id = auth.uid()
        )
    );

-- Policy for inserting participants (authenticated users can join events)
CREATE POLICY insert_participants ON event_participants
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy for deleting participants (event creator can remove participants)
CREATE POLICY delete_participants ON event_participants
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_participants.event_id
            AND events.created_by = auth.uid()
        )
        OR auth.uid() = user_id -- Users can remove themselves
    );

-- Enable RLS on media table
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- Policy for selecting media (anyone can view media of events they participate in)
CREATE POLICY select_media ON media
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM event_participants
            WHERE event_participants.event_id = media.event_id
            AND event_participants.user_id = auth.uid()
        )
    );

-- Policy for inserting media (participants can add media)
CREATE POLICY insert_media ON media
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM event_participants
            WHERE event_participants.event_id = media.event_id
            AND event_participants.user_id = auth.uid()
        )
        AND auth.uid() = user_id
    );

-- Policy for deleting media (only creator of event or uploader can delete)
CREATE POLICY delete_media ON media
    FOR DELETE
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM events
            WHERE events.id = media.event_id
            AND events.created_by = auth.uid()
        )
    ); 