-- Add privacy policy and terms of service acceptance fields to the user table
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS privacy_policy_accepted BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS terms_of_service_accepted BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS acceptance_timestamp TIMESTAMP WITH TIME ZONE;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_policy_acceptance ON "user" (privacy_policy_accepted, terms_of_service_accepted);

-- Comment on columns for documentation
COMMENT ON COLUMN "user".privacy_policy_accepted IS 'Whether the user has accepted the privacy policy';
COMMENT ON COLUMN "user".terms_of_service_accepted IS 'Whether the user has accepted the terms of service';
COMMENT ON COLUMN "user".acceptance_timestamp IS 'When the user accepted both the privacy policy and terms of service'; 