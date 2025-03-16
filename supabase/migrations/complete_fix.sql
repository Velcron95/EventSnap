-- Drop all existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON "public"."user";
DROP POLICY IF EXISTS "Users can update their own profile" ON "public"."user";
DROP POLICY IF EXISTS "Users can create their profile" ON "public"."user";
DROP POLICY IF EXISTS "Users can view events" ON "public"."events";
DROP POLICY IF EXISTS "Users can create events" ON "public"."events";
DROP POLICY IF EXISTS "Users can update their events" ON "public"."events";
DROP POLICY IF EXISTS "Participants can view event participants" ON "public"."event_participants";
DROP POLICY IF EXISTS "Users can join events" ON "public"."event_participants";
DROP POLICY IF EXISTS "Participants can view media" ON "public"."media";
DROP POLICY IF EXISTS "Participants can upload media" ON "public"."media";

-- Enable RLS on all tables
ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user" ENABLE ROW LEVEL SECURITY;

-- Grant privileges to authenticated users
GRANT ALL ON "public"."events" TO authenticated;
GRANT ALL ON "public"."event_participants" TO authenticated;
GRANT ALL ON "public"."media" TO authenticated;
GRANT ALL ON "public"."user" TO authenticated;

-- SIMPLIFIED POLICIES FOR EVENTS TABLE
-- Allow users to view events they participate in or all events for joining
CREATE POLICY "Users can view events" ON "public"."events"
FOR SELECT
TO authenticated
USING (true);

-- Allow users to create events
CREATE POLICY "Users can create events" ON "public"."events"
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users to update events they created
CREATE POLICY "Users can update their events" ON "public"."events"
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- POLICIES FOR EVENT_PARTICIPANTS TABLE
-- Allow users to view event participants for events they participate in
CREATE POLICY "Participants can view event participants" ON "public"."event_participants"
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_participants.event_id
    AND events.created_by = auth.uid()
  )
);

-- Allow users to join events
CREATE POLICY "Users can join events" ON "public"."event_participants"
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- POLICIES FOR MEDIA TABLE
-- Allow users to view media for events they participate in
CREATE POLICY "Participants can view media" ON "public"."media"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM event_participants
    WHERE event_participants.event_id = media.event_id
    AND event_participants.user_id = auth.uid()
  )
);

-- Allow users to upload media for events they participate in
CREATE POLICY "Participants can upload media" ON "public"."media"
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM event_participants
    WHERE event_participants.event_id = media.event_id
    AND event_participants.user_id = auth.uid()
  )
);

-- POLICIES FOR USER TABLE
-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile" ON "public"."user"
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" ON "public"."user"
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Allow users to create their profile
CREATE POLICY "Users can create their profile" ON "public"."user"
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Function to get policy information
DROP FUNCTION IF EXISTS get_policies_info();

CREATE OR REPLACE FUNCTION get_policies_info()
RETURNS TABLE (
    tablename text,
    policyname text,
    cmd text,
    roles text,
    using_expr text,
    with_check_expr text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.tablename::text,
        p.policyname::text,
        p.cmd::text,
        p.roles::text,
        p.qual::text AS using_expr,
        p.with_check::text AS with_check_expr
    FROM
        pg_policies p
    WHERE
        p.schemaname = 'public'
    ORDER BY
        p.tablename, p.policyname;
END;
$$ LANGUAGE plpgsql; 