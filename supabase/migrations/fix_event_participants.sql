-- Drop the problematic policy
DROP POLICY IF EXISTS "Participants can view event participants" ON "public"."event_participants";

-- Create a simpler policy that won't cause recursion
CREATE POLICY "Participants can view event participants" ON "public"."event_participants"
FOR SELECT
TO authenticated
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

-- Make sure RLS is enabled
ALTER TABLE "public"."event_participants" ENABLE ROW LEVEL SECURITY; 