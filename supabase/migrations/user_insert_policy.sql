-- Add a policy to allow users to insert their own user profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON "user";

CREATE POLICY "Users can insert their own profile"
    ON "user" FOR INSERT
    TO authenticated
    WITH CHECK (
        id = auth.uid()
    );

-- Make sure the user table has RLS enabled
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;

-- Grant all privileges on user table to authenticated users
GRANT ALL ON "user" TO authenticated; 