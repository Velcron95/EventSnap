-- Add background_image column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS background_image TEXT;

-- Update existing events with null background_image
UPDATE events SET background_image = NULL WHERE background_image IS NULL;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events' AND column_name = 'background_image'; 