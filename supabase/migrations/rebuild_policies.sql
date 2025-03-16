-- STEP 1: DROP ALL EXISTING POLICIES
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- STEP 2: ENABLE RLS ON ALL TABLES
ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user" ENABLE ROW LEVEL SECURITY;

-- STEP 3: GRANT PRIVILEGES
GRANT ALL ON "public"."events" TO authenticated;
GRANT ALL ON "public"."event_participants" TO authenticated;
GRANT ALL ON "public"."media" TO authenticated;
GRANT ALL ON "public"."user" TO authenticated;

-- STEP 4: CREATE NEW POLICIES

-- USER TABLE POLICIES
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON "public"."user"
FOR SELECT TO authenticated
USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON "public"."user"
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Users can create their profile
CREATE POLICY "Users can create own profile" ON "public"."user"
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- EVENTS TABLE POLICIES
-- Users can view all events (needed for browsing/joining)
CREATE POLICY "Users can view all events" ON "public"."events"
FOR SELECT TO authenticated
USING (true);

-- Users can create events
CREATE POLICY "Users can create events" ON "public"."events"
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

-- Users can update their own events
CREATE POLICY "Users can update own events" ON "public"."events"
FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- EVENT_PARTICIPANTS TABLE POLICIES
-- Simple policy for viewing participants - NO RECURSION
CREATE POLICY "View event participants" ON "public"."event_participants"
FOR SELECT TO authenticated
USING (
  -- Users can see their own participations
  user_id = auth.uid()
  OR
  -- Event creators can see all participants in their events
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_participants.event_id
    AND events.created_by = auth.uid()
  )
);

-- Users can join events (insert their own participation)
CREATE POLICY "Join events" ON "public"."event_participants"
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- MEDIA TABLE POLICIES
-- Users can view media for events they participate in
CREATE POLICY "View event media" ON "public"."media"
FOR SELECT TO authenticated
USING (
  -- Users can see media for events they participate in
  EXISTS (
    SELECT 1 FROM event_participants
    WHERE event_participants.event_id = media.event_id
    AND event_participants.user_id = auth.uid()
  )
);

-- Users can upload media to events they participate in
CREATE POLICY "Upload event media" ON "public"."media"
FOR INSERT TO authenticated
WITH CHECK (
  -- Users can only upload as themselves
  user_id = auth.uid()
  AND
  -- Users can only upload to events they participate in
  EXISTS (
    SELECT 1 FROM event_participants
    WHERE event_participants.event_id = media.event_id
    AND event_participants.user_id = auth.uid()
  )
); 